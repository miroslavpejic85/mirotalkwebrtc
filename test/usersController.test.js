'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CONTROLLER_PATH = path.resolve(__dirname, '../backend/controllers/users.js');
const USER_PATH = path.resolve(__dirname, '../backend/models/users.js');
const ROOM_PATH = path.resolve(__dirname, '../backend/models/room.js');
const BOOKING_PATH = path.resolve(__dirname, '../backend/models/booking.js');
const BOOKING_PROFILE_PATH = path.resolve(__dirname, '../backend/models/bookingProfile.js');
const EVENT_PATH = path.resolve(__dirname, '../backend/models/event.js');
const EMAIL_INVITATION_PATH = path.resolve(__dirname, '../backend/models/emailInvitation.js');
const NODEMAILER_PATH = path.resolve(__dirname, '../backend/lib/nodemailer.js');
const STRIPE_PATH = path.resolve(__dirname, '../backend/lib/stripe.js');
const UTILS_PATH = path.resolve(__dirname, '../backend/common/utils.js');
const LOGS_PATH = path.resolve(__dirname, '../backend/common/logs.js');
const AUTH_COOKIE_PATH = path.resolve(__dirname, '../backend/common/authCookie.js');
const BCRYPT_PATH = require.resolve('bcryptjs');

function loadController(overrides = {}) {
    const createdUsers = [];
    const previousRegistrationMode = process.env.USER_REGISTRATION_MODE;
    if (overrides.userRegistrationMode !== undefined) {
        process.env.USER_REGISTRATION_MODE = String(overrides.userRegistrationMode);
    }

    function User(data) {
        Object.assign(this, data);
        createdUsers.push(this);
    }
    User.findOne = overrides.userFindOne || (async () => null);
    User.findById = overrides.userFindById || (async () => null);
    User.findByIdAndDelete = overrides.userFindByIdAndDelete || (async () => null);
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

    const Room = overrides.Room || { deleteMany: async () => ({ deletedCount: 0 }) };
    const Booking = overrides.Booking || { deleteMany: async () => ({ deletedCount: 0 }) };
    const BookingProfile = overrides.BookingProfile || { deleteMany: async () => ({ deletedCount: 0 }) };
    const Event = overrides.Event || { deleteMany: async () => ({ deletedCount: 0 }) };
    const EmailInvitation = overrides.EmailInvitation || { deleteMany: async () => ({ deletedCount: 0 }) };

    const replacements = new Map([
        [USER_PATH, User],
        [ROOM_PATH, Room],
        [BOOKING_PATH, Booking],
        [BOOKING_PROFILE_PATH, BookingProfile],
        [EVENT_PATH, Event],
        [EMAIL_INVITATION_PATH, EmailInvitation],
        [NODEMAILER_PATH, { getUpgradeMessage: () => '' }],
        [STRIPE_PATH, overrides.stripeLib || { cleanupUserBilling: async () => {} }],
        [
            UTILS_PATH,
            {
                isAdmin: overrides.isAdmin || (async () => false),
                tokenEncode: () => 'token',
            },
        ],
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
            if (previousRegistrationMode === undefined) delete process.env.USER_REGISTRATION_MODE;
            else process.env.USER_REGISTRATION_MODE = previousRegistrationMode;
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
        send(body) {
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
            legalConsent: true,
            legalVersion: '2026-09-18',
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

test('userCreate requires the current legal consent version', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userCreate(createRequest({ legalConsent: false }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Current Terms of Service and Privacy Policy must be accepted');
    assert.equal(harness.createdUsers.length, 0);
});

test('userCreate persists server-timestamped legal consent', async (t) => {
    const harness = loadController();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userCreate(createRequest(), res);

    assert.equal(res.statusCode, 201);
    assert.equal(harness.createdUsers[0].termsVersion, '2026-09-18');
    assert.equal(harness.createdUsers[0].privacyPolicyVersion, '2026-09-18');
    assert.ok(harness.createdUsers[0].termsAcceptedAt instanceof Date);
});

test('userLogin persists consent when it auto-registers a new user', async (t) => {
    const harness = loadController({ userRegistrationMode: true });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userLogin(createRequest(), res);

    assert.equal(res.statusCode, 201);
    assert.equal(harness.createdUsers[0].termsVersion, '2026-09-18');
    assert.equal(harness.createdUsers[0].privacyPolicyVersion, '2026-09-18');
    assert.ok(harness.createdUsers[0].termsAcceptedAt instanceof Date);
});

test('userLogin rejects auto-registration without current legal consent', async (t) => {
    const harness = loadController({ userRegistrationMode: true });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userLogin(createRequest({ legalVersion: 'outdated' }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Current Terms of Service and Privacy Policy must be accepted');
    assert.equal(harness.createdUsers.length, 0);
});

test('userDelete removes every user-owned collection and billing data', async (t) => {
    const deletedQueries = [];
    const model = (name, count) => ({
        deleteMany: async (query) => {
            deletedQueries.push({ name, query });
            return { deletedCount: count };
        },
    });
    let billingUser;
    const deletedUser = { _id: 'user_123', email: 'owner@example.com' };
    const harness = loadController({
        isAdmin: async () => true,
        userFindById: async () => deletedUser,
        userFindByIdAndDelete: async () => deletedUser,
        Room: model('rooms', 2),
        Booking: model('bookings', 3),
        BookingProfile: model('bookingProfiles', 1),
        Event: model('events', 4),
        EmailInvitation: model('emailInvitations', 5),
        stripeLib: {
            cleanupUserBilling: async (user) => {
                billingUser = user;
            },
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userDelete(
        { params: { id: 'user_123' }, user: { email: 'admin@example.com', username: 'admin', password: 'secret' } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(billingUser, deletedUser);
    assert.deepEqual(deletedQueries, [
        { name: 'rooms', query: { userId: 'user_123' } },
        { name: 'bookings', query: { userId: 'user_123' } },
        { name: 'bookingProfiles', query: { userId: 'user_123' } },
        { name: 'events', query: { userId: 'user_123' } },
        { name: 'emailInvitations', query: { userId: 'user_123' } },
    ]);
    assert.deepEqual(res.body.deleted, {
        rooms: 2,
        bookings: 3,
        bookingProfiles: 1,
        events: 4,
        emailInvitations: 5,
    });
});

test('userDelete keeps the account when associated data cleanup fails', async (t) => {
    let accountDeleted = false;
    const deletedUser = { _id: 'user_123', email: 'owner@example.com' };
    const harness = loadController({
        isAdmin: async () => true,
        userFindById: async () => deletedUser,
        userFindByIdAndDelete: async () => {
            accountDeleted = true;
            return deletedUser;
        },
        Room: { deleteMany: async () => Promise.reject(new Error('database unavailable')) },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.userDelete(
        { params: { id: 'user_123' }, user: { email: 'admin@example.com', username: 'admin', password: 'secret' } },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(accountDeleted, false);
});
