'use strict';

const util = require('util');
const colors = require('colors');

const LOG_COLOR = process.env.LOG_COLOR === 'true';
const LOG_DEBUG = process.env.LOG_DEBUG === 'true';
const LOGS_JSON = process.env.LOGS_JSON ? process.env.LOGS_JSON === 'true' : false;
const LOGS_JSON_PRETTY = process.env.LOGS_JSON_PRETTY ? process.env.LOGS_JSON_PRETTY === 'true' : false;

console.info('Logs', {
    logColor: LOG_COLOR,
    logDebug: LOG_DEBUG,
    logsJson: LOGS_JSON,
    logsJsonPretty: LOGS_JSON_PRETTY,
});

LOG_COLOR ? colors.enable() : colors.disable();

const options = {
    depth: null,
    colors: true,
};

module.exports = class logs {
    constructor(appName = 'MiroTalkWeb') {
        this.appName = colors.yellow(appName);
        this.rawAppName = appName;
        this.debugOn = LOG_DEBUG;
        this.timeStart = Date.now();
        this.timeEnd = null;
        this.timeElapsedMs = null;
        this.tzOptions = {
            timeZone: process.env.TZ || 'UTC',
            hour12: false,
        };
    }

    debug(msg, op = '') {
        if (!this.debugOn) return;
        this.timeEnd = Date.now();
        this.timeElapsedMs = this.getFormatTime(Math.floor(this.timeEnd - this.timeStart));
        if (LOGS_JSON) {
            this.jsonLog('debug', this.rawAppName, msg, op, { elapsed: this.timeElapsedMs });
        } else {
            console.debug(
                '[' + this.getDateTime() + '] [' + this.appName + '] ' + msg,
                util.inspect(op, options),
                this.timeElapsedMs
            );
        }
        this.timeStart = Date.now();
    }

    log(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('log', this.rawAppName, msg, op);
        } else {
            console.log('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, util.inspect(op, options));
        }
    }

    info(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('info', this.rawAppName, msg, op);
        } else {
            console.info(
                '[' + this.getDateTime() + '] [' + this.appName + '] ' + colors.green(msg),
                util.inspect(op, options)
            );
        }
    }

    warn(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('warn', this.rawAppName, msg, op);
        } else {
            console.warn(
                '[' + this.getDateTime() + '] [' + this.appName + '] ' + colors.yellow(msg),
                util.inspect(op, options)
            );
        }
    }

    error(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('error', this.rawAppName, msg, op);
        } else {
            console.error(
                '[' + this.getDateTime() + '] [' + this.appName + '] ' + colors.red(msg),
                util.inspect(op, options)
            );
        }
    }

    jsonLog(level, appName, msg, op, extra = {}) {
        const logObj = {
            timestamp: new Date().toISOString(),
            level,
            app: appName,
            message: msg,
            ...extra,
        };
        if (op && typeof op === 'object' && Object.keys(op).length > 0) {
            logObj.data = op;
        }
        LOGS_JSON_PRETTY ? console.log(JSON.stringify(logObj, null, 2)) : console.log(JSON.stringify(logObj));
    }

    getDateTime() {
        const currentTime = new Date().toLocaleString('en-US', this.tzOptions);
        const milliseconds = String(new Date().getMilliseconds()).padStart(3, '0');
        return colors.cyan(`${currentTime}:${milliseconds}`);
    }

    getFormatTime(ms) {
        let time = Math.floor(ms);
        let type = 'ms';

        if (ms >= 1000) {
            time = Math.floor((ms / 1000) % 60);
            type = 's';
        }
        if (ms >= 60000) {
            time = Math.floor((ms / 1000 / 60) % 60);
            type = 'm';
        }
        if (ms >= 3600000) {
            time = Math.floor((ms / 1000 / 60 / 60) % 24);
            type = 'h';
        }
        return colors.magenta('+' + time + type);
    }
};
