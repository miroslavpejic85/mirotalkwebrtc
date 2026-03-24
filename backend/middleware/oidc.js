'use strict';

const { auth, requiresAuth } = require('express-openid-connect');
const logs = require('../common/logs');

const log = new logs('OIDC');

const OIDC_ENABLED = process.env.OIDC_ENABLED === 'true';
const OIDC_BASE_URL_DYNAMIC = process.env.OIDC_BASE_URL_DYNAMIC === 'true';
const OIDC_ISSUER_BASE_URL = process.env.OIDC_ISSUER_BASE_URL;
const OIDC_BASE_URL = process.env.OIDC_BASE_URL;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const OIDC_AUTH_REQUIRED = process.env.OIDC_AUTH_REQUIRED === 'true';
const OIDC_AUTH_LOGOUT = process.env.OIDC_AUTH_LOGOUT === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET;

function isOidcEnabled() {
    return OIDC_ENABLED;
}

function getOidcAuth() {
    if (!OIDC_ENABLED) return null;

    const config = {
        authRequired: OIDC_AUTH_REQUIRED,
        auth0Logout: OIDC_AUTH_LOGOUT,
        secret: SESSION_SECRET,
        clientID: OIDC_CLIENT_ID,
        clientSecret: OIDC_CLIENT_SECRET,
        issuerBaseURL: OIDC_ISSUER_BASE_URL,
    };

    if (OIDC_BASE_URL_DYNAMIC) {
        config.baseURL = (req) => {
            return `${req.protocol}://${req.get('host')}`;
        };
    } else {
        config.baseURL = OIDC_BASE_URL;
    }

    log.debug('OIDC config', {
        enabled: OIDC_ENABLED,
        baseURLDynamic: OIDC_BASE_URL_DYNAMIC,
        issuerBaseURL: OIDC_ISSUER_BASE_URL,
        clientID: OIDC_CLIENT_ID,
        authRequired: OIDC_AUTH_REQUIRED,
        auth0Logout: OIDC_AUTH_LOGOUT,
    });

    return auth(config);
}

module.exports = {
    isOidcEnabled,
    getOidcAuth,
    requiresAuth,
};
