'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const validator = require('../middleware/validator');
const Room = require('../models/room');
const router = express.Router();

//CREATE: /api/v1/room

router.post('/room', auth, validator, async (req, res) => {
    try {
        const { userId, type, tag, email, date, time, room } = req.body;
        const data = new Room({
            userId: userId,
            type: type,
            tag: tag,
            email: email,
            date: date,
            time: time,
            room: room,
        });
        const dataToSave = await data.save();
        res.status(200).json(dataToSave);
    } catch (error) {
        console.error('Room create error', error);
        res.status(400).json({ message: error.message });
    }
});

//GET: /api/v1/room/findBy/userId

router.get('/room/findBy/:userId', auth, async (req, res) => {
    try {
        const data = await Room.find({ userId: req.params.userId });
        res.json(data);
    } catch (error) {
        console.error('Room findByUserId error', error);
        res.status(400).json({ message: error.message });
    }
});

//DELETE: /api/v1/findBy/userId

router.delete('/room/findBy/:userId', auth, async (req, res) => {
    try {
        const data = await Room.deleteMany({ userId: req.params.userId });
        console.log('deleAllRooms data', data);
        data.deletedCount > 0
            ? res.json({ message: `${data.deletedCount} documents has been deleted` })
            : res.json({ message: 'No documents found' });
    } catch (error) {
        console.error('Room findByUserId delete error', error);
        res.status(400).json({ message: error.message });
    }
});

//GET: /api/v1/room/id

router.get('/room/:id', auth, async (req, res) => {
    try {
        const data = await Room.findById(req.params.id);
        res.json(data);
    } catch (error) {
        console.error('Room findById error', error);
        res.status(400).json({ message: error.message });
    }
});

//UPDATE: /api/v1/room/id

router.patch('/room/:id', auth, validator, async (req, res) => {
    try {
        const id = req.params.id;
        const updatedData = req.body;
        const options = { new: true };
        const result = await Room.findByIdAndUpdate(id, updatedData, options);
        res.send(result);
    } catch (error) {
        console.error('Room update error', error);
        res.status(400).json({ message: error.message });
    }
});

//DELETE: /api/v1/room/id

router.delete('/room/:id', auth, async (req, res) => {
    try {
        const id = req.params.id;
        const data = await Room.findByIdAndDelete(id);
        res.json({ message: `Document with ${data._id} has been deleted` });
    } catch (error) {
        console.error('Room delete error', error);
        res.status(400).json({ message: error.message });
    }
});

//DELETE: /api/v1/room/deleteALL

router.delete('/room/deleteAll', auth, async (req, res) => {
    return res.json({ message: '⚠️ Route disabled' });
    try {
        const data = await Room.deleteMany();
        data.deletedCount > 0
            ? res.json({ message: `${data.deletedCount} documents has been deleted` })
            : res.json({ message: 'No documents found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
