'use strict';

const crypto = require('crypto');
const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('API');

const API_SECRET_KEY = process.env.API_SECRET_KEY;

const api = (req, res, next) => {
    const api_secret_key = req.body && req.body.api_secret_key;

    if (!api_secret_key) {
        return res.status(404).json({ message: 'API Secret not found' });
    }

    const a = Buffer.from(String(API_SECRET_KEY));
    const b = Buffer.from(String(api_secret_key));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        log.debug('INVALID API SECRET KEY');
        return res.status(401).json({ message: 'API Secret invalid' });
    }

    return next();
};

module.exports = api;
