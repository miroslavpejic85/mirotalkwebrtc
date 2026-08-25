'use strict';

const crypto = require('crypto');
const Event = require('../models/event');
const Room = require('../models/room');
const User = require('../models/users');
const { normalizeTimezone, zonedDateTimeToUtc, getZonedParts } = require('../common/schedule');
const config = require('../config');
const logs = require('../common/logs');

const log = new logs('Controllers-events');
const ROOM_TYPES = new Set(['P2P', 'SFU', 'C2C', 'BRO', 'CME']);

function pad(value) {
    return String(value).padStart(2, '0');
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

function eventPayload(event, room, organizer) {
    return {
        id: String(event._id),
        slug: event.slug,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl || '',
        startAt: event.startAt,
        timezone: event.timezone,
        duration: event.duration,
        roomType: event.roomType,
        published: event.published,
        roomUrl: room ? roomUrl(room) : '',
        organizer: organizer?.username || '',
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
    };
}

function scheduleInput(body) {
    const timezone = normalizeTimezone(body.timezone || 'UTC');
    const startAt = timezone && zonedDateTimeToUtc(body.date, body.time, timezone);
    const duration = Number(body.duration);
    if (!timezone || !startAt) return { error: 'Select a valid event date, time, and timezone' };
    if (!Number.isInteger(duration) || duration < 5 || duration > 1440) {
        return { error: 'Duration must be between 5 and 1440 minutes' };
    }
    return { timezone, startAt, duration };
}

function textInput(body) {
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const imageUrl = String(body.imageUrl || '').trim();
    if (!title) return { error: 'Event title is required' };
    if (title.length > 120) return { error: 'Event title cannot exceed 120 characters' };
    if (description.length > 4000) return { error: 'Event description cannot exceed 4000 characters' };
    if (imageUrl.length > 2048) return { error: 'Event image URL cannot exceed 2048 characters' };
    if (imageUrl) {
        try {
            const parsed = new URL(imageUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
        } catch (_) {
            return { error: 'Enter a valid HTTP or HTTPS image URL' };
        }
    }
    return { title, description, imageUrl };
}

function localSchedule(instant, timezone) {
    const parts = getZonedParts(instant, timezone);
    return {
        date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
        time: `${pad(parts.hour)}:${pad(parts.minute)}`,
    };
}

async function createEvent(req, res) {
    let room;
    try {
        const owner = await authUser(req);
        if (!owner) return res.status(403).json({ message: 'Access denied' });
        const text = textInput(req.body);
        if (text.error) return res.status(400).json({ message: text.error });
        const schedule = scheduleInput(req.body);
        if (schedule.error) return res.status(400).json({ message: schedule.error });
        const roomType = ROOM_TYPES.has(req.body.roomType) ? req.body.roomType : 'SFU';
        const roomName = `event-${crypto.randomBytes(12).toString('hex')}`;

        room = await Room.create({
            userId: String(owner._id),
            type: roomType,
            tag: text.title,
            email: owner.email,
            date: req.body.date,
            time: req.body.time,
            timezone: schedule.timezone,
            startAt: schedule.startAt,
            duration: schedule.duration,
            room: roomName,
        });
        const event = await Event.create({
            userId: String(owner._id),
            roomId: room._id,
            slug: `${
                text.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 48) || 'event'
            }-${crypto.randomBytes(4).toString('hex')}`,
            title: text.title,
            description: text.description,
            imageUrl: text.imageUrl,
            startAt: schedule.startAt,
            timezone: schedule.timezone,
            duration: schedule.duration,
            roomType,
            published: req.body.published !== false,
        });
        res.status(201).json(eventPayload(event, room, owner));
    } catch (error) {
        if (room?._id) await Room.findByIdAndDelete(room._id).catch(() => {});
        log.error('Event create error', error);
        res.status(400).json({ message: error.message });
    }
}

async function listEvents(req, res) {
    try {
        const owner = await authUser(req);
        if (!owner) return res.status(403).json({ message: 'Access denied' });
        const events = await Event.find({ userId: String(owner._id) })
            .sort({ startAt: 1 })
            .lean();
        const rooms = await Room.find({ _id: { $in: events.map((event) => event.roomId) } }).lean();
        const roomById = new Map(rooms.map((room) => [String(room._id), room]));
        res.json(events.map((event) => eventPayload(event, roomById.get(String(event.roomId)), owner)));
    } catch (error) {
        log.error('Event list error', error);
        res.status(400).json({ message: error.message });
    }
}

async function updateEvent(req, res) {
    try {
        const owner = await authUser(req);
        if (!owner) return res.status(403).json({ message: 'Access denied' });
        const event = await Event.findOne({ _id: req.params.id, userId: String(owner._id) });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const text = textInput(req.body);
        if (text.error) return res.status(400).json({ message: text.error });
        const schedule = scheduleInput(req.body);
        if (schedule.error) return res.status(400).json({ message: schedule.error });
        const roomType = ROOM_TYPES.has(req.body.roomType) ? req.body.roomType : event.roomType;

        Object.assign(event, {
            title: text.title,
            description: text.description,
            imageUrl: text.imageUrl,
            startAt: schedule.startAt,
            timezone: schedule.timezone,
            duration: schedule.duration,
            roomType,
            published: req.body.published !== false,
        });
        const room = await Room.findByIdAndUpdate(
            event.roomId,
            {
                $set: {
                    type: roomType,
                    tag: text.title,
                    date: req.body.date,
                    time: req.body.time,
                    timezone: schedule.timezone,
                    startAt: schedule.startAt,
                    duration: schedule.duration,
                },
            },
            { returnDocument: 'after' }
        );
        await event.save();
        res.json(eventPayload(event, room, owner));
    } catch (error) {
        log.error('Event update error', error);
        res.status(400).json({ message: error.message });
    }
}

async function deleteEvent(req, res) {
    try {
        const owner = await authUser(req);
        if (!owner) return res.status(403).json({ message: 'Access denied' });
        const event = await Event.findOneAndDelete({ _id: req.params.id, userId: String(owner._id) });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        await Room.findByIdAndDelete(event.roomId);
        res.json({ message: 'Event deleted' });
    } catch (error) {
        log.error('Event delete error', error);
        res.status(400).json({ message: error.message });
    }
}

async function getPublicEvent(req, res) {
    try {
        const event = await Event.findOne({ slug: req.params.slug, published: true }).lean();
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const [room, organizer] = await Promise.all([
            Room.findById(event.roomId).lean(),
            User.findById(event.userId).select('username').lean(),
        ]);
        if (!room) return res.status(404).json({ message: 'Event room not found' });
        res.json(eventPayload(event, room, organizer));
    } catch (error) {
        log.error('Public event error', error);
        res.status(400).json({ message: error.message });
    }
}

module.exports = {
    createEvent,
    listEvents,
    updateEvent,
    deleteEvent,
    getPublicEvent,
    localSchedule,
    roomUrl,
    scheduleInput,
    textInput,
};
