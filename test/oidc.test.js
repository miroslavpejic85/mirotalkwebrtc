'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const dns = require('node:dns');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const CONTROLLER_PATH = path.resolve(__dirname, '../backend/controllers/oidc.js');
const OIDC_MIDDLEWARE_PATH = path.resolve(__dirname, '../backend/middleware/oidc.js');

function loadController() {
    const previousMiddleware = require.cache[OIDC_MIDDLEWARE_PATH];
    require.cache[OIDC_MIDDLEWARE_PATH] = {
        id: OIDC_MIDDLEWARE_PATH,
        filename: OIDC_MIDDLEWARE_PATH,
        loaded: true,
        exports: { isOidcEnabled: () => true },
    };
    delete require.cache[CONTROLLER_PATH];
    const controller = require(CONTROLLER_PATH);

    return {
        controller,
        cleanup() {
            delete require.cache[CONTROLLER_PATH];
            if (previousMiddleware) require.cache[OIDC_MIDDLEWARE_PATH] = previousMiddleware;
            else delete require.cache[OIDC_MIDDLEWARE_PATH];
        },
    };
}

function request(picture) {
    return {
        oidc: {
            isAuthenticated: () => true,
            user: { picture },
        },
    };
}

function response() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        set(name, value) {
            this.headers[name.toLowerCase()] = value;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
        end() {
            return this;
        },
    };
}

function mockGet(t, { statusCode = 200, headers = {}, body = Buffer.alloc(0) }) {
    let calls = 0;
    t.mock.method(http, 'get', (_url, _options, callback) => {
        calls += 1;
        const outgoing = new EventEmitter();
        outgoing.setTimeout = () => outgoing;
        outgoing.destroy = (error) => {
            if (error) outgoing.emit('error', error);
        };

        process.nextTick(() => {
            const upstream = new PassThrough();
            upstream.statusCode = statusCode;
            upstream.headers = headers;
            callback(upstream);
            upstream.end(body);
        });
        return outgoing;
    });
    return () => calls;
}

test('OIDC profile image rejects private and mapped loopback addresses without fetching', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const fetch = t.mock.method(http, 'get', () => assert.fail('private targets must not be fetched'));

    for (const picture of [
        'http://127.0.0.1/secret',
        'http://169.254.169.254/latest/meta-data/',
        'http://[::ffff:7f00:1]/',
    ]) {
        const res = response();
        await harness.controller.oidcProfileImage(request(picture), res);
        assert.equal(res.statusCode, 502);
    }

    assert.equal(fetch.mock.callCount(), 0);
});

test('OIDC profile image rejects a hostname when any DNS answer is private', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    t.mock.method(dns.promises, 'lookup', async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
    ]);
    const fetch = t.mock.method(http, 'get', () => assert.fail('mixed DNS targets must not be fetched'));
    const res = response();

    await harness.controller.oidcProfileImage(request('http://images.example/avatar.png'), res);

    assert.equal(res.statusCode, 502);
    assert.equal(fetch.mock.callCount(), 0);
});

test('OIDC profile image does not follow redirects', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    t.mock.method(dns.promises, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
    const calls = mockGet(t, { statusCode: 302, headers: { location: 'http://127.0.0.1/secret' } });
    const res = response();

    await harness.controller.oidcProfileImage(request('http://images.example/avatar.png'), res);

    assert.equal(res.statusCode, 502);
    assert.equal(calls(), 1);
});

test('OIDC profile image returns only recognized image bytes', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    t.mock.method(dns.promises, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
    mockGet(t, { body: Buffer.from('internal secret') });
    const res = response();

    await harness.controller.oidcProfileImage(request('http://images.example/avatar.png'), res);

    assert.equal(res.statusCode, 502);
    assert.equal(res.body, undefined);
});

test('OIDC profile image returns a vetted raster image with private caching', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    t.mock.method(dns.promises, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    mockGet(t, { body: png });
    const res = response();

    await harness.controller.oidcProfileImage(request('http://images.example/avatar.png'), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    assert.equal(res.headers['cache-control'], 'private, max-age=3600');
    assert.deepEqual(res.body, png);
});
