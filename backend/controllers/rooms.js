'use strict';

const crypto = require('crypto');
const Room = require('../models/room');

function getUUID4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
    );
}

async function roomCreate(req, res) {
    try {
        // const { userId, type, tag, username, phone, date, time, room } = req.body;
        const { userId, type, hostUserID, clientUserID, startDateTime,endDateTime,status } = req.body;
        const data = new Room({
            userId: userId,
            type: type,
            hostUserID: hostUserID,
            clientUserID: clientUserID,
            startDateTime:startDateTime,
            endDateTime:endDateTime,
            status:status,
            room: getUUID4()
        });
        const dataToSave = await data.save();
        res.status(200).json(dataToSave);
    } catch (error) {
        console.error('Room create error', error);
        res.status(400).json({ message: error.message });
    }
}



async function getUserRole(req, res) {
    try {
        const data = await Room.find({ room: req.params.room });
        // res.json(req.params.userId );
        if (data.length === 0){
            console.error("Room Does Not Exist");
            res.json(data);
            res.status(404)
        }
        else
        {
            const room = data[0];
            // res.json(data); 
            if (room.hostUserID.includes(req.params.userId)) {
                // user_id is part of host
                res.json({ role: "host" });
            } else if (room.clientUserID.includes(req.params.userId)) {
                // user_id is part of client
                res.json({ role: "client" });
            } else {
                // user_id isn't part of host or client
                console.error('Not authorized to enter the meeting');
                res.status(401).json({ message: 'Unauthorized' });
            }   
        }
    } catch (error) {
        console.error('Room findById error', error);
        res.status(400).json({ message: error.message });
    }
}



async function roomFindBy(req, res) {
    try {
        const data = await Room.find({ userId: req.params.userId });
        res.json(data);
    } catch (error) {
        console.error('Room findByUserId error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDeleteFindBy(req, res) {
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
}

async function roomGet(req, res) {
    try {
        const data = await Room.findById(req.params.id);
        res.json(data);
    } catch (error) {
        console.error('Room findById error', error);
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
        console.error('Room update error', error);
        res.status(400).json({ message: error.message });
    }
}

async function roomDelete(req, res) {
    try {
        const id = req.params.id;
        const data = await Room.findByIdAndDelete(id);
        res.json({ message: `Document with ${data._id} has been deleted` });
    } catch (error) {
        console.error('Room delete error', error);
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
    roomFindBy,
    roomDeleteFindBy,
    roomGet,
    roomUpdate,
    roomDelete,
    roomDeleteALL,
    getUserRole
};
