const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    role: { type: String, default: 'guest' },
    email: { type: String, index: { unique: true } },
    password: { type: String },
    token: { type: String },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() },
});

module.exports = mongoose.model('User', userSchema);
