'use strict';

const mongoose = require('mongoose');

const recurringSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: false },
        recipients: [{ type: String, lowercase: true, trim: true }],
        subject: { type: String },
        message: { type: String },
        inviterName: { type: String },
        enabledAt: { type: Date },
        lastSentAt: { type: Date },
        lastError: { type: String },
    },
    { _id: false }
);

const roomSchema = new mongoose.Schema({
    userId: { type: String, index: true },
    type: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO'] },
    tag: { type: String },
    email: { type: String },
    phone: { type: String },
    date: { type: String },
    time: { type: String },
    room: { type: String, index: true },
    recurring: { type: recurringSchema, default: () => ({ enabled: false }) },
});

roomSchema.index({ type: 1, room: 1 }, { unique: true });
roomSchema.index({ 'recurring.enabled': 1 });

module.exports = mongoose.model('Room', roomSchema);
