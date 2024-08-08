'use-strict';

const logs = require('../common/logs');
const log = new logs('Sentry');

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_TRACES_SAMPLE_RATE = process.env.SENTRY_TRACES_SAMPLE_RATE;

function start() {
    if (SENTRY_DSN != '') {
        const sentry = require('@sentry/node');
        log.info('Sentry monitoring started...');
        sentry.init({
            dsn: SENTRY_DSN,
            integrations: [
                sentry.captureConsoleIntegration({
                    levels: ['warn', 'error'],
                }),
            ],
            tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
        });
        // log.error('TEST error message');
        // log.warn('TEST warn message');
    }
}

module.exports = {
    start,
};
