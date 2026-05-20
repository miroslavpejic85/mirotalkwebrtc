'use strict';

const Room = require('../models/room');
const EmailInvitation = require('../models/emailInvitation');
const emailUtils = require('../common/emailUtils');
const emailQueue = require('./emailQueue');
const config = require('../config');
const logs = require('../common/logs');

const log = new logs('RecurringInvitations');

const SERVER_SIDE = process.env.EMAIL_INVITATION_SERVER_SIDE === 'true';
const ENABLED = SERVER_SIDE && process.env.EMAIL_INVITATION_RECURRING !== 'false';
const POLL_MS = Math.max(15000, Number(process.env.EMAIL_INVITATION_RECURRING_POLL_MS) || 60000);
const MAX_RECIPIENTS = Number(process.env.EMAIL_INVITATION_MAX_RECIPIENTS) || 50;
const DAILY_CAP = Number(process.env.EMAIL_INVITATION_DAILY_CAP_PER_USER) || 500;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let timer = null;
let running = false;
let stopped = false;

/**
 * Compute the most recent weekly occurrence of `date`+`time` at or before `now`.
 * Returns null if the base date is invalid or still in the future.
 */
function computeLastWeeklyOccurrence(date, time, now = new Date()) {
    if (!date || !time) return null;
    const base = new Date(`${date}T${time}:00`);
    const baseMs = base.getTime();
    if (Number.isNaN(baseMs)) return null;
    if (now.getTime() < baseMs) return null;
    const weeks = Math.floor((now.getTime() - baseMs) / WEEK_MS);
    return new Date(baseMs + weeks * WEEK_MS);
}

function buildRoomUrl(room) {
    const r = encodeURIComponent(room.room);
    switch (room.type) {
        case 'P2P':
            return `${config.MiroTalk.P2P.Join}${r}`;
        case 'SFU':
            return `${config.MiroTalk.SFU.Join}?room=${r}`;
        case 'C2C':
            return `${config.MiroTalk.C2C.Room}${r}`;
        case 'BRO':
            return `${config.MiroTalk.BRO.Viewer}${r}`;
        default:
            return '';
    }
}

/**
 * Enqueue invitation jobs for a single recurring room occurrence.
 * Uses an atomic conditional update on `recurring.lastSentAt` so concurrent
 * ticks (or multiple workers) never enqueue the same occurrence twice.
 */
async function dispatchOccurrence(room, occurrence) {
    const recipients = Array.isArray(room.recurring && room.recurring.recipients) ? room.recurring.recipients : [];
    if (recipients.length === 0) {
        log.warn('Recurring room has no recipients; skipping', { roomId: String(room._id) });
        return 0;
    }

    const classified = emailUtils.validateEmailList(recipients, { max: MAX_RECIPIENTS });
    if (classified.valid.length === 0) {
        log.warn('Recurring room recipients all invalid/blocked; skipping', {
            roomId: String(room._id),
            invalid: classified.invalid.length,
            blocked: classified.blocked.length,
        });
        return 0;
    }

    // Per-user daily cap (shared with on-demand invitations).
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sentToday = await EmailInvitation.countDocuments({
        userId: room.userId,
        createdAt: { $gte: startOfDay },
    });
    if (sentToday + classified.valid.length > DAILY_CAP) {
        log.warn('Recurring dispatch would exceed daily cap; skipping occurrence', {
            roomId: String(room._id),
            userId: room.userId,
            sentToday,
            attempted: classified.valid.length,
            cap: DAILY_CAP,
        });
        return 0;
    }

    const roomUrl = buildRoomUrl(room);
    if (!roomUrl) {
        log.warn('Recurring room has unsupported type; skipping', {
            roomId: String(room._id),
            type: room.type,
        });
        return 0;
    }

    // Atomic claim: only dispatch if no other tick has already marked this occurrence.
    const previousLastSent = room.recurring && room.recurring.lastSentAt;
    const claim = await Room.findOneAndUpdate(
        {
            _id: room._id,
            'recurring.enabled': true,
            $or: [
                { 'recurring.lastSentAt': { $exists: false } },
                { 'recurring.lastSentAt': null },
                { 'recurring.lastSentAt': previousLastSent || null },
            ],
        },
        { $set: { 'recurring.lastSentAt': occurrence, 'recurring.lastError': null } },
        { returnDocument: 'after' }
    );
    if (!claim) {
        log.debug('Occurrence already claimed by another tick', {
            roomId: String(room._id),
            occurrence,
        });
        return 0;
    }

    const subject = (
        (typeof room.recurring.subject === 'string' && room.recurring.subject.trim()) ||
        `Please join our MiroTalk ${room.type} Video Chat Meeting`
    ).slice(0, 200);
    const message = typeof room.recurring.message === 'string' ? room.recurring.message.slice(0, 2000) : undefined;

    const jobs = classified.valid.map((to) => ({
        userId: room.userId,
        roomId: String(room._id),
        roomType: room.type,
        room: room.room,
        roomUrl,
        date: room.date,
        time: room.time,
        subject,
        message,
        inviterName: room.recurring.inviterName,
        recipient: to,
    }));

    try {
        const queued = await emailQueue.enqueue(jobs);
        log.info('Recurring invitations queued', {
            roomId: String(room._id),
            userId: room.userId,
            occurrence,
            queued,
            invalid: classified.invalid.length,
            blocked: classified.blocked.length,
            duplicates: classified.duplicates,
        });
        return queued;
    } catch (err) {
        // Roll back the lastSentAt claim so the occurrence is retried on the next tick.
        await Room.updateOne(
            { _id: room._id },
            {
                $set: {
                    'recurring.lastSentAt': previousLastSent || null,
                    'recurring.lastError': String(err && err.message ? err.message : err),
                },
            }
        );
        log.error('Failed to enqueue recurring invitations', {
            roomId: String(room._id),
            error: err && err.message,
        });
        return 0;
    }
}

async function tick() {
    if (running || stopped) return;
    running = true;
    try {
        const now = new Date();
        const rooms = await Room.find({ 'recurring.enabled': true }).lean(false);
        if (rooms.length === 0) return;

        log.debug('Recurring tick', { candidates: rooms.length });

        for (const room of rooms) {
            try {
                const occurrence = computeLastWeeklyOccurrence(room.date, room.time, now);
                if (!occurrence) continue;
                const enabledAt = room.recurring && room.recurring.enabledAt;
                if (enabledAt && occurrence.getTime() < new Date(enabledAt).getTime()) continue;
                const lastSent = room.recurring && room.recurring.lastSentAt;
                if (lastSent && new Date(lastSent).getTime() >= occurrence.getTime()) continue;

                await dispatchOccurrence(room, occurrence);
            } catch (err) {
                log.error('Recurring per-room error', {
                    roomId: String(room._id),
                    error: err && err.message,
                });
            }
        }
    } catch (err) {
        log.error('Recurring tick error', { error: err && err.message });
    } finally {
        running = false;
    }
}

function start() {
    if (!ENABLED) {
        log.debug('Recurring invitations disabled');
        return;
    }
    if (timer) return;
    stopped = false;
    log.info('Recurring invitation scheduler starting', { pollMs: POLL_MS });
    // First tick shortly after boot so a freshly-enabled room can fire promptly.
    setTimeout(() => {
        tick().catch((err) => log.error('Unhandled recurring tick error', { error: err && err.message }));
    }, 2000);
    timer = setInterval(() => {
        tick().catch((err) => log.error('Unhandled recurring tick error', { error: err && err.message }));
    }, POLL_MS);
    if (timer.unref) timer.unref();
}

function stop() {
    stopped = true;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = {
    start,
    stop,
    tick, // exported for tests / manual triggers
    computeLastWeeklyOccurrence,
};
