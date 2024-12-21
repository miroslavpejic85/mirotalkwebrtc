'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('URL');

const url = (err, req, res, next) => {
    if (err instanceof URIError) {
        log.error('Malformed URL', req.url);
        res.status(400).send('Bad Request: Malformed URL');
    } else {
        next(err);
    }

    return next();
};

module.exports = url;
