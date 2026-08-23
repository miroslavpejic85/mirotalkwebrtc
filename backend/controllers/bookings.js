'use strict';

const crypto = require('crypto');
const Booking = require('../models/booking');
const BookingProfile = require('../models/bookingProfile');
const EmailInvitation = require('../models/emailInvitation');
const Room = require('../models/room');
const User = require('../models/users');
const emailQueue = require('../lib/emailQueue');
const { queueCalendarLifecycle } = require('../lib/calendarLifecycle');
const { buildOccupiedStarts, generateAvailableSlots } = require('../common/availability');
const { getZonedParts, normalizeTimezone } = require('../common/schedule');
const emailUtils = require('../common/emailUtils');
const { isSubscriptionActive } = require('../middleware/saas');
const config = require('../config');
const logs = require('../common/logs');

const log = new logs('Controllers-bookings');
const DEFAULT_WEEKLY_HOURS = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    intervals: [{ start: '09:00', end: '17:00' }],
}));

function pad(value) {
    return String(value).padStart(2, '0');
}

function localSchedule(instant, timezone) {
    const parts = getZonedParts(instant, timezone);
    return {
        date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
        time: `${pad(parts.hour)}:${pad(parts.minute)}`,
    };
}

function roomUrl(room) {
    const value = encodeURIComponent(room.room);
    if (room.type === 'P2P') return `${config.MiroTalk.P2P.Join}${value}`;
    if (room.type === 'SFU') return `${config.MiroTalk.SFU.Join}?room=${value}`;
    if (room.type === 'C2C') return `${config.MiroTalk.C2C.Room}${value}`;
    if (room.type === 'BRO') return `${config.MiroTalk.BRO.Viewer}${value}`;
    if (room.type === 'CME') return `${config.MiroTalk.CME.Room}${value}`;
    return '';
}

async function authUser(req) {
    if (!req.user) return null;
    return User.findOne({ email: req.user.email, username: req.user.username }).select('_id username email').lean();
}

async function organizerCanUsePublicBooking(userId) {
    if (!config.SAAS.enabled) return true;
    const organizer = await User.findById(userId)
        .select('role subscriptionType subscriptionStatus subscriptionExpiresAt')
        .lean();
    return organizer?.role === 'admin' || isSubscriptionActive(organizer);
}

function publicProfile(profile) {
    return {
        slug: profile.slug,
        displayName: profile.displayName,
        title: profile.title,
        description: profile.description,
        timezone: profile.timezone,
        durationMinutes: profile.durationMinutes,
        bookingWindowDays: profile.bookingWindowDays,
    };
}

function roomsAsBusy(rooms) {
    return rooms.map((room) => {
        const startAt = new Date(room.startAt);
        return {
            startAt,
            endAt: new Date(startAt.getTime() + (Number(room.duration) || 30) * 60000),
        };
    });
}

function validTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    return !!match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[2]) % 5 === 0;
}

function normalizeIntervals(intervals) {
    if (!Array.isArray(intervals) || intervals.length > 8) return null;
    const normalized = intervals.map((interval) => ({ start: interval.start, end: interval.end }));
    if (
        normalized.some(
            (interval) => !validTime(interval.start) || !validTime(interval.end) || interval.start >= interval.end
        )
    ) {
        return null;
    }
    return normalized;
}

function normalizeWeeklyHours(value) {
    if (!Array.isArray(value)) return null;
    const seen = new Set();
    const result = [];
    for (const day of value) {
        const dayOfWeek = Number(day.dayOfWeek);
        const intervals = normalizeIntervals(day.intervals);
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || seen.has(dayOfWeek) || !intervals) {
            return null;
        }
        seen.add(dayOfWeek);
        result.push({ dayOfWeek, intervals });
    }
    return result.sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}

function normalizeDateOverrides(value) {
    if (!Array.isArray(value) || value.length > 100) return null;
    const result = [];
    for (const override of value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(override.date || '')) return null;
        const intervals = normalizeIntervals(override.intervals || []);
        if (!intervals) return null;
        result.push({ date: override.date, available: override.available === true, intervals });
    }
    return result;
}

async function getProfile(req, res) {
    try {
        const user = await authUser(req);
        if (!user) return res.status(403).json({ message: 'Access denied' });
        let profile = await BookingProfile.findOne({ userId: String(user._id) });
        if (!profile) {
            const slugBase = String(user.username || user.email.split('@')[0])
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 40);
            profile = await BookingProfile.create({
                userId: String(user._id),
                slug: `${slugBase || 'host'}-${crypto.randomBytes(3).toString('hex')}`,
                displayName: user.username || user.email.split('@')[0],
                weeklyHours: DEFAULT_WEEKLY_HOURS,
            });
        }
        return res.status(200).json(profile);
    } catch (error) {
        log.error('Get booking profile error', error);
        return res.status(400).json({ message: error.message });
    }
}

async function updateProfile(req, res) {
    try {
        const user = await authUser(req);
        if (!user) return res.status(403).json({ message: 'Access denied' });
        const current = await BookingProfile.findOne({ userId: String(user._id) });
        if (!current) return res.status(404).json({ message: 'Open availability once before saving it' });

        const body = req.body || {};
        const update = {};
        if (body.slug !== undefined) {
            const slug = String(body.slug).trim().toLowerCase();
            if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(slug)) {
                return res.status(400).json({ message: 'Public link must be 3-50 letters, numbers, or hyphens' });
            }
            update.slug = slug;
        }
        for (const field of ['displayName', 'title', 'description']) {
            if (body[field] !== undefined) update[field] = String(body[field]).trim();
        }
        if (body.timezone !== undefined) {
            update.timezone = normalizeTimezone(body.timezone);
            if (!update.timezone) return res.status(400).json({ message: 'Select a valid IANA timezone' });
        }
        if (body.roomType !== undefined) update.roomType = body.roomType;
        const numberFields = {
            durationMinutes: [5, 480],
            bufferBeforeMinutes: [0, 240],
            bufferAfterMinutes: [0, 240],
            minimumNoticeMinutes: [0, 43200],
            bookingWindowDays: [1, 365],
        };
        for (const [field, range] of Object.entries(numberFields)) {
            if (body[field] === undefined) continue;
            const value = Number(body[field]);
            if (
                !Number.isInteger(value) ||
                value < range[0] ||
                value > range[1] ||
                (field !== 'bookingWindowDays' && value % 5 !== 0)
            ) {
                return res.status(400).json({ message: `Invalid ${field}` });
            }
            update[field] = value;
        }
        if (body.weeklyHours !== undefined) {
            update.weeklyHours = normalizeWeeklyHours(body.weeklyHours);
            if (!update.weeklyHours) return res.status(400).json({ message: 'Weekly hours are invalid' });
        }
        if (body.dateOverrides !== undefined) {
            update.dateOverrides = normalizeDateOverrides(body.dateOverrides);
            if (!update.dateOverrides) return res.status(400).json({ message: 'Date overrides are invalid' });
        }
        if (body.enabled !== undefined) update.enabled = body.enabled === true;
        const profile = await BookingProfile.findOneAndUpdate(
            { userId: String(user._id) },
            { $set: update },
            { returnDocument: 'after', runValidators: true }
        );
        return res.status(200).json(profile);
    } catch (error) {
        const status = error && error.code === 11000 ? 409 : 400;
        const message = status === 409 ? 'That public link is already in use' : error.message;
        return res.status(status).json({ message });
    }
}

async function listBookings(req, res) {
    const user = await authUser(req);
    if (!user) return res.status(403).json({ message: 'Access denied' });
    const bookings = await Booking.find({ userId: String(user._id) })
        .select('-occupiedStarts -cancelTokenHash')
        .sort({ startAt: 1 })
        .limit(250)
        .populate({ path: 'roomId', select: 'room type' })
        .lean();
    return res.status(200).json(
        bookings.map((booking) => ({
            ...booking,
            roomId: booking.roomId ? String(booking.roomId._id) : null,
            roomUrl: booking.roomId ? roomUrl(booking.roomId) : '',
        }))
    );
}

async function getPublicProfile(req, res) {
    const profile = await BookingProfile.findOne({ slug: req.params.slug, enabled: true }).lean();
    if (!profile) return res.status(404).json({ message: 'Booking page not found' });
    if (!(await organizerCanUsePublicBooking(profile.userId))) {
        return res.status(404).json({ message: 'Booking page not found' });
    }
    return res.status(200).json(publicProfile(profile));
}

async function getPublicSlots(req, res) {
    try {
        const profile = await BookingProfile.findOne({ slug: req.params.slug, enabled: true }).lean();
        if (!profile) return res.status(404).json({ message: 'Booking page not found' });
        if (!(await organizerCanUsePublicBooking(profile.userId))) {
            return res.status(404).json({ message: 'Booking page not found' });
        }
        const from = new Date(req.query.from);
        const to = new Date(req.query.to);
        if (
            !Number.isFinite(from.getTime()) ||
            !Number.isFinite(to.getTime()) ||
            to <= from ||
            to - from > 31 * 86400000
        ) {
            return res.status(400).json({ message: 'Choose a valid date range of up to 31 days' });
        }
        const bookings = await Booking.find({
            profileId: profile._id,
            status: 'confirmed',
            occupiedStartAt: { $lt: to },
            occupiedEndAt: { $gt: from },
        })
            .select('startAt endAt occupiedStartAt occupiedEndAt')
            .lean();
        const rooms = await Room.find({
            userId: profile.userId,
            startAt: { $lt: to, $gte: new Date(from.getTime() - 24 * 60 * 60000) },
        })
            .select('startAt duration')
            .lean();
        const slots = generateAvailableSlots(profile, from, to, [...bookings, ...roomsAsBusy(rooms)]);
        return res.status(200).json({ profile: publicProfile(profile), slots });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}

async function createBooking(req, res) {
    let booking;
    let room;
    try {
        const profile = await BookingProfile.findOne({ slug: req.params.slug, enabled: true }).lean();
        if (!profile) return res.status(404).json({ message: 'Booking page not found' });
        if (!(await organizerCanUsePublicBooking(profile.userId))) {
            return res.status(404).json({ message: 'Booking page not found' });
        }
        const organizer = await User.findById(profile.userId).select('email').lean();
        const guestEmail = emailUtils.normalizeEmail(req.body && req.body.email);
        const classified = emailUtils.validateEmailList([guestEmail], { max: 1 });
        const guestName = String((req.body && req.body.name) || '')
            .trim()
            .slice(0, 100);
        const startAt = new Date(req.body && req.body.startAt);
        if (!guestName || classified.valid.length !== 1 || !Number.isFinite(startAt.getTime())) {
            return res.status(400).json({ message: 'Name, valid email, and start time are required' });
        }

        const existing = await Booking.find({
            profileId: profile._id,
            status: 'confirmed',
            occupiedStartAt: {
                $lt: new Date(startAt.getTime() + (profile.durationMinutes + profile.bufferAfterMinutes) * 60000),
            },
            occupiedEndAt: { $gt: new Date(startAt.getTime() - profile.bufferBeforeMinutes * 60000) },
        })
            .select('startAt endAt occupiedStartAt occupiedEndAt')
            .lean();
        const existingRooms = await Room.find({
            userId: profile.userId,
            startAt: {
                $lt: new Date(startAt.getTime() + (profile.durationMinutes + profile.bufferAfterMinutes) * 60000),
                $gte: new Date(startAt.getTime() - (24 * 60 + profile.bufferBeforeMinutes) * 60000),
            },
        })
            .select('startAt duration')
            .lean();
        const requested = generateAvailableSlots(
            profile,
            new Date(startAt.getTime() - 60000),
            new Date(startAt.getTime() + profile.durationMinutes * 60000 + 60000),
            [...existing, ...roomsAsBusy(existingRooms)]
        ).some((slot) => slot.getTime() === startAt.getTime());
        if (!requested) return res.status(409).json({ message: 'That time is no longer available' });

        const endAt = new Date(startAt.getTime() + profile.durationMinutes * 60000);
        const occupiedStarts = buildOccupiedStarts(
            startAt,
            profile.durationMinutes,
            profile.bufferBeforeMinutes,
            profile.bufferAfterMinutes
        );
        const cancelToken = crypto.randomBytes(32).toString('hex');
        booking = await Booking.create({
            profileId: profile._id,
            userId: profile.userId,
            guestName,
            guestEmail,
            guestNotes: String((req.body && req.body.notes) || '')
                .trim()
                .slice(0, 2000),
            startAt,
            endAt,
            occupiedStartAt: occupiedStarts[0],
            occupiedEndAt: new Date(occupiedStarts.at(-1).getTime() + 5 * 60000),
            occupiedStarts,
            timezone: profile.timezone,
            cancelTokenHash: crypto.createHash('sha256').update(cancelToken).digest('hex'),
        });

        const schedule = localSchedule(startAt, profile.timezone);
        room = await Room.create({
            userId: profile.userId,
            type: profile.roomType,
            tag: profile.title,
            email: guestEmail,
            date: schedule.date,
            time: schedule.time,
            timezone: profile.timezone,
            startAt,
            duration: profile.durationMinutes,
            room: `booking-${crypto.randomBytes(10).toString('hex')}`,
        });
        booking.roomId = room._id;
        await booking.save();

        const serverUrl = String(process.env.SERVER_URL || config?.OG?.url || '').replace(/\/$/, '');
        const cancelUrl = `${serverUrl}/book/cancel/${cancelToken}`;
        const invitation = {
            kind: 'invitation',
            userId: profile.userId,
            roomId: String(room._id),
            roomType: room.type,
            room: room.room,
            roomUrl: roomUrl(room),
            date: room.date,
            time: room.time,
            timezone: room.timezone,
            startAt,
            duration: room.duration,
            calendarUid: room.calendarUid,
            calendarSequence: 0,
            subject: `${profile.title} with ${profile.displayName}`,
            message: `Booked by ${guestName}. Manage this booking: ${cancelUrl}`,
            inviterName: profile.displayName,
            recipient: guestEmail,
            attendeeStatus: 'accepted',
            attendeeRespondedAt: new Date(),
        };
        const jobs = [invitation];
        if (organizer?.email && organizer.email.toLowerCase() !== guestEmail) {
            jobs.push({
                ...invitation,
                subject: `New booking: ${profile.title} with ${guestName}`,
                message: `${guestName} (${guestEmail}) booked this meeting. ${booking.guestNotes || ''}`.trim(),
                recipient: organizer.email,
                attendeeStatus: 'accepted',
                attendeeRespondedAt: new Date(),
            });
        }
        await emailQueue.enqueue(jobs);
        return res.status(201).json({
            id: String(booking._id),
            startAt: booking.startAt,
            endAt: booking.endAt,
            timezone: booking.timezone,
            title: profile.title,
            host: profile.displayName,
            roomUrl: roomUrl(room),
            cancelUrl,
        });
    } catch (error) {
        if (room) await Room.deleteOne({ _id: room._id }).catch(() => {});
        if (booking) await Booking.deleteOne({ _id: booking._id }).catch(() => {});
        if (error && error.code === 11000) return res.status(409).json({ message: 'That time was just booked' });
        log.error('Create public booking error', error);
        return res.status(400).json({ message: error.message });
    }
}

async function getCancellation(req, res) {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const booking = await Booking.findOne({ cancelTokenHash: tokenHash }).select('+cancelTokenHash').lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    return res.status(200).json({ status: booking.status, startAt: booking.startAt, timezone: booking.timezone });
}

async function cancelBooking(req, res) {
    try {
        const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const booking = await Booking.findOneAndUpdate(
            { cancelTokenHash: tokenHash, status: 'confirmed' },
            { $set: { status: 'canceled', canceledAt: new Date() }, $unset: { occupiedStarts: 1 } },
            { returnDocument: 'after' }
        ).select('+cancelTokenHash');
        if (!booking) return res.status(404).json({ message: 'Active booking not found' });
        const room = await Room.findById(booking.roomId);
        if (room) {
            room.calendarSequence = Number(room.calendarSequence) + 1;
            await room.save();
            await queueCalendarLifecycle(room, 'cancellation');
            await Room.deleteOne({ _id: room._id });
        }
        return res.status(200).json({ message: 'Booking canceled' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}

async function deleteManagedBooking(req, res) {
    try {
        const user = await authUser(req);
        if (!user) return res.status(403).json({ message: 'Access denied' });
        if (req.body?.reason !== undefined && typeof req.body.reason !== 'string') {
            return res.status(400).json({ message: 'Cancellation reason must be text' });
        }
        const reason = String(req.body?.reason || '').trim();
        if (reason.length > 500) {
            return res.status(400).json({ message: 'Cancellation reason must be 500 characters or fewer' });
        }
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.id, userId: String(user._id), status: 'confirmed' },
            { $set: { status: 'canceled', canceledAt: new Date() }, $unset: { occupiedStarts: 1 } },
            { returnDocument: 'after' }
        );
        if (!booking) return res.status(404).json({ message: 'Active booking not found' });
        const room = await Room.findById(booking.roomId);
        if (room) {
            room.calendarSequence = Number(room.calendarSequence) + 1;
            await room.save();
            await queueCalendarLifecycle(room, 'cancellation', reason ? `Cancellation reason: ${reason}` : undefined);
            await Room.deleteOne({ _id: room._id });
        }
        return res.status(200).json({ message: 'Booking deleted' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}

module.exports = {
    getProfile,
    updateProfile,
    listBookings,
    getPublicProfile,
    getPublicSlots,
    createBooking,
    getCancellation,
    cancelBooking,
    deleteManagedBooking,
};
