'use strict';

const axios = require('axios');
const utils = require('../common/utils');

const config = require('../config');
const logs = require('../common/logs');

const log = new logs('Controllers-token');

const JWT_EXP = process.env.JWT_EXP;
const MIROTALK_SFU_API_KEY_SECRET = process.env.MIROTALK_SFU_API_KEY_SECRET;

const HEADERS = {
    SFU: { authorization: MIROTALK_SFU_API_KEY_SECRET || '' },
};

const tokenEndpoint = '/api/v1/token';

async function tokenSFU(req, res) {
    try {
        const { token } = req.params;
        log.debug('User data for Token SFU', token);

        if (!token) {
            throw new Error('Token is required');
        }

        const decoded = utils.tokenDecode(token);
        log.debug('User data for Token SFU decoded', decoded);

        // Call MiroTalk SFU endpoint for token
        const { email, password } = decoded;
        const SFUHome = config.MiroTalk.SFU.Home;

        const SFUTokenData = {
            username: email,
            password: password,
            presenter: true,
            expire: JWT_EXP,
        };

        const response = await axios.post(`${SFUHome}${tokenEndpoint}`, SFUTokenData, {
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
