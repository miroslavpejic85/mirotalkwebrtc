'use strict';

const Room = require('../models/room');
const User = require('../models/users');
const { computeReminderAt } = require('../lib/roomReminders');
const { normalizeTimezone, zonedDateTimeToUtc } = require('../common/schedule');
const { hasCalendarChanges, ensureCalendarIdentity, queueCalendarLifecycle } = require('../lib/calendarLifecycle');
const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('Controllers-room');

// Resolve the authenticated user's MongoDB _id from req.user (which contains email/username)
async function getAuthUserId(req) {
    if (!req.user) return null;
    const { email, username } = req.user;
    const user = await User.findOne({ email, username }).select('_id').lean();
    return user ? String(user._id) : null;
}

// Authorize the request: pass if caller is admin or owns the target userId.
// On failure, sends a 403 response and returns false; callers must `return` when false.
async function ensureOwnerOrAdmin(req, res, targetUserId) {
    const isAdmin = await utils.isAdmin(req.user.email, req.user.username, req.user.password);
    if (isAdmin) return true;
    const authUserId = await getAuthUserId(req);
    if (!authUserId || authUserId !== String(targetUserId)) {
        res.status(403).json({ message: 'Access denied' });
        return false;
    }
    return true;
}

// Coerce client-supplied duration to a sane minutes value or null (no override).
// Mirrors the schema constraints (5..1440) so invalid input is dropped rather than rejected,
// keeping the invitation flow on its env-default fallback.
function normalizeDuration(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (rounded < 5 || rounded > 1440) return null;
    return rounded;
}

async function roomCreate(req, res) {
    try {
        const { type, tag, email, phone, date, time, timezone, duration, room } = req.body;

        // Derive userId server-side from authenticated user — never trust req.body.userId
        const authUserId = await getAuthUserId(req);
        if (!authUserId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const normalizedTimezone = timezone ? normalizeTimezone(timezone) : 'UTC';
        if (!normalizedTimezone) {
            return res.status(400).json({ message: 'Select a valid IANA timezone' });
        }
        const startAt = zonedDateTimeToUtc(date, time, normalizedTimezone);
        if (!startAt) {
            return res.status(400).json({ message: 'Select a valid meeting date, time, and timezone' });
        }

        const data = new Room({
            userId: authUserId,
            type: type,
            tag: tag,
            email: email,
            phone: phone,
            date: date,
            time: time,
            timezone: normalizedTimezone,
            startAt,
            duration: normalizeDuration(duration),
            room: room,
        });
        const dataToSave = await data.save();
        res.status(200).json(dataToSave);
    } catch (error) {
        log.error('Room create error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomExists(req, res) {
    try {
        const { room } = req.body;

        const roomFindOne = await Room.findOne({ room: room });

        if (Object.is(roomFindOne, null) || !roomFindOne) {
            log.debug('Room not found!', room);
            return res.status(201).json({ message: false });
        }

        res.status(201).json({ message: true });
    } catch (error) {
        log.error('Room exists error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomFindBy(req, res) {
    try {
        if (!(await ensureOwnerOrAdmin(req, res, req.params.userId))) return;
        const data = await Room.find({ userId: req.params.userId });
        res.json(data);
    } catch (error) {
        log.error('Room findByUserId error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDeleteFindBy(req, res) {
    try {
        if (!(await ensureOwnerOrAdmin(req, res, req.params.userId))) return;
        const rooms = await Room.find({ userId: req.params.userId });
        const hasRecurring = rooms.some((room) => room.recurring && room.recurring.enabled);
        if (hasRecurring) {
            return res.status(409).json({
                code: 'RECURRING_ACTIVE',
                message: 'Disable recurring invitations before deleting these rooms.',
            });
        }
        let deletedCount = 0;
        for (const room of rooms) {
            await ensureCalendarIdentity(room);
            const cancellation = await Room.findByIdAndUpdate(
                room._id,
                { $inc: { calendarSequence: 1 } },
                { returnDocument: 'after' }
            );
            await queueCalendarLifecycle(cancellation, 'cancellation');
            const deleted = await Room.findByIdAndDelete(room._id);
            if (deleted) deletedCount++;
        }
        log.debug('deleteAllRooms data', { deletedCount });
        deletedCount > 0
            ? res.json({ message: `${deletedCount} documents have been deleted` })
            : res.json({ message: 'No documents found' });
    } catch (error) {
        log.error('Room findByUserId delete error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomGet(req, res) {
    try {
        const data = await Room.findById(req.params.id);
        if (!data) {
            return res.status(404).json({ message: 'Room not found' });
        }
        if (!(await ensureOwnerOrAdmin(req, res, data.userId))) return;
        res.json(data);
    } catch (error) {
        log.error('Room findById error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomUpdate(req, res) {
    try {
        const id = req.params.id;
        const existing = await Room.findById(id).select('userId').lean();
        if (!existing) {
            return res.status(404).json({ message: 'Room not found' });
        }
        if (!(await ensureOwnerOrAdmin(req, res, existing.userId))) return;
        const allowedFields = ['type', 'tag', 'email', 'phone', 'date', 'time', 'timezone', 'duration', 'room'];
        const updatedData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) updatedData[field] = req.body[field];
        }
        if (updatedData.duration !== undefined) {
            updatedData.duration = normalizeDuration(updatedData.duration);
        }
        const current = await Room.findById(id);
        if (updatedData.date !== undefined || updatedData.time !== undefined || updatedData.timezone !== undefined) {
            const requestedTimezone = updatedData.timezone || current.timezone || 'UTC';
            const scheduleTimezone = normalizeTimezone(requestedTimezone);
            if (!scheduleTimezone) {
                return res.status(400).json({ message: 'Select a valid IANA timezone' });
            }
            const startAt = zonedDateTimeToUtc(
                updatedData.date || current.date,
                updatedData.time || current.time,
                scheduleTimezone
            );
            if (!startAt) {
                return res.status(400).json({ message: 'Select a valid meeting date, time, and timezone' });
            }
            updatedData.timezone = scheduleTimezone;
            updatedData.startAt = startAt;
        }
        if (
            current.reminder &&
            current.reminder.enabled &&
            (updatedData.date !== undefined || updatedData.time !== undefined || updatedData.timezone !== undefined)
        ) {
            const reminderAt = computeReminderAt(
                updatedData.date || current.date,
                updatedData.time || current.time,
                current.reminder.offsetMinutes,
                updatedData.timezone || current.timezone || 'UTC'
            );
            updatedData['reminder.scheduledFor'] = reminderAt;
            updatedData['reminder.enabled'] = !!(reminderAt && reminderAt.getTime() > Date.now());
            updatedData['reminder.timezone'] = updatedData.timezone || current.timezone || 'UTC';
            updatedData['reminder.status'] = updatedData['reminder.enabled'] ? 'scheduled' : 'canceled';
        }
        const calendarChanged = hasCalendarChanges(current, updatedData);
        if (calendarChanged) await ensureCalendarIdentity(current);
        const update = { $set: updatedData };
        if (calendarChanged) update.$inc = { calendarSequence: 1 };
        const options = { returnDocument: 'after' };
        const result = await Room.findByIdAndUpdate(id, update, options);
        if (calendarChanged) {
            const queued = await queueCalendarLifecycle(result, 'update');
            log.info('Calendar updates queued', { roomId: id, sequence: result.calendarSequence, queued });
        }
        res.send(result);
    } catch (error) {
        log.error('Room update error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDelete(req, res) {
    try {
        const id = req.params.id;
        const existing = await Room.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Room not found' });
        }
        if (!(await ensureOwnerOrAdmin(req, res, existing.userId))) return;
        if (existing.recurring && existing.recurring.enabled) {
            return res.status(409).json({
                code: 'RECURRING_ACTIVE',
                message: 'Disable recurring invitations before deleting this room.',
            });
        }
        await ensureCalendarIdentity(existing);
        const cancellation = await Room.findByIdAndUpdate(
            id,
            { $inc: { calendarSequence: 1 } },
            { returnDocument: 'after' }
        );
        const queued = await queueCalendarLifecycle(cancellation, 'cancellation');
        const data = await Room.findByIdAndDelete(id);
        log.info('Calendar cancellations queued', { roomId: id, sequence: cancellation.calendarSequence, queued });
        res.json({ message: `Document with ${data._id} has been deleted` });
    } catch (error) {
        log.error('Room delete error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDeleteALL(req, res) {
    return res.json({ message: '⚠️ Route disabled' });
    try {
        const data = await Room.deleteMany();
        data.deletedCount > 0
            ? res.json({ message: `${data.deletedCount} documents has been deleted` })
            : res.json({ message: 'No documents found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

module.exports = {
    roomCreate,
    roomExists,
    roomFindBy,
    roomDeleteFindBy,
    roomGet,
    roomUpdate,
    roomDelete,
    roomDeleteALL,
};
