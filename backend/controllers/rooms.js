'use strict';

const Room = require('../models/room');
const User = require('../models/users');
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

async function roomCreate(req, res) {
    try {
        const { type, tag, email, phone, date, time, room } = req.body;

        // Derive userId server-side from authenticated user — never trust req.body.userId
        const authUserId = await getAuthUserId(req);
        if (!authUserId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const data = new Room({
            userId: authUserId,
            type: type,
            tag: tag,
            email: email,
            phone: phone,
            date: date,
            time: time,
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
        const hasRecurring = await Room.exists({
            userId: req.params.userId,
            'recurring.enabled': true,
        });
        if (hasRecurring) {
            return res.status(409).json({
                code: 'RECURRING_ACTIVE',
                message: 'Disable recurring invitations before deleting these rooms.',
            });
        }
        const data = await Room.deleteMany({ userId: req.params.userId });
        log.debug('deleAllRooms data', data);
        data.deletedCount > 0
            ? res.json({ message: `${data.deletedCount} documents has been deleted` })
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
        const allowedFields = ['type', 'tag', 'email', 'phone', 'date', 'time', 'room'];
        const updatedData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) updatedData[field] = req.body[field];
        }
        const options = { returnDocument: 'after' };
        const result = await Room.findByIdAndUpdate(id, { $set: updatedData }, options);
        res.send(result);
    } catch (error) {
        log.error('Room update error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDelete(req, res) {
    try {
        const id = req.params.id;
        const existing = await Room.findById(id).select('userId recurring').lean();
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
        const data = await Room.findByIdAndDelete(id);
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
