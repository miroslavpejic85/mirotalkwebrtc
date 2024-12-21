'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('API');

const API_SECRET_KEY = process.env.API_SECRET_KEY;

const api = (req, res, next) => {
    const { api_secret_key } = req.body;

    if (!api_secret_key) {
        return res.status(404).json({ message: 'API Secret not found' });
    }

    if (API_SECRET_KEY != api_secret_key) {
        log.debug('INVALID API SECRET KEY', api_secret_key);
        return res.status(401).json({ message: 'API Secret invalid' });
    }

    return next();
};

module.exports = api;
