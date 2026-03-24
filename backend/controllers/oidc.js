'use strict';

const https = require('https');
const http = require('http');

const logs = require('../common/logs');
const { isOidcEnabled } = require('../middleware/oidc');

const log = new logs('Controllers-oidc');

function oidcStatus(req, res) {
    const data = { enabled: isOidcEnabled() };
    if (isOidcEnabled() && req.oidc && req.oidc.isAuthenticated() && req.oidc.user) {
        data.picture = req.oidc.user.picture ? '/oidc/profile-image' : '';
        data.name = req.oidc.user.name || req.oidc.user.nickname || '';
    }
    res.status(200).json(data);
}

function oidcProfileImage(req, res) {
    if (!isOidcEnabled() || !req.oidc || !req.oidc.isAuthenticated() || !req.oidc.user?.picture) {
        return res.status(404).end();
    }
    const url = new URL(req.oidc.user.picture);
    const client = url.protocol === 'https:' ? https : http;
    client
        .get(url, { headers: { 'User-Agent': 'MiroTalk-WebRTC' } }, (upstream) => {
            if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
                const redirectUrl = new URL(upstream.headers.location);
                const redirectClient = redirectUrl.protocol === 'https:' ? https : http;
                redirectClient
                    .get(redirectUrl, { headers: { 'User-Agent': 'MiroTalk-WebRTC' } }, (redirected) => {
                        res.set('Content-Type', redirected.headers['content-type'] || 'image/jpeg');
                        res.set('Cache-Control', 'public, max-age=3600');
                        redirected.pipe(res);
                    })
                    .on('error', () => res.status(502).end());
            } else {
                res.set('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
                res.set('Cache-Control', 'public, max-age=3600');
                upstream.pipe(res);
            }
        })
        .on('error', () => res.status(502).end());
}

module.exports = {
    oidcStatus,
    oidcProfileImage,
};
