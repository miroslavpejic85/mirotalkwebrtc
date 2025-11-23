'use strict';

const rateLimit = require('express-rate-limit');

const USER_MAX_LOGIN_ATTEMPTS = process.env.USER_MAX_LOGIN_ATTEMPTS || 5;
const USER_MIN_LOGIN_BLOCK_TIME = process.env.USER_MIN_LOGIN_BLOCK_TIME || 15; // in minutes

const loginLimiter = rateLimit({
    windowMs: USER_MIN_LOGIN_BLOCK_TIME * 60 * 1000, // 15 minutes default
    max: USER_MAX_LOGIN_ATTEMPTS,
    message: 'Too many login attempts, please try again later.',
    keyGenerator: (req) => req.body.username || ipKeyGenerator(req),
});

module.exports = { loginLimiter };
