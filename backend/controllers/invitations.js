'use strict';

const Room = require('../models/room');
const User = require('../models/users');
const EmailInvitation = require('../models/emailInvitation');
const utils = require('../common/utils');
const emailUtils = require('../common/emailUtils');
const emailQueue = require('../lib/emailQueue');
const config = require('../config');
const logs = require('../common/logs');

const log = new logs('Controllers-invitations');

const MAX_RECIPIENTS = Number(process.env.EMAIL_INVITATION_MAX_RECIPIENTS) || 50;
const DAILY_CAP = Number(process.env.EMAIL_INVITATION_DAILY_CAP_PER_USER) || 500;

async function getAuthUserId(req) {
    if (!req.user) return null;
    const { email, username } = req.user;
    const user = await User.findOne({ email, username }).select('_id').lean();
    return user ? String(user._id) : null;
}

async function ensureOwnerOrAdmin(req, res, targetUserId) {
    const isAdmin = await utils.isAdmin(req.user.email, req.user.username, req.user.password);
    if (isAdmin) return { ok: true, authUserId: await getAuthUserId(req), isAdmin: true };
    const authUserId = await getAuthUserId(req);
    if (!authUserId || authUserId !== String(targetUserId)) {
        res.status(403).json({ message: 'Access denied' });
        return { ok: false };
    }
    return { ok: true, authUserId, isAdmin: false };
}

/**
 * Build the join URL server-side from config + the persisted room record.
 * Never trust a client-supplied URL — recipients should land on the same room
 * the inviter actually owns.
 */
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

async function sendRoomInvitation(req, res) {
    try {
        if (!config.EMAIL_INVITATION || !config.EMAIL_INVITATION.serverSide) {
            return res.status(403).json({ message: 'Server-side email invitations are disabled' });
        }

        const { roomId, recipients, subject, message } = req.body || {};
        if (!roomId) {
            return res.status(400).json({ message: 'roomId is required' });
        }

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const auth = await ensureOwnerOrAdmin(req, res, room.userId);
        if (!auth.ok) return; // response already sent

        // Parse & validate recipients (single string, comma/newline list, or array).
        const parsed = emailUtils.parseRecipients(recipients);
        if (parsed.length === 0) {
            return res.status(400).json({ message: 'At least one recipient is required' });
        }
        const classified = emailUtils.validateEmailList(parsed, { max: MAX_RECIPIENTS });

        if (classified.valid.length === 0) {
            return res.status(400).json({
                message: 'No valid recipients',
                invalid: classified.invalid,
                blocked: classified.blocked,
                duplicates: classified.duplicates,
            });
        }
        if (classified.exceededMax) {
            return res.status(400).json({
                message: `Too many recipients (max ${MAX_RECIPIENTS} per request)`,
                valid: classified.valid.length,
                max: MAX_RECIPIENTS,
            });
        }

        // Enforce per-user daily cap by counting today's invitations.
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const sentToday = await EmailInvitation.countDocuments({
            userId: auth.authUserId,
            createdAt: { $gte: startOfDay },
        });
        if (sentToday + classified.valid.length > DAILY_CAP) {
            return res.status(429).json({
                message: `Daily invitation cap reached (${DAILY_CAP})`,
                sentToday,
                attempted: classified.valid.length,
                cap: DAILY_CAP,
            });
        }

        const roomUrl = buildRoomUrl(room);
        if (!roomUrl) {
            return res.status(400).json({ message: `Unsupported room type: ${room.type}` });
        }

        const safeSubject =
            (typeof subject === 'string' && subject.trim()) ||
            `Please join our MiroTalk ${room.type} Video Chat Meeting`;
        const safeMessage = typeof message === 'string' ? message.slice(0, 2000) : undefined;
        const inviterName = req.user?.username || req.user?.email;

        const jobs = classified.valid.map((to) => ({
            userId: auth.authUserId,
            roomId: String(room._id),
            roomType: room.type,
            room: room.room,
            roomUrl,
            date: room.date,
            time: room.time,
            subject: safeSubject,
            message: safeMessage,
            inviterName,
            recipient: to,
        }));

        const queued = await emailQueue.enqueue(jobs);
        log.info('Room invitations queued', {
            userId: auth.authUserId,
            roomId: String(room._id),
            queued,
            invalid: classified.invalid.length,
            blocked: classified.blocked.length,
            duplicates: classified.duplicates,
        });

        return res.status(200).json({
            message: `${queued} invitation${queued === 1 ? '' : 's'} queued`,
            queued,
            invalid: classified.invalid,
            blocked: classified.blocked,
            duplicates: classified.duplicates,
        });
    } catch (error) {
        log.error('Room invitation error', error);
        return res.status(400).json({ message: error.message });
    }
}

module.exports = { sendRoomInvitation };
