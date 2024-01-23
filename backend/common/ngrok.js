'use-strict';

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
        const data = await api.listTunnels();
        const pu0 = data.tunnels[0].public_url;
        const pu1 = data.tunnels[1].public_url;
        const tunnelHttps = pu0.startsWith('https') ? pu0 : pu1;
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
