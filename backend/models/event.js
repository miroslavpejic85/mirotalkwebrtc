'use strict';

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true },
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
        slug: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, trim: true, maxlength: 4000, default: '' },
        imageUrl: { type: String, trim: true, maxlength: 2048, default: '' },
        startAt: { type: Date, required: true, index: true },
        timezone: { type: String, required: true, default: 'UTC' },
        duration: { type: Number, required: true, min: 5, max: 1440, default: 60 },
        roomType: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO', 'CME'], default: 'SFU' },
        published: { type: Boolean, default: true },
    },
    { timestamps: true }
);

eventSchema.index({ userId: 1, startAt: 1 });

module.exports = mongoose.model('Event', eventSchema);
