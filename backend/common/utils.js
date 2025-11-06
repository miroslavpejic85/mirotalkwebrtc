'use strict';

const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');

const JWT_KEY = process.env.JWT_KEY;
const JWT_EXP = process.env.JWT_EXP;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const lowerCase = new RegExp('[a-z]');
const upperCase = new RegExp('[A-Z]');
const numbers = new RegExp('[0-9]');
const specialCharacter = new RegExp('[!,%,&,@,#,$,^,*,?,_,~]');
const validEmailReg = new RegExp(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
);
const validNumberReg = new RegExp(/^\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/);
const pathTraversal = new RegExp(/(\.\.(\/|\\))+/);
const alphanumeric = new RegExp(/^[A-Za-z0-9-_]+$/);
const miroTalkType = new RegExp(/^(SFU|P2P|C2C|BRO)$/);

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

function isValidUsername(username) {
    if (username.length > 20) {
        return '⚠️ The maximum number of username characters must be 20';
    }
    return true;
}

function isValidEmail(email) {
    if (!email.match(validEmailReg)) {
        return '⚠️ The Email field seems not valid!';
    }
    return true;
}

function isValidPhoneNumber(phone) {
    if (!phone.match(validNumberReg)) {
        return '⚠️ The Phone number field seems not valid! The number format must be [prefix][number] ex. 👉 +14845691464';
    }
    return true;
}

function isValidPassword(password) {
    if (password.length < 6) {
        return '⚠️ The minimum number of password characters must be 6';
    }
    if (password.length > 36) {
        return '⚠️ The maximum number of password characters must be 36';
    }
    if (
        !password.match(lowerCase) ||
        !password.match(upperCase) ||
        !password.match(numbers) ||
        !password.match(specialCharacter)
    ) {
        return '⚠️ The password must contain lower/upper case, numbers and special character [!,%,&,@,#,$,^,*,?,_,~] ex. 👉 Test@123';
    }
    return true;
}

function isValidRoom(room) {
    if (room.match(pathTraversal)) {
        return '⚠️ The room name is not valid!';
    }
    return true;
}

function isValidTag(tag) {
    if (!tag.match(alphanumeric)) {
        return '⚠️ The Tag must be alphanumeric!';
    }
    return true;
}

function isValidType(type) {
    if (!type.match(miroTalkType)) {
        return '⚠️ Type must be one of SFU/P2P/C2C/BRO!';
    }
    return true;
}

module.exports = {
    isAdmin,
    tokenEncode,
    tokenDecode,
    isValidUsername,
    isValidEmail,
    isValidPhoneNumber,
    isValidPassword,
    isValidRoom,
    isValidTag,
    isValidType,
};
