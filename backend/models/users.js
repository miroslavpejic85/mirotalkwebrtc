'use-strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    role: { type: String, default: 'guest' },
    allow: { type: Array, default: ['ALL'] },
    email: { type: String, index: { unique: true } },
    username: { type: String },
    password: { type: String },
    token: { type: String },
    active: { type: Boolean, enum: [true, false], default: false },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() },
});

module.exports = mongoose.model('User', userSchema);
