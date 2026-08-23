'use strict';

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        profileId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'BookingProfile', index: true },
        userId: { type: String, required: true, index: true },
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true },
        guestName: { type: String, required: true, trim: true, maxlength: 100 },
        guestEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
        guestNotes: { type: String, default: '', trim: true, maxlength: 2000 },
        startAt: { type: Date, required: true, index: true },
        endAt: { type: Date, required: true },
        occupiedStartAt: { type: Date, required: true },
        occupiedEndAt: { type: Date, required: true },
        occupiedStarts: [{ type: Date, required: true }],
        timezone: { type: String, required: true },
        status: { type: String, enum: ['confirmed', 'canceled'], default: 'confirmed', index: true },
        cancelTokenHash: { type: String, required: true, unique: true, select: false },
        canceledAt: { type: Date },
    },
    { timestamps: true }
);

bookingSchema.index(
    { profileId: 1, occupiedStarts: 1 },
    { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

module.exports = mongoose.model('Booking', bookingSchema);
