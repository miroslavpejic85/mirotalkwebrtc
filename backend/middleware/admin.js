'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');
const { isOidcEnabled } = require('./oidc');
const User = require('../models/users');

const log = new logs('Admin');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const admin = async (req, res, next) => {
    // OIDC authentication: check session first when enabled
    if (isOidcEnabled() && req.oidc && req.oidc.isAuthenticated()) {
        try {
            const oidcUser = req.oidc.user;
            const email = oidcUser.email;
            const username = oidcUser.nickname || oidcUser.name || email.split('@')[0];

            const dbUser = await User.findOne({ email }).select('role username').lean();
            const isAdmin =
                (email === ADMIN_EMAIL && (username === ADMIN_USERNAME || dbUser?.username === ADMIN_USERNAME)) ||
                dbUser?.role === 'admin';

            if (isAdmin) {
                req.user = {
                    email: email,
                    username: dbUser?.username || username,
                    password: ADMIN_PASSWORD,
                };
                return next();
            }

            log.debug('NOT ADMIN (OIDC)', { email, username });
            return res.status(201).json({ message: "You don't have admin privileges for this request!" });
        } catch (err) {
            log.error('OIDC admin check error', err);
            return res.status(401).json({ message: 'Authentication error' });
        }
    }

    // JWT token authentication (standard mode)
    let token =
        req?.body?.token ||
        req?.query?.token ||
        req?.headers['x-access-token'] ||
        req?.headers['authorization'] ||
        req?.headers['Authorization'];

    if (!token) {
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

        if (await utils.isAdmin(decoded.email, decoded.username, decoded.password)) {
            req.user = decoded;
            return next();
        }

        log.debug('NOT ADMIN', decoded);
        return res.status(201).json({ message: "You don't have admin privileges for this request!" });
    } catch (err) {
        return res.status(401).json({ message: 'Token invalid or expired' });
    }
};

module.exports = admin;
