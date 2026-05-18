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

/*
 * When OIDC_BASE_URL_DYNAMIC is true, the OIDC baseURL (and therefore the redirect_uri
 * sent to the IdP) is derived from the incoming `Host` header. To prevent
 * Host-header injection from redirecting authorization codes to an attacker,
 * list every origin the server is allowed to serve here (full origin, no path).
 *
 * The static OIDC_BASE_URL is always trusted and does not need to be repeated.
 *
 * Example: OIDC_ALLOWED_DYNAMIC_BASE_URLS='https://webrtc.example.com,https://webrtc.eu.example.com'
 */
const OIDC_ALLOWED_DYNAMIC_BASE_URLS = process.env.OIDC_ALLOWED_DYNAMIC_BASE_URLS
    ? process.env.OIDC_ALLOWED_DYNAMIC_BASE_URLS.split(',')
          .map((u) => u.trim())
          .filter(Boolean)
    : [];

// Build an allowlist of origins permitted to be used as the OIDC baseURL.
// This prevents Host-header injection from rewriting the redirect_uri
// (see: https://portswigger.net/web-security/host-header).
// Sources, in order of precedence:
//   1. OIDC_ALLOWED_DYNAMIC_BASE_URLS (string[] of full origins)
//   2. OIDC_BASE_URL (always trusted)
const ALLOWED_ORIGINS = new Set(
    [OIDC_BASE_URL, ...OIDC_ALLOWED_DYNAMIC_BASE_URLS]
        .filter(Boolean)
        .map((u) => {
            try {
                return new URL(u).origin;
            } catch {
                return null;
            }
        })
        .filter(Boolean)
);

function isOidcEnabled() {
    return OIDC_ENABLED;
}

// Middleware that rejects Host headers not in the configured allowlist.
// Without this, an attacker can force the OIDC library to issue a redirect_uri
// pointing to an attacker-controlled origin.
function oidcHostGuard(req, res, next) {
    if (!OIDC_ENABLED || !OIDC_BASE_URL_DYNAMIC) return next();

    const host = req.get('host');
    const protocol = req.protocol === 'https' ? 'https' : 'http';
    const origin = `${protocol}://${host}`;

    if (!ALLOWED_ORIGINS.has(origin)) {
        log.warn('OIDC Host header not in allowlist - rejecting request', {
            host,
            origin,
            allowed: [...ALLOWED_ORIGINS],
        });
        return res.status(400).send('Bad Request: invalid Host header');
    }
    return next();
}

function getOidcAuth() {
    if (!OIDC_ENABLED) return null;

    if (OIDC_BASE_URL_DYNAMIC && ALLOWED_ORIGINS.size === 0) {
        log.error(
            'OIDC_BASE_URL_DYNAMIC is enabled but no allowed origins are configured. ' +
                'Set OIDC_ALLOWED_DYNAMIC_BASE_URLS and/or OIDC_BASE_URL.'
        );
        return null;
    }

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
        allowedOrigins: [...ALLOWED_ORIGINS],
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
    oidcHostGuard,
    requiresAuth,
};
