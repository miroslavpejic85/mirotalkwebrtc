'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CONTROLLER_PATH = path.resolve(__dirname, '../backend/controllers/users.js');
const USER_PATH = path.resolve(__dirname, '../backend/models/users.js');
const ROOM_PATH = path.resolve(__dirname, '../backend/models/room.js');
const NODEMAILER_PATH = path.resolve(__dirname, '../backend/lib/nodemailer.js');
const STRIPE_PATH = path.resolve(__dirname, '../backend/lib/stripe.js');
const UTILS_PATH = path.resolve(__dirname, '../backend/common/utils.js');
const LOGS_PATH = path.resolve(__dirname, '../backend/common/logs.js');
const AUTH_COOKIE_PATH = path.resolve(__dirname, '../backend/common/authCookie.js');
const BCRYPT_PATH = require.resolve('bcryptjs');

function loadController() {
    const createdUsers = [];

    function User(data) {
        Object.assign(this, data);
        createdUsers.push(this);
    }
    User.findOne = async () => null;
    User.prototype.save = async function () {
        this._id = 'user_new';
        return this;
    };
    User.prototype.toObject = function () {
        return { ...this };
    };

    class Logs {
        debug() {}
        error() {}
    }

    const replacements = new Map([
        [USER_PATH, User],
        [ROOM_PATH, {}],
        [NODEMAILER_PATH, {}],
        [STRIPE_PATH, {}],
        [UTILS_PATH, { isAdmin: async () => false, tokenEncode: () => 'token' }],
        [LOGS_PATH, Logs],
        [AUTH_COOKIE_PATH, { setAuthCookie() {} }],
        [BCRYPT_PATH, { hash: async () => 'hashed-password' }],
    ]);
    const previous = new Map();

    for (const [modulePath, exports] of replacements) {
        previous.set(modulePath, require.cache[modulePath]);
        require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
    }

    delete require.cache[CONTROLLER_PATH];
    const controller = require(CONTROLLER_PATH);

    return {
        controller,
        createdUsers,
        cleanup() {
            delete require.cache[CONTROLLER_PATH];
            for (const [modulePath, cached] of previous) {
                if (cached) require.cache[modulePath] = cached;
                else delete require.cache[modulePath];
            }
        },
    };
}

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

function createRequest(overrides = {}) {
    return {
        body: {
            email: 'new@example.com',
            username: 'new-user',
            password: 'SecurePassword123!',
            ...overrides,
        },
    };
}

test('userAdminCreate grants Lifetime access without Stripe', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userAdminCreate(
        createRequest({ subscriptionType: 'lifetime', allow: ['P2P'], allowedRooms: ['team-room'] }),
        res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(harness.createdUsers[0].subscriptionType, 'lifetime');
    assert.equal(harness.createdUsers[0].subscriptionStatus, 'active');
    assert.equal(harness.createdUsers[0].subscriptionExpiresAt, null);
    assert.deepEqual(harness.createdUsers[0].allow, ['P2P']);
    assert.deepEqual(harness.createdUsers[0].allowedRooms, ['team-room']);
});

test('userAdminCreate requires a future expiry for recurring access', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userAdminCreate(
        createRequest({ subscriptionType: 'monthly', subscriptionExpiresAt: '2020-01-01T23:59:59.999Z' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'A future expiry date is required for recurring plans');
    assert.equal(harness.createdUsers.length, 0);
});

test('userAdminCreate grants recurring access until its future expiry', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const res = createResponse();
    const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await harness.controller.userAdminCreate(
        createRequest({ subscriptionType: 'yearly', subscriptionExpiresAt: futureExpiry }),
        res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(harness.createdUsers[0].subscriptionType, 'yearly');
    assert.equal(harness.createdUsers[0].subscriptionStatus, 'active');
    assert.equal(harness.createdUsers[0].subscriptionExpiresAt.toISOString(), futureExpiry);
});

test('userAdminCreate defaults to no subscription', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userAdminCreate(createRequest(), res);

    assert.equal(res.statusCode, 201);
    assert.equal(harness.createdUsers[0].subscriptionType, null);
    assert.equal(harness.createdUsers[0].subscriptionStatus, null);
    assert.equal(harness.createdUsers[0].subscriptionExpiresAt, null);
});
