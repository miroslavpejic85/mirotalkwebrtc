'use-strict';

const jwt = require('jsonwebtoken');

const JWT_KEY = process.env.JWT_KEY;

const auth = (req, res, next) => {
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
        // temporary commented
        // const parts = token.split(' ');
        // if (parts.length === 2) {
        //     const scheme = parts[0];
        //     const credentials = parts[1];
        //     if (/^Bearer$/i.test(scheme)) token = credentials;
        // }
        // const decoded = jwt.verify(token, JWT_KEY);
        // // console.log('jwt auth decoded', decoded);
        // req.user = decoded;
    } catch (err) {
        return res.status(401).json({ message: 'Token invalid or expired' });
    }
    return next();
};

module.exports = auth;
