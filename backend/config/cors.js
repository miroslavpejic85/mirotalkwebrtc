'use strict';

const logs = require('../common/logs');
const log = new logs('CorsOptions');

const CORS_ORIGIN = process.env.CORS_ORIGIN;
const CORS_METHODS = process.env.CORS_METHODS;

const corsOptions = () => {
    let corsOrigin = '*';
    let corsMethods = ['GET', 'POST', 'PATCH', 'DELETE'];

    if (CORS_ORIGIN && CORS_ORIGIN !== '*') {
        try {
            corsOrigin = JSON.parse(CORS_ORIGIN);
        } catch (error) {
            log.error('Error parsing CORS_ORIGIN', error.message);
        }
    } else {
        const NODE_ENV = process.env.NODE_ENV || 'development';
        if (NODE_ENV === 'production') {
            log.warn('CORS origin is set to wildcard (*) in production. Consider restricting to specific origins.');
        }
    }

    if (CORS_METHODS && CORS_METHODS !== '') {
        try {
            corsMethods = JSON.parse(CORS_METHODS);
        } catch (error) {
            log.error('Error parsing CORS_METHODS', error.message);
        }
    }

    return {
        origin: corsOrigin,
        methods: corsMethods,
    };
};

module.exports = corsOptions;
