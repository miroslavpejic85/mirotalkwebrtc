'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('Demo');

const demo = async (req, res, next) => {
    const { email, username, password } = req.user || {};

    if (utils.isDemo(email, username, password)) {
        log.warn('Blocked demo user access to protected route', { email, username });
        return res.status(403).json({
            code: 'DEMO_ACCOUNT',
            message: 'This feature is not available for demo accounts. Please create a full account to continue.',
        });
    }

    return next();
};

module.exports = demo;
