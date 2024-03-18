'use-strict';

const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');

const JWT_KEY = process.env.JWT_KEY;
const JWT_EXP = process.env.JWT_EXP;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function isAdmin(email, username, password) {
    return email == ADMIN_EMAIL && username == ADMIN_USERNAME && password == ADMIN_PASSWORD;
}

function tokenEncode(token) {
    if (!token) return '';

    const { username = 'username', email = 'email', password = 'password' } = token;

    // Constructing payload
    const payload = {
        username: String(username),
        email: String(email),
        password: String(password),
    };

    // Encrypt payload using AES encryption
    const payloadString = JSON.stringify(payload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, JWT_KEY).toString();

    // Constructing JWT token
    const jwtToken = jwt.sign({ data: encryptedPayload }, JWT_KEY, { expiresIn: JWT_EXP });

    return jwtToken;
}

function tokenDecode(jwtToken) {
    if (!jwtToken) return null;

    // Verify and decode the JWT token
    const decodedToken = jwt.verify(jwtToken, JWT_KEY);
    if (!decodedToken || !decodedToken.data) {
        throw new Error('Invalid token');
    }

    // Decrypt the payload using AES decryption
    const decryptedPayload = CryptoJS.AES.decrypt(decodedToken.data, JWT_KEY).toString(CryptoJS.enc.Utf8);

    // Parse the decrypted payload as JSON
    const payload = JSON.parse(decryptedPayload);

    return payload;
}

module.exports = {
    isAdmin,
    tokenEncode,
    tokenDecode,
};
