'use strict';

const EmailInvitation = require('../models/emailInvitation');
const { sendRoomInvitationEmail } = require('./nodemailer');
const logs = require('../common/logs');

const log = new logs('EmailQueue');

const SERVER_SIDE = process.env.EMAIL_INVITATION_SERVER_SIDE === 'true';
const CONCURRENCY = Math.max(1, Number(process.env.EMAIL_INVITATION_QUEUE_CONCURRENCY) || 3);
const POLL_MS = Math.max(500, Number(process.env.EMAIL_INVITATION_QUEUE_POLL_MS) || 5000);
const RETRY_MAX = Math.max(0, Number(process.env.EMAIL_INVITATION_RETRY_MAX) || 5);
const RETRY_BACKOFF_MS = Math.max(1000, Number(process.env.EMAIL_INVITATION_RETRY_BACKOFF_MS) || 30000);

let timer = null;
let running = false;
let stopped = false;

/**
 * Persist a batch of invitation jobs. Each job becomes a pending document
 * the worker will pick up on its next tick.
 *
 * @param {Array<object>} jobs - Each must include the fields required by the EmailInvitation model.
 * @returns {Promise<number>} number of jobs inserted
 */
async function enqueue(jobs) {
    if (!Array.isArray(jobs) || jobs.length === 0) return 0;
    const docs = await EmailInvitation.insertMany(
        jobs.map((j) => ({ ...j, status: 'pending', nextAttemptAt: new Date() })),
        { ordered: false }
    );
    log.debug('Enqueued invitation jobs', { count: docs.length });
    return docs.length;
}

/**
 * Atomically claim one due pending job by flipping it to `sending`.
 * Returns the claimed document or null if none is ready.
 */
async function claimNextJob() {
    return EmailInvitation.findOneAndUpdate(
        { status: 'pending', nextAttemptAt: { $lte: new Date() } },
        { $set: { status: 'sending' }, $inc: { attempts: 1 } },
        { sort: { nextAttemptAt: 1, createdAt: 1 }, returnDocument: 'after' }
    );
}

async function processJob(job) {
    try {
        const info = await sendRoomInvitationEmail({
            to: job.recipient,
            subject: job.subject,
            roomUrl: job.roomUrl,
            roomType: job.roomType,
            room: job.room,
            date: job.date,
            time: job.time,
            durationMin: job.duration,
            inviterName: job.inviterName,
            message: job.message,
        });
        job.status = 'sent';
        job.sentAt = new Date();
        job.lastError = undefined;
        await job.save();
        log.info('Invitation sent', { to: job.recipient, room: job.room, messageId: info?.messageId });
    } catch (err) {
        const reachedMax = job.attempts >= RETRY_MAX;
        job.status = reachedMax ? 'dead' : 'pending';
        job.lastError = String(err && err.message ? err.message : err);
        if (!reachedMax) {
            // Exponential backoff: base * 2^(attempts-1)
            const delay = RETRY_BACKOFF_MS * Math.pow(2, Math.max(0, job.attempts - 1));
            job.nextAttemptAt = new Date(Date.now() + delay);
        }
        await job.save();
        const level = reachedMax ? 'error' : 'warn';
        log[level]('Invitation send failed', {
            to: job.recipient,
            attempts: job.attempts,
            status: job.status,
            error: job.lastError,
            nextAttemptAt: job.nextAttemptAt,
        });
    }
}

async function tick() {
    if (running || stopped) return;
    running = true;
    try {
        // Dispatch up to CONCURRENCY claimed jobs in parallel for this tick.
        const claimed = [];
        for (let i = 0; i < CONCURRENCY; i++) {
            const job = await claimNextJob();
            if (!job) break;
            claimed.push(job);
        }
        if (claimed.length === 0) return;
        await Promise.all(claimed.map(processJob));
    } catch (err) {
        log.error('Worker tick error', { error: err && err.message });
    } finally {
        running = false;
    }
}

/**
 * On startup, requeue any jobs left in `sending` from a previous process
 * that crashed mid-flight so they're retried instead of stuck forever.
 */
async function recoverInflight() {
    try {
        const res = await EmailInvitation.updateMany(
            { status: 'sending' },
            { $set: { status: 'pending', nextAttemptAt: new Date() } }
        );
        if (res.modifiedCount > 0) {
            log.warn('Recovered in-flight invitation jobs', { count: res.modifiedCount });
        }
    } catch (err) {
        log.error('Failed to recover in-flight jobs', { error: err && err.message });
    }
}

function start() {
    if (!SERVER_SIDE) {
        log.debug('Email invitation queue disabled (EMAIL_INVITATION_SERVER_SIDE=false)');
        return;
    }
    if (timer) return;
    stopped = false;
    log.info('Email invitation queue starting', {
        concurrency: CONCURRENCY,
        pollMs: POLL_MS,
        retryMax: RETRY_MAX,
        retryBackoffMs: RETRY_BACKOFF_MS,
    });
    recoverInflight().finally(() => {
        timer = setInterval(() => {
            tick().catch((err) => log.error('Unhandled tick error', { error: err && err.message }));
        }, POLL_MS);
        if (timer.unref) timer.unref();
    });
}

function stop() {
    stopped = true;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = { enqueue, start, stop };
