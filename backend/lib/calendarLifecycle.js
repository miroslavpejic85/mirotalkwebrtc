'use strict';

const EmailInvitation = require('../models/emailInvitation');
const emailQueue = require('./emailQueue');
const config = require('../config');
const { buildLegacyCalendarUid } = require('../common/calendar');

const CALENDAR_FIELDS = ['type', 'date', 'time', 'timezone', 'startAt', 'duration', 'room'];

function buildRoomUrl(room) {
    const encodedRoom = encodeURIComponent(room.room);
    switch (room.type) {
        case 'P2P':
            return `${config.MiroTalk.P2P.Join}${encodedRoom}`;
        case 'SFU':
            return `${config.MiroTalk.SFU.Join}?room=${encodedRoom}`;
        case 'C2C':
            return `${config.MiroTalk.C2C.Room}${encodedRoom}`;
        case 'BRO':
            return `${config.MiroTalk.BRO.Viewer}${encodedRoom}`;
        case 'CME':
            return `${config.MiroTalk.CME.Room}${encodedRoom}`;
        default:
            return '';
    }
}

function comparable(value) {
    if (value instanceof Date) return value.getTime();
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function hasCalendarChanges(current, updatedData) {
    return CALENDAR_FIELDS.some(
        (field) => updatedData[field] !== undefined && comparable(updatedData[field]) !== comparable(current[field])
    );
}

async function ensureCalendarIdentity(room) {
    if (!room.calendarUid) {
        room.calendarUid = buildLegacyCalendarUid(room.room, room.startAt, room.date, room.time);
        room.calendarSequence = Number(room.calendarSequence) || 0;
        await room.save();
    }
    return room;
}

async function getCalendarAudience(room, includePending) {
    const recipients = new Set(Array.isArray(room.calendarRecipients) ? room.calendarRecipients : []);
    const statuses = includePending ? ['pending', 'sent', 'sending'] : ['sent', 'sending'];
    const delivered = await EmailInvitation.find({
        roomId: String(room._id),
        calendarUid: room.calendarUid,
        kind: { $in: ['invitation', 'reminder', 'update'] },
        status: { $in: statuses },
    })
        .select('recipient inviterName')
        .lean();
    for (const job of delivered) recipients.add(job.recipient);
    const inviterName = delivered.find((job) => job.inviterName)?.inviterName;
    return { recipients: [...recipients].filter(Boolean), inviterName };
}

function buildLifecycleJobs(room, recipients, kind, inviterName) {
    const roomUrl = buildRoomUrl(room);
    if (!roomUrl) return [];
    const cancellation = kind === 'cancellation';
    const subject = cancellation
        ? `Canceled: MiroTalk ${room.type} meeting ${room.room}`
        : `Updated: MiroTalk ${room.type} meeting ${room.room}`;
    return recipients.map((recipient) => ({
        kind,
        userId: room.userId,
        roomId: String(room._id),
        roomType: room.type,
        room: room.room,
        roomUrl,
        date: room.date,
        time: room.time,
        timezone: room.timezone,
        startAt: room.startAt,
        duration: room.duration || undefined,
        calendarUid: room.calendarUid,
        calendarSequence: room.calendarSequence,
        subject,
        inviterName,
        recipient,
    }));
}

async function queueCalendarLifecycle(room, kind) {
    await ensureCalendarIdentity(room);
    const { recipients, inviterName } = await getCalendarAudience(room, kind === 'update');

    const jobs = buildLifecycleJobs(room, recipients, kind, inviterName);
    const queued = await emailQueue.enqueue(jobs);
    await EmailInvitation.updateMany(
        {
            roomId: String(room._id),
            calendarUid: room.calendarUid,
            calendarSequence: { $lt: room.calendarSequence },
            status: 'pending',
        },
        { $set: { status: 'superseded', lastError: `${kind} sequence ${room.calendarSequence} queued` } }
    );
    return queued;
}

module.exports = {
    hasCalendarChanges,
    ensureCalendarIdentity,
    queueCalendarLifecycle,
};
