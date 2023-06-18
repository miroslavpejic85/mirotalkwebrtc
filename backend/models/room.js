'use-strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    userId: { type: String, unique: false },
    type: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO'] },
    tag: { type: String },
    email: { type: String },
    date: { type: String },
    time: { type: String },
    room: { type: String },
});

module.exports = mongoose.model('Room', roomSchema);
