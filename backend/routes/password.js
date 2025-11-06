'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/users');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const logs = require('../common/logs');
const { sendPasswordResetEmail, sendPasswordChangeConfirmation } = require('../lib/nodemailer');

const utils = require('../common/utils');
const { isValidEmail, isValidPassword } = utils;

const log = new logs('PasswordReset');

const SERVER_URL = process.env.SERVER_URL;

// Request password reset
router.post('/password/reset/request', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const validMail = isValidEmail(email);
        if (validMail !== true) {
            return res.status(400).json({ message: validMail });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        // Always return success to prevent email enumeration
        if (!user) {
            log.warn('Password reset requested for non-existent email', { email });
            return res.status(200).json({
                message: 'If an account exists with this email, you will receive a password reset link',
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set token and expiration (1 hour)
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Create reset URL
        const resetUrl = `${SERVER_URL}/reset-password?token=${resetToken}`;

        // Send email
        try {
            await sendPasswordResetEmail(user.username, user.email, resetUrl);
            log.info('Password reset email sent', { email: user.email });
        } catch (emailError) {
            log.error('Failed to send password reset email', { error: emailError.message });
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(500).json({ message: 'Error sending reset email' });
        }

        res.status(200).json({
            message: 'If an account exists with this email, you will receive a password reset link',
        });
    } catch (error) {
        log.error('Password reset request error', { error: error.message });
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify reset token
router.get('/password/reset/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                valid: false,
                message: 'Invalid or expired reset token',
            });
        }

        res.status(200).json({ valid: true });
    } catch (error) {
        log.error('Token verification error', { error: error.message });
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset password
router.post('/password/reset/confirm', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and password are required' });
        }

        const validPassword = isValidPassword(password);
        if (validPassword !== true) {
            return res.status(400).json({ message: validPassword });
        }

        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update password
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        log.info('Password reset successful', { email: user.email });

        // Send confirmation email
        try {
            await sendPasswordChangeConfirmation(user.username, user.email);
        } catch (emailError) {
            log.error('Failed to send confirmation email', { error: emailError.message });
        }

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        log.error('Password reset error', { error: error.message });
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
