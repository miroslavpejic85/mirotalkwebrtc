'use strict';

const logs = require('../common/logs');
const log = new logs('URL');

const url = (req, res, next) => {
    try {
        decodeURIComponent(req.path);
        next();
    } catch (err) {
        if (err instanceof URIError) {
            log.error('Malformed URL', req.url);
            return res.status(400).json({ error: 'Bad Request: Malformed URL' });
        }
        next(err);
    }
};

module.exports = url;
