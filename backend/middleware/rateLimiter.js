'use strict';

const rateLimit = require('express-rate-limit');

const USER_MAX_LOGIN_ATTEMPTS = Number(process.env.USER_MAX_LOGIN_ATTEMPTS) || 5;
const USER_MIN_LOGIN_BLOCK_TIME = Number(process.env.USER_MIN_LOGIN_BLOCK_TIME) || 15; // minutes

const ipKeyGenerator = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'] || '';
    return forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || req.ip;
};

const loginLimiter = rateLimit({
    windowMs: USER_MIN_LOGIN_BLOCK_TIME * 60 * 1000,
    max: USER_MAX_LOGIN_ATTEMPTS,
    message: 'Too many login attempts, please try again later.',
    keyGenerator: (req) => req.body?.username || ipKeyGenerator(req),
    validate: false,
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many password reset requests, please try again later.',
    keyGenerator: (req) => req.body?.email || ipKeyGenerator(req),
    validate: false,
});

const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many registration attempts, please try again later.',
    keyGenerator: ipKeyGenerator,
    validate: false,
});

module.exports = { loginLimiter, passwordResetLimiter, registrationLimiter };
