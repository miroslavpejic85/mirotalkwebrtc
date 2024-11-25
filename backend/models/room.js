'use-strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    userId: { type: String, index: true },
    type: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO'] },
    tag: { type: String },
    email: { type: String },
    phone: { type: String },
    date: { type: String },
    time: { type: String },
    room: { type: String, index: true },
});

roomSchema.index({ type: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
