'use strict';

const mongoose = require('mongoose');

/**
 * Persistent queue document for server-side room invitation emails.
 *
 * Lifecycle:
 *   pending  -> sending  -> sent
 *                       \-> failed -> pending (with backoff) -> ... -> dead
 *
 * The worker in lib/emailQueue.js claims jobs by atomically transitioning
 * `pending -> sending` via findOneAndUpdate, dispatches them through the
 * nodemailer transport, then sets `sent` or schedules a retry.
 */
const emailInvitationSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true }, // inviter
        roomId: { type: String, required: true },
        roomType: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO'], required: true },
        room: { type: String, required: true },
        roomUrl: { type: String, required: true },
        date: { type: String },
        time: { type: String },
        subject: { type: String, required: true },
        message: { type: String },
        inviterName: { type: String },
        recipient: { type: String, required: true, lowercase: true, trim: true },
        status: {
            type: String,
            enum: ['pending', 'sending', 'sent', 'failed', 'dead'],
            default: 'pending',
            index: true,
        },
        attempts: { type: Number, default: 0 },
        lastError: { type: String },
        nextAttemptAt: { type: Date, default: () => new Date() },
        sentAt: { type: Date },
    },
    { timestamps: true } // adds createdAt, updatedAt
);

// Worker poll selector: pick due pending jobs in FIFO order.
emailInvitationSchema.index({ status: 1, nextAttemptAt: 1 });
// Daily-cap counter: count today's documents per user.
emailInvitationSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('EmailInvitation', emailInvitationSchema);
