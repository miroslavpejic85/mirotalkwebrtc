'use strict';

const logs = require('../common/logs');
const log = new logs('Ngrok');

const NGROK_ENABLED = process.env.NGROK_ENABLED === 'true' || false;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;
const SERVER_PORT = process.env.SERVER_PORT;

function enabled() {
    return NGROK_ENABLED;
}

async function start() {
    try {
        if (!enabled()) return;
        const NGROK = require('ngrok');
        await NGROK.authtoken(NGROK_AUTH_TOKEN);
        await NGROK.connect(SERVER_PORT);
        const api = NGROK.getApi();
        const list = await api.listTunnels();
        const tunnelHttps = list.tunnels[0].public_url;
        log.info('Server', {
            home: tunnelHttps,
            apiDocs: `${tunnelHttps}/api/v1/docs`,
            nodeVersion: process.versions.node,
        });
    } catch (err) {
        log.warn('[Error] ngrokStart', err);
        process.exit(1);
    }
}

module.exports = {
    enabled,
    start,
};
