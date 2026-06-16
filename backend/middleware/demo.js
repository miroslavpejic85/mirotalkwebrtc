'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('Demo');

const demo = async (req, res, next) => {
    // JWT token authentication (standard mode, or API access in OIDC mode)
    let token =
        req?.body?.token ||
        req?.query?.token ||
        req?.headers['x-access-token'] ||
        req?.headers['authorization'] ||
        req?.headers['Authorization'];

    if (!token) {
        if (req.accepts('html')) {
            return res.redirect('/');
        }
        return res.status(404).json({ message: 'Token not found' });
    }

    try {
        const parts = token.split(' ');
        if (parts.length === 2) {
            const scheme = parts[0];
            const credentials = parts[1];
            if (/^Bearer$/i.test(scheme)) token = credentials;
        }

        const decoded = utils.tokenDecode(token);

        log.debug('jwt demo decoded', decoded);

        const { email, username, password } = decoded;

        if (utils.isDemo(email, username, password)) {
            log.warn('Blocked demo user access to protected route', { email, username });
            return res.status(403).json({
                message: 'This feature is not available for demo accounts. Please create a full account to continue.',
            });
        }
    } catch (err) {
        if (req.accepts('html')) {
            return res.redirect('/');
        }
        return res.status(401).json({ message: 'Token invalid or expired' });
    }
    return next();
};

module.exports = demo;
