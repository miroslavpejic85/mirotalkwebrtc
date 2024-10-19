'use strict';

const Room = require('../models/room');
const logs = require('../common/logs');

const log = new logs('Controllers-room');

async function roomCreate(req, res) {
    try {
        const { userId, type, tag, email, phone, date, time, room } = req.body;
        const data = new Room({
            userId: userId,
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

        res.status(201).json({ message: true })
    } catch (error) {
        log.error('Room exists error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomFindBy(req, res) {
    try {
        const data = await Room.find({ userId: req.params.userId });
        res.json(data);
    } catch (error) {
        log.error('Room findByUserId error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDeleteFindBy(req, res) {
    try {
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
        res.json(data);
    } catch (error) {
        log.error('Room findById error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomUpdate(req, res) {
    try {
        const id = req.params.id;
        const updatedData = req.body;
        const options = { new: true };
        const result = await Room.findByIdAndUpdate(id, updatedData, options);
        res.send(result);
    } catch (error) {
        log.error('Room update error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDelete(req, res) {
    try {
        const id = req.params.id;
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
