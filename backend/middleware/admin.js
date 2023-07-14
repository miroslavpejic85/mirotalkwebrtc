'use-strict';

const jwt = require('jsonwebtoken');

const JWT_KEY = process.env.JWT_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const admin = (req, res, next) => {
    let token =
        req.body.token ||
        req.query.token ||
        req.headers['x-access-token'] ||
        req.headers['authorization'] ||
        req.headers['Authorization'];
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
        const decoded = jwt.verify(token, JWT_KEY);
        //console.log('Admin credential', { ADMIN_EMAIL:ADMIN_EMAIL, ADMIN_USERNAME:ADMIN_USERNAME, ADMIN_PASSWORD:ADMIN_PASSWORD });
        if (decoded.email != ADMIN_EMAIL || decoded.username != ADMIN_USERNAME || decoded.password != ADMIN_PASSWORD) {
            console.log('NOT ADMIN', decoded);
            return res.status(201).json({ message: "You don't have admin privileges for this request!" });
        }
        req.user = decoded;
    } catch (err) {
        return res.status(401).json({ message: 'Token invalid or expired' });
    }
    return next();
};

module.exports = admin;
