'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CONTROLLER_PATH = path.resolve(__dirname, '../backend/controllers/stripe.js');
const USER_PATH = path.resolve(__dirname, '../backend/models/users.js');
const STRIPE_PATH = path.resolve(__dirname, '../backend/lib/stripe.js');
const CONFIG_PATH = path.resolve(__dirname, '../backend/config.js');
const SAAS_PATH = path.resolve(__dirname, '../backend/middleware/saas.js');

function loadController({ user, stripeOverrides = {} }) {
    const calls = { checkout: [], canceled: [] };
    const stripe = {
        isEnabled: () => true,
        createSubscriptionCheckout: async () => {
            calls.checkout.push('monthly');
            return { url: 'https://stripe.test/monthly' };
        },
        createLifetimeCheckout: async () => {
            calls.checkout.push('lifetime');
            return { url: 'https://stripe.test/lifetime' };
        },
        cancelSubscription: async (id) => calls.canceled.push(id),
        retrieveCheckoutSession: async () => ({
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_test',
            metadata: { userId: String(user._id) },
        }),
        retrieveSubscription: async () => ({
            id: 'sub_new',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 3600,
            cancel_at_period_end: false,
        }),
        retrievePrice: async (id) =>
            id === 'price_monthly'
                ? { unit_amount: 900, currency: 'usd', recurring: { interval: 'month' } }
                : { unit_amount: 19900, currency: 'usd' },
        ...stripeOverrides,
    };
    const User = {
        findOne: () => user,
        updateOne: async () => {},
    };
    const config = {
        SAAS: {
            enabled: true,
            monthlyPriceId: 'price_monthly',
            lifetimePriceId: 'price_lifetime',
        },
    };

    const replacements = new Map([
        [USER_PATH, User],
        [STRIPE_PATH, stripe],
        [CONFIG_PATH, config],
        [SAAS_PATH, { isSubscriptionActive }],
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
        calls,
        cleanup() {
            delete require.cache[CONTROLLER_PATH];
            for (const [modulePath, cached] of previous) {
                if (cached) require.cache[modulePath] = cached;
                else delete require.cache[modulePath];
            }
        },
    };
}

function isSubscriptionActive(user) {
    if (user.subscriptionType === 'lifetime') return user.subscriptionStatus === 'active';
    return (
        user.subscriptionType === 'monthly' &&
        user.subscriptionStatus === 'active' &&
        new Date(user.subscriptionExpiresAt).getTime() > Date.now()
    );
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

function activeMonthlyUser() {
    const user = {
        _id: 'user_1',
        email: 'user@example.com',
        subscriptionType: 'monthly',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: new Date(Date.now() + 86400000),
        subscriptionCancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_monthly',
        save: async () => {},
    };
    user.select = async () => user;
    return user;
}

test('createCheckout rejects a duplicate monthly subscription', async (t) => {
    const harness = loadController({ user: activeMonthlyUser() });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.createCheckout({ body: { plan: 'monthly' }, user: { email: 'user@example.com' } }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'PLAN_ALREADY_ACTIVE');
    assert.deepEqual(harness.calls.checkout, []);
});

test('createCheckout allows an active monthly user to upgrade to Lifetime', async (t) => {
    const harness = loadController({ user: activeMonthlyUser() });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.createCheckout({ body: { plan: 'lifetime' }, user: { email: 'user@example.com' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.url, 'https://stripe.test/lifetime');
    assert.deepEqual(harness.calls.checkout, ['lifetime']);
});

test('createCheckout rejects every new purchase when Lifetime is active', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    const harness = loadController({ user });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.createCheckout({ body: { plan: 'lifetime' }, user: { email: 'user@example.com' } }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'PLAN_ALREADY_ACTIVE');
    assert.deepEqual(harness.calls.checkout, []);
});

test('verifySession cancels monthly billing when Lifetime activates', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({ user });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.verifySession(
        { query: { session_id: 'cs_lifetime' }, user: { email: 'user@example.com' } },
        res
    );

    assert.equal(res.body.active, true);
    assert.deepEqual(harness.calls.canceled, ['sub_monthly']);
    assert.equal(user.subscriptionType, 'lifetime');
    assert.equal(user.stripeSubscriptionId, undefined);
});

test('verifySession cannot overwrite Lifetime with a stale monthly checkout', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    let retrievedSubscription = false;
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveCheckoutSession: async () => ({
                mode: 'subscription',
                subscription: 'sub_stale',
                customer: 'cus_test',
                metadata: { userId: String(user._id) },
            }),
            retrieveSubscription: async () => {
                retrievedSubscription = true;
            },
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.verifySession(
        { query: { session_id: 'cs_stale' }, user: { email: 'user@example.com' } },
        res
    );

    assert.equal(res.body.active, true);
    assert.equal(user.subscriptionType, 'lifetime');
    assert.equal(retrievedSubscription, false);
});

test('getPlans returns Stripe amounts, currency, and interval', async (t) => {
    const harness = loadController({ user: activeMonthlyUser() });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.getPlans({}, res);

    assert.deepEqual(res.body.monthly, { unitAmount: 900, currency: 'usd', interval: 'month' });
    assert.deepEqual(res.body.lifetime, { unitAmount: 19900, currency: 'usd' });
});

test('getBilling reconciles a scheduled cancellation without marking access inactive', async (t) => {
    const user = activeMonthlyUser();
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveSubscription: async () => ({
                id: 'sub_monthly',
                status: 'active',
                current_period_end: periodEnd,
                cancel_at_period_end: false,
                cancel_at: periodEnd,
            }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.getBilling({ user: { email: 'user@example.com' } }, res);

    assert.equal(res.body.active, true);
    assert.equal(res.body.subscriptionCancelAtPeriodEnd, true);
    assert.equal(res.body.subscriptionStatus, 'active');
    assert.equal(user.subscriptionCancelAtPeriodEnd, true);
});

test('getBilling marks a deleted Stripe subscription as canceled', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveSubscription: async () => {
                const error = new Error('No such subscription');
                error.code = 'resource_missing';
                throw error;
            },
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.getBilling({ user: { email: 'user@example.com' } }, res);

    assert.equal(res.body.active, false);
    assert.equal(res.body.subscriptionStatus, 'canceled');
    assert.equal(res.body.subscriptionCancelAtPeriodEnd, false);
    assert.equal(user.stripeSubscriptionId, undefined);
});
