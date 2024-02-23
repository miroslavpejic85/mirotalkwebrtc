'use strict';

const axios = require('axios');
const jwt = require('jsonwebtoken');

const config = require('../config');
const logs = require('../common/logs');

const log = new logs('Controllers-token');

const JWT_KEY = process.env.JWT_KEY;
const JWT_EXP = process.env.JWT_EXP;
const MIROTALK_SFU_API_KEY_SECRET = process.env.MIROTALK_SFU_API_KEY_SECRET;

const HEADERS = {
    SFU: { authorization: MIROTALK_SFU_API_KEY_SECRET || '' },
};

async function tokenSFU(req, res) {
    try {
        const { token } = req.params;
        log.debug('User data for Token SFU', token);

        if (!token) {
            throw new Error('Token is required');
        }

        const decoded = jwt.verify(token, JWT_KEY);
        log.debug('User data for Token SFU decoded', decoded);

        // Call MiroTalk SFU endpoint for token
        const { email, password } = decoded;
        const SFUHome = config.MiroTalk.SFU.Home;
        const SFUTokenEndpoint = config.MiroTalk.SFU.TokenEndpoint;

        const SFUTokenData = {
            username: email,
            password: password,
            presenter: true,
            expire: JWT_EXP,
        };

        const response = await axios.post(`${SFUHome}${SFUTokenEndpoint}`, SFUTokenData, {
            headers: HEADERS.SFU,
        });

        log.debug('Token SFU response data', response.data);
        res.status(200).json(response.data.token);
    } catch (error) {
        log.error('Token SFU error', error.message);
        res.status(400).json({ message: error.message });
    }
}

module.exports = {
    tokenSFU,
};
