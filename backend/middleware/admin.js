'use strict';

const User = require('../models/users');
const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('Admin');

const admin = async (req, res, next) => {
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

        // Check env var admin credentials or database role
        if (utils.isAdmin(decoded.email, decoded.username, decoded.password)) {
            req.user = decoded;
            return next();
        }

        const user = await User.findOne({ email: decoded.email, username: decoded.username });
        if (user && user.role === 'admin') {
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
