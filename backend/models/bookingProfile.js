'use strict';

const mongoose = require('mongoose');

const intervalSchema = new mongoose.Schema(
    {
        start: { type: String, required: true },
        end: { type: String, required: true },
    },
    { _id: false }
);

const bookingProfileSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, unique: true, index: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        enabled: { type: Boolean, default: false },
        displayName: { type: String, required: true, trim: true, maxlength: 100 },
        title: { type: String, default: 'Meet with me', trim: true, maxlength: 120 },
        description: { type: String, default: '', trim: true, maxlength: 1000 },
        timezone: { type: String, required: true, default: 'UTC' },
        roomType: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO', 'CME'], default: 'P2P' },
        durationMinutes: { type: Number, min: 5, max: 480, default: 30 },
        bufferBeforeMinutes: { type: Number, min: 0, max: 240, default: 0 },
        bufferAfterMinutes: { type: Number, min: 0, max: 240, default: 0 },
        minimumNoticeMinutes: { type: Number, min: 0, max: 43200, default: 240 },
        bookingWindowDays: { type: Number, min: 1, max: 365, default: 60 },
        weeklyHours: [
            new mongoose.Schema(
                {
                    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
                    intervals: [intervalSchema],
                },
                { _id: false }
            ),
        ],
        dateOverrides: [
            new mongoose.Schema(
                {
                    date: { type: String, required: true },
                    available: { type: Boolean, default: false },
                    intervals: [intervalSchema],
                },
                { _id: false }
            ),
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('BookingProfile', bookingProfileSchema);
