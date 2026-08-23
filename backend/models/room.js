'use strict';

const mongoose = require('mongoose');
const { createCalendarUid } = require('../common/calendar');

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

const reminderSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: false },
        offsetMinutes: { type: Number, min: 1, max: 10080 },
        timezoneOffset: { type: Number, min: -840, max: 840, default: 0 },
        timezone: { type: String },
        deliveryId: { type: String },
        status: {
            type: String,
            enum: ['scheduled', 'queued', 'retrying', 'sent', 'failed', 'canceled'],
        },
        attempts: { type: Number, default: 0 },
        recipients: [{ type: String, lowercase: true, trim: true }],
        subject: { type: String },
        message: { type: String },
        inviterName: { type: String },
        scheduledFor: { type: Date },
        queuedAt: { type: Date },
        sentAt: { type: Date },
        lastError: { type: String },
    },
    { _id: false }
);

const roomSchema = new mongoose.Schema({
    userId: { type: String, index: true },
    type: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO', 'CME'] },
    tag: { type: String },
    email: { type: String },
    phone: { type: String },
    date: { type: String },
    time: { type: String },
    timezone: { type: String, default: 'UTC' },
    startAt: { type: Date, index: true },
    // Meeting duration in minutes (user-defined per room).
    // When set, propagates into the .ics DTEND and the email/tooltip "Duration" row,
    // overriding the EMAIL_INVITATION_ICS_DURATION_MIN env default.
    duration: { type: Number, min: 5, max: 1440, default: null },
    room: { type: String, index: true },
    calendarUid: { type: String, default: createCalendarUid, index: true },
    calendarSequence: { type: Number, min: 0, default: 0 },
    calendarRecipients: [{ type: String, lowercase: true, trim: true }],
    recurring: { type: recurringSchema, default: () => ({ enabled: false }) },
    reminder: { type: reminderSchema, default: () => ({ enabled: false }) },
});

roomSchema.index({ type: 1, room: 1 }, { unique: true });
roomSchema.index({ 'recurring.enabled': 1 });
roomSchema.index({ 'reminder.enabled': 1, 'reminder.scheduledFor': 1 });

module.exports = mongoose.model('Room', roomSchema);
