'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');
const { isOidcEnabled } = require('./oidc');
const User = require('../models/users');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const log = new logs('Auth');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function findOrCreateOidcUser(oidcUser) {
    const email = oidcUser.email;
    const username = oidcUser.nickname || oidcUser.name || email.split('@')[0];

    let user = await User.findOne({ email: email });
    if (user) {
        user.updatedAt = new Date().toISOString();
        await user.save();
        return user;
    }

    // Create new user from OIDC profile
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const encryptedPassword = await bcrypt.hash(randomPassword, 10);
    const isUserAdmin = await utils.isAdmin(email, username, ADMIN_PASSWORD);

    const userData = new User({
        email: email,
        username: username,
        password: encryptedPassword,
        role: isUserAdmin ? 'admin' : 'guest',
        token: '',
        active: true,
        createdAt: new Date().toISOString(),
    });
    const savedUser = await userData.save();
    log.debug('OIDC user auto-provisioned', { email, username });
    return savedUser;
}

const auth = async (req, res, next) => {
    // OIDC authentication: check session first when enabled
    if (isOidcEnabled() && req.oidc && req.oidc.isAuthenticated()) {
        try {
            const oidcUser = req.oidc.user;
            const dbUser = await findOrCreateOidcUser(oidcUser);
            req.user = {
                email: dbUser.email,
                username: dbUser.username,
                password: ADMIN_EMAIL === dbUser.email && ADMIN_USERNAME === dbUser.username ? ADMIN_PASSWORD : '',
            };
            return next();
        } catch (err) {
            log.error('OIDC auth error', err);
            return res.status(500).json({ message: 'OIDC authentication error' });
        }
    }

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

        //log.debug('jwt auth decoded', decoded);
        req.user = decoded;
    } catch (err) {
        if (req.accepts('html')) {
            return res.redirect('/');
        }
        return res.status(401).json({ message: 'Token invalid or expired' });
    }
    return next();
};

module.exports = auth;
