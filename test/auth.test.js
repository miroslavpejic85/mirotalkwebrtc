'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AUTH_PATH = path.resolve(__dirname, '../backend/middleware/auth.js');
const UTILS_PATH = path.resolve(__dirname, '../backend/common/utils.js');
const OIDC_PATH = path.resolve(__dirname, '../backend/middleware/oidc.js');
const USER_PATH = path.resolve(__dirname, '../backend/models/users.js');

function loadAuth(
    tokenDecode = () => {
        throw new Error('Invalid token');
    },
    findUser = (identity) => ({ _id: 'user_1', email: identity.email, username: identity.username }),
    oidcEnabled = false
) {
    const previousUtils = require.cache[UTILS_PATH];
    const previousOidc = require.cache[OIDC_PATH];
    const previousUser = require.cache[USER_PATH];
    require.cache[USER_PATH] = {
        id: USER_PATH,
        filename: USER_PATH,
        loaded: true,
        exports: {
            findOne: (identity) => {
                const user = findUser(identity);
                const query = Promise.resolve(user);
                query.select = async () => user;
                return query;
            },
        },
    };

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
        exports: { isOidcEnabled: () => oidcEnabled },
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
            if (previousUser) require.cache[USER_PATH] = previousUser;
            else delete require.cache[USER_PATH];
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
    assert.deepEqual(req.user, { ...decodedUser, userId: 'user_1' });
    assert.equal(res.redirectedTo, undefined);
});

test('authentication rejects legacy tokens with mismatched email and username', async (t) => {
    const harness = loadAuth(
        () => ({ email: 'paid@example.com', username: 'attacker' }),
        (identity) => {
            assert.deepEqual(identity, { email: 'paid@example.com', username: 'attacker', active: true });
            return null;
        }
    );
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.auth(
        { originalUrl: '/api/v1/stripe/billing', headers: { 'x-access-token': 'legacy-token' } },
        res,
        () => assert.fail('mismatched identity must not authenticate')
    );
    assert.equal(res.statusCode, 401);
});

test('authentication binds new tokens to an active database user ID', async (t) => {
    const harness = loadAuth(
        () => ({ userId: 'deleted-user', email: 'user@example.com', username: 'user' }),
        (identity) => {
            assert.equal(identity._id, 'deleted-user');
            assert.equal(identity.active, true);
            return null;
        }
    );
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.auth({ originalUrl: '/api/v1/room', headers: { 'x-access-token': 'old-token' } }, res, () =>
        assert.fail('deleted or inactive user must not authenticate')
    );
    assert.equal(res.statusCode, 401);
});

test('ID-bound authentication uses canonical account data after a username change', async (t) => {
    const harness = loadAuth(
        () => ({ userId: 'user_1', email: 'user@example.com', username: 'old-name' }),
        (identity) => {
            assert.deepEqual(identity, { _id: 'user_1', active: true });
            return { _id: 'user_1', email: 'user@example.com', username: 'new-name' };
        }
    );
    t.after(harness.cleanup);
    const req = { originalUrl: '/api/v1/user/me', headers: { 'x-access-token': 'bound-token' } };
    await harness.auth(req, createResponse(), () => {});
    assert.equal(req.user.username, 'new-name');
});

test('OIDC authentication rejects an inactive database account', async (t) => {
    const harness = loadAuth(
        () => assert.fail('OIDC does not use JWT authentication'),
        () => ({ _id: 'user_1', email: 'user@example.com', username: 'user', active: false, save: async () => {} }),
        true
    );
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.auth(
        { originalUrl: '/api/v1/room', oidc: { isAuthenticated: () => true, user: { email: 'user@example.com' } } },
        res,
        () => assert.fail('inactive OIDC account must not authenticate')
    );
    assert.equal(res.statusCode, 403);
});
