'use strict';

const logs = require('../common/logs');
const log = new logs('Validator');

const utils = require('../common/utils');
const { isValidUsername, isValidEmail, isValidPhoneNumber, isValidPassword, isValidRoom, isValidTag, isValidType } =
    utils;

const checkData = (req, res, next) => {
    const { username, email, phone, password, room, tag, type } = req.body;
    if (username) {
        const validUsername = isValidUsername(username);
        log.debug('Validator', { username: validUsername });
        if (validUsername != true) {
            return res.status(201).json({ message: validUsername });
        }
    }
    if (email) {
        const validMail = isValidEmail(email);
        log.debug('Validator', { email: validMail });
        if (validMail != true) {
            return res.status(201).json({ message: validMail });
        }
    }
    if (phone) {
        const validPhone = isValidPhoneNumber(phone);
        log.debug('Validator', { phone: validPhone });
        if (validPhone != true) {
            return res.status(201).json({ message: validPhone });
        }
    }
    if (password) {
        const validPassword = isValidPassword(password);
        log.debug('Validator', { password: validPassword });
        if (validPassword != true) {
            return res.status(201).json({ message: validPassword });
        }
    }
    if (room) {
        const validRoom = isValidRoom(room);
        log.debug('Validator', { room: validRoom });
        if (validRoom != true) {
            return res.status(201).json({ message: validRoom });
        }
    }
    if (tag) {
        const validTag = isValidTag(tag);
        log.debug('Validator', { tag: validTag });
        if (validTag != true) {
            return res.status(201).json({ message: validTag });
        }
    }
    if (type) {
        const validType = isValidType(type);
        log.debug('Validator', { type: validType });
        if (validType != true) {
            return res.status(201).json({ message: validType });
        }
    }
    return next();
};

module.exports = checkData;
