'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AUTH_PATH = path.resolve(__dirname, '../backend/middleware/auth.js');
const UTILS_PATH = path.resolve(__dirname, '../backend/common/utils.js');
const OIDC_PATH = path.resolve(__dirname, '../backend/middleware/oidc.js');

function loadAuth(tokenDecode = () => {
    throw new Error('Invalid token');
}) {
    const previousUtils = require.cache[UTILS_PATH];
    const previousOidc = require.cache[OIDC_PATH];

    require.cache[UTILS_PATH] = {
        id: UTILS_PATH,
        filename: UTILS_PATH,
        loaded: true,
        exports: {
            tokenDecode,
        },
    };
    require.cache[OIDC_PATH] = {
        id: OIDC_PATH,
        filename: OIDC_PATH,
        loaded: true,
        exports: { isOidcEnabled: () => false },
    };

    delete require.cache[AUTH_PATH];
    const auth = require(AUTH_PATH);

    return {
        auth,
        cleanup() {
            delete require.cache[AUTH_PATH];
            if (previousUtils) require.cache[UTILS_PATH] = previousUtils;
            else delete require.cache[UTILS_PATH];
            if (previousOidc) require.cache[OIDC_PATH] = previousOidc;
            else delete require.cache[OIDC_PATH];
        },
    };
}

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        redirectedTo: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        redirect(url) {
            this.redirectedTo = url;
            return this;
        },
    };
}

test('API request with an invalid token returns JSON instead of redirecting', async (t) => {
    const harness = loadAuth();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.auth(
        {
            path: '/stripe/checkout',
            originalUrl: '/api/v1/stripe/checkout',
            body: {},
            query: {},
            headers: { 'x-access-token': 'undefined' },
            accepts: () => 'html',
        },
        res,
        () => assert.fail('next must not be called')
    );

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: 'Token invalid or expired' });
    assert.equal(res.redirectedTo, undefined);
});

test('HTML page request with an invalid token still redirects to login', async (t) => {
    const harness = loadAuth();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.auth(
        {
            path: '/client',
            originalUrl: '/client',
            body: {},
            query: {},
            headers: { 'x-access-token': 'undefined' },
            accepts: () => 'html',
        },
        res,
        () => assert.fail('next must not be called')
    );

    assert.equal(res.redirectedTo, '/');
    assert.equal(res.body, undefined);
});

test('HTML page request accepts the authentication cookie', async (t) => {
    const decodedUser = { email: 'user@example.com', username: 'user' };
    const harness = loadAuth((token) => {
        assert.equal(token, 'valid-cookie-token');
        return decodedUser;
    });
    t.after(harness.cleanup);
    const res = createResponse();
    let nextCalled = false;
    const req = {
        path: '/client',
        originalUrl: '/client',
        body: {},
        query: {},
        headers: {},
        cookies: { mirotalk_auth: 'valid-cookie-token' },
        accepts: () => 'html',
    };

    await harness.auth(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, decodedUser);
    assert.equal(res.redirectedTo, undefined);
});
