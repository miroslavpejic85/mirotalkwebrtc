'use strict';

const logs = require('../common/logs');
const log = new logs('Ngrok');

const NGROK_ENABLED = process.env.NGROK_ENABLED === 'true' || false;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;
const SERVER_PORT = process.env.SERVER_PORT;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

function enabled() {
    return NGROK_ENABLED;
}

async function start() {
    if (!enabled()) return;

    const NGROK = require('@ngrok/ngrok');

    try {
        await NGROK.authtoken(NGROK_AUTH_TOKEN);
        const listener = await NGROK.forward({ addr: SERVER_PORT });
        const tunnelHttps = listener.url();
        log.info('Server', {
            environment: ENVIRONMENT,
            home: tunnelHttps,
            apiDocs: `${tunnelHttps}/api/v1/docs`,
            nodeVersion: process.versions.node,
        });
    } catch (err) {
        log.warn('[Error] ngrokStart', err);
        await NGROK.kill();
        process.exit(1);
    }
}

module.exports = {
    enabled,
    start,
};
