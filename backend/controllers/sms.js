'use strict';

const logs = require('../common/logs');
const log = new logs('Controllers-sms');

const smsEnabled = process.env.TWILIO_SMS == 'true';
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

let client = null;
if (smsEnabled) {
    client = require('twilio')(accountSid, authToken);
}

async function smsSend(req, res) {
    if (!smsEnabled) {
        return res.status(201).json({ message: 'SMS invitation seems disabled by the admin.' });
    }
    try {
        const { message, toNumber } = req.body;
        client.messages
            .create({
                body: message,
                from: phoneNumber,
                to: toNumber,
            })
            .then((data) => {
                log.debug('SMS Meeting Invitation sent successfully!', data);
                return res.status(200).json(data);
            })
            .catch((error) => {
                const errMsg = `Failed to send SMS Meeting Invitation: ${error.message}`;
                log.error(errMsg);
                return res.status(201).json({ message: errMsg });
            });
    } catch (error) {
        log.error('SmS error', error);
        return res.status(400).json({ message: error.message });
    }
}

module.exports = {
    smsSend,
};
