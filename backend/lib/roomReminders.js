'use strict';

const Room = require('../models/room');
const EmailInvitation = require('../models/emailInvitation');
const emailUtils = require('../common/emailUtils');
const emailQueue = require('./emailQueue');
const config = require('../config');
const { zonedDateTimeToUtc } = require('../common/schedule');
const logs = require('../common/logs');

const log = new logs('RoomReminders');

const SERVER_SIDE = process.env.EMAIL_INVITATION_SERVER_SIDE === 'true';
const ENABLED = SERVER_SIDE && process.env.EMAIL_INVITATION_REMINDERS !== 'false';
const POLL_MS = Math.max(15000, Number(process.env.EMAIL_INVITATION_REMINDER_POLL_MS) || 60000);
const MAX_RECIPIENTS = Number(process.env.EMAIL_INVITATION_MAX_RECIPIENTS) || 50;
const DAILY_CAP = Number(process.env.EMAIL_INVITATION_DAILY_CAP_PER_USER) || 500;

let timer = null;
let running = false;
let stopped = false;

function computeReminderAt(date, time, offsetMinutes, timezone = 0) {
    const normalizedOffset = Number(offsetMinutes);
    if (!date || !time || !Number.isInteger(normalizedOffset) || normalizedOffset < 1 || normalizedOffset > 10080) {
        return null;
    }
    if (typeof timezone === 'string') {
        const meetingAt = zonedDateTimeToUtc(date, time, timezone);
        return meetingAt ? new Date(meetingAt.getTime() - normalizedOffset * 60 * 1000) : null;
    }
    const dateParts = String(date).split('-').map(Number);
    const timeParts = String(time).split(':').map(Number);
    const normalizedTimezoneOffset = Number(timezone);
    if (
        dateParts.length !== 3 ||
        timeParts.length < 2 ||
        [...dateParts, ...timeParts].some((part) => !Number.isInteger(part)) ||
        !Number.isFinite(normalizedTimezoneOffset) ||
        normalizedTimezoneOffset < -840 ||
        normalizedTimezoneOffset > 840
    ) {
        return null;
    }
    const [year, month, day] = dateParts;
    const [hour, minute] = timeParts;
    const meetingAt = new Date(Date.UTC(year, month - 1, day, hour, minute) + normalizedTimezoneOffset * 60 * 1000);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
    }
    return new Date(meetingAt.getTime() - normalizedOffset * 60 * 1000);
}

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

async function dispatchReminder(room) {
    const recipients = Array.isArray(room.reminder && room.reminder.recipients) ? room.reminder.recipients : [];
    const classified = emailUtils.validateEmailList(recipients, { max: MAX_RECIPIENTS });
    if (classified.valid.length === 0) return 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sentToday = await EmailInvitation.countDocuments({
        userId: room.userId,
        createdAt: { $gte: startOfDay },
    });
    if (sentToday + classified.valid.length > DAILY_CAP) {
        log.warn('Reminder would exceed daily cap; skipping', { roomId: String(room._id) });
        return 0;
    }

    const scheduledFor = room.reminder && room.reminder.scheduledFor;
    const claim = await Room.findOneAndUpdate(
        {
            _id: room._id,
            'reminder.enabled': true,
            'reminder.scheduledFor': scheduledFor,
        },
        {
            $set: {
                'reminder.enabled': false,
                'reminder.status': 'queued',
                'reminder.queuedAt': new Date(),
                'reminder.lastError': null,
            },
        },
        { returnDocument: 'after' }
    );
    if (!claim) return 0;

    const roomUrl = buildRoomUrl(room);
    if (!roomUrl) return 0;

    const jobs = classified.valid.map((recipient) => ({
        kind: 'reminder',
        deliveryId: room.reminder.deliveryId,
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
        subject: room.reminder.subject || `Reminder: MiroTalk ${room.type} meeting starts soon`,
        message: room.reminder.message,
        inviterName: room.reminder.inviterName,
        recipient,
    }));

    try {
        const queued = await emailQueue.enqueue(jobs);
        log.info('Room reminders queued', { roomId: String(room._id), queued });
        return queued;
    } catch (error) {
        await Room.updateOne(
            { _id: room._id, 'reminder.scheduledFor': scheduledFor },
            {
                $set: {
                    'reminder.enabled': true,
                    'reminder.status': 'scheduled',
                    'reminder.queuedAt': null,
                    'reminder.lastError': String(error && error.message ? error.message : error),
                },
            }
        );
        log.error('Failed to enqueue room reminder', { roomId: String(room._id), error: error && error.message });
        return 0;
    }
}

async function tick() {
    if (running || stopped) return;
    running = true;
    try {
        const rooms = await Room.find({
            'reminder.enabled': true,
            'reminder.scheduledFor': { $lte: new Date() },
        }).lean(false);
        for (const room of rooms) {
            try {
                await dispatchReminder(room);
            } catch (error) {
                log.error('Room reminder error', { roomId: String(room._id), error: error && error.message });
            }
        }
    } catch (error) {
        log.error('Room reminder tick error', { error: error && error.message });
    } finally {
        running = false;
    }
}

function start() {
    if (!ENABLED) {
        log.debug('Room reminders disabled');
        return;
    }
    if (timer) return;
    stopped = false;
    log.info('Room reminder scheduler starting', { pollMs: POLL_MS });
    setTimeout(() => tick().catch((error) => log.error('Unhandled reminder tick error', error)), 2000);
    timer = setInterval(() => tick().catch((error) => log.error('Unhandled reminder tick error', error)), POLL_MS);
    if (timer.unref) timer.unref();
}

function stop() {
    stopped = true;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = { start, stop, tick, computeReminderAt };
