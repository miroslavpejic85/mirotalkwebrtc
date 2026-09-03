'use strict';

const https = require('https');
const http = require('http');
const dns = require('dns');
const net = require('net');

const logs = require('../common/logs');
const { isOidcEnabled } = require('../middleware/oidc');

const log = new logs('Controllers-oidc');

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TIMEOUT_MS = 5000;
const blockedAddresses = new net.BlockList();

for (const [address, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
]) {
    blockedAddresses.addSubnet(address, prefix, 'ipv4');
}

for (const [address, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['100::', 64],
    ['2001:db8::', 32],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
]) {
    blockedAddresses.addSubnet(address, prefix, 'ipv6');
}

function normalizedAddress(address) {
    const mappedIpv4 = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    return mappedIpv4 ? mappedIpv4[1] : address;
}

function isPublicAddress(address) {
    const normalized = normalizedAddress(address);
    const family = net.isIP(normalized);
    return family !== 0 && !blockedAddresses.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
}

function imageContentType(buffer) {
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
    if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')))
        return 'image/gif';
    if (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return 'image/webp';
    }
    if (
        buffer.length >= 12 &&
        buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
        ['avif', 'avis'].includes(buffer.subarray(8, 12).toString('ascii'))
    ) {
        return 'image/avif';
    }
    return null;
}

async function resolvePublicTarget(url) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('Invalid profile image URL');

    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const literalFamily = net.isIP(hostname);
    const addresses = literalFamily
        ? [{ address: hostname, family: literalFamily }]
        : await dns.promises.lookup(hostname, { all: true, verbatim: true });

    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
        throw new Error('Profile image host is not public');
    }
    return addresses[0];
}

function downloadProfileImage(url, target) {
    return new Promise((resolve, reject) => {
        const client = url.protocol === 'https:' ? https : http;
        const request = client.get(
            url,
            {
                headers: { 'User-Agent': 'MiroTalk-WebRTC' },
                autoSelectFamily: false,
                lookup: (_hostname, options, callback) => {
                    if (options?.all) return callback(null, [target]);
                    callback(null, target.address, target.family);
                },
            },
            (upstream) => {
                if (upstream.statusCode !== 200) {
                    upstream.resume();
                    return reject(new Error('Profile image request failed'));
                }

                const declaredLength = Number(upstream.headers['content-length']);
                if (Number.isFinite(declaredLength) && declaredLength > PROFILE_IMAGE_MAX_BYTES) {
                    upstream.destroy();
                    return reject(new Error('Profile image is too large'));
                }

                const chunks = [];
                let size = 0;
                upstream.on('data', (chunk) => {
                    size += chunk.length;
                    if (size > PROFILE_IMAGE_MAX_BYTES) {
                        upstream.destroy(new Error('Profile image is too large'));
                        return;
                    }
                    chunks.push(chunk);
                });
                upstream.on('end', () => {
                    const body = Buffer.concat(chunks);
                    const contentType = imageContentType(body);
                    if (!contentType) return reject(new Error('Profile image response is not an image'));
                    resolve({ body, contentType });
                });
                upstream.on('error', reject);
            }
        );
        request.setTimeout(PROFILE_IMAGE_TIMEOUT_MS, () =>
            request.destroy(new Error('Profile image request timed out'))
        );
        request.on('error', reject);
    });
}

function oidcStatus(req, res) {
    const data = { enabled: isOidcEnabled() };
    if (isOidcEnabled() && req.oidc && req.oidc.isAuthenticated() && req.oidc.user) {
        data.picture = req.oidc.user.picture ? '/oidc/profile-image' : '';
        data.name = req.oidc.user.name || req.oidc.user.nickname || '';
    }
    res.status(200).json(data);
}

async function oidcProfileImage(req, res) {
    if (!isOidcEnabled() || !req.oidc || !req.oidc.isAuthenticated() || !req.oidc.user?.picture) {
        return res.status(404).end();
    }

    try {
        const url = new URL(req.oidc.user.picture);
        const target = await resolvePublicTarget(url);
        const image = await downloadProfileImage(url, target);
        res.set('Content-Type', image.contentType);
        res.set('Cache-Control', 'private, max-age=3600');
        return res.status(200).send(image.body);
    } catch (error) {
        log.warn('Unable to load OIDC profile image', error.message);
        return res.status(502).end();
    }
}

module.exports = {
    oidcStatus,
    oidcProfileImage,
};
