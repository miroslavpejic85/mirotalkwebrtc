'use strict';

/**
 * Unit tests for backend/lib/stripe.js
 *
 * These tests use the Node.js built-in test runner (node:test) and assert
 * module, so no extra dependencies are required. Run with:
 *   npm test
 *
 * The Stripe SDK is mocked (we never hit the network / a real Stripe account),
 * so we can verify that the wrapper:
 *   - pins the API version the installed SDK expects,
 *   - forwards the right arguments to the Stripe SDK,
 *   - reuses an existing customer id instead of creating a duplicate.
 *
 * Because backend/lib/stripe.js reads config + process.env and requires the
 * `stripe` package at module-load time, every test loads the module in a fresh
 * child module registry after installing the mock and the required env vars.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// The API version pinned by backend/lib/stripe.js. This must match the version
// expected by the installed Stripe Node SDK (v22 -> '2026-06-24.dahlia').
// Update this constant if the SDK / lib pin changes.
const EXPECTED_API_VERSION = '2026-06-24.dahlia';

const LIB_PATH = path.resolve(__dirname, '../backend/lib/stripe.js');
const CONFIG_PATH = path.resolve(__dirname, '../backend/config.js');

/**
 * Load a fresh instance of backend/lib/stripe.js with the `stripe` package and
 * backend/config replaced by lightweight fakes.
 *
 * @param {object} opts
 * @param {boolean} opts.saasEnabled  Value for config.SAAS.enabled.
 * @param {object}  opts.env          Extra process.env values to set for load.
 * @returns {{ lib: object, fakeStripe: object, initArgs: any[] }}
 */
function loadStripeLib({ saasEnabled = true, env = {} } = {}) {
    // Record how the mock Stripe constructor was invoked.
    const initArgs = [];

    // A minimal fake of the Stripe SDK surface used by the wrapper.
    const fakeStripe = {
        customers: {
            create: async (params) => ({ id: 'cus_test_123', __params: params }),
        },
        checkout: {
            sessions: {
                create: async (params) => ({
                    id: 'cs_test_123',
                    url: 'https://stripe.test/checkout',
                    __params: params,
                }),
                retrieve: async (id) => ({ id, payment_status: 'paid', __retrieved: true }),
            },
        },
        billingPortal: {
            sessions: {
                create: async (params) => ({ id: 'bps_test_123', url: 'https://stripe.test/portal', __params: params }),
            },
        },
        webhooks: {
            constructEvent: (rawBody, signature, secret) => ({
                type: 'checkout.session.completed',
                __rawBody: rawBody,
                __signature: signature,
                __secret: secret,
            }),
        },
        subscriptions: {
            retrieve: async (id) => ({ id, status: 'active', __retrieved: true }),
        },
    };

    // Constructor stand-in for `require('stripe')(secretKey, opts)`.
    const stripeFactory = function stripeFactory(secretKey, opts) {
        initArgs.push({ secretKey, opts });
        return fakeStripe;
    };

    const fakeConfig = {
        SAAS: {
            enabled: saasEnabled,
            stripePublishableKey: 'pk_test',
            monthlyPriceId: 'price_monthly',
            lifetimePriceId: 'price_lifetime',
            pricing: { monthly: '$9', lifetime: '$199' },
        },
    };

    // Intercept require() for the two modules we want to control, and load the
    // lib in isolation from any previously cached copy.
    const originalLoad = Module._load;
    const previousEnv = { ...process.env };

    // Apply env used by the lib at load time.
    process.env.STRIPE_SECRET_KEY = 'sk_test_load';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly';
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime';
    Object.assign(process.env, env);

    Module._load = function (request, parent, isMain) {
        if (request === 'stripe') return stripeFactory;
        const resolved = (() => {
            try {
                return Module._resolveFilename(request, parent, isMain);
            } catch {
                return null;
            }
        })();
        if (resolved === CONFIG_PATH) return fakeConfig;
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[LIB_PATH];
        delete require.cache[CONFIG_PATH];
        const lib = require(LIB_PATH);
        return { lib, fakeStripe, initArgs };
    } finally {
        Module._load = originalLoad;
        delete require.cache[LIB_PATH];
        delete require.cache[CONFIG_PATH];
        // Restore env to avoid leaking between tests.
        for (const key of Object.keys(process.env)) {
            if (!(key in previousEnv)) delete process.env[key];
        }
        Object.assign(process.env, previousEnv);
    }
}

test('initializes the Stripe SDK with the pinned API version when SAAS is enabled', () => {
    const { lib, initArgs } = loadStripeLib({ saasEnabled: true });

    assert.equal(lib.isEnabled(), true, 'isEnabled() should be true when SAAS is on and a secret key is present');
    assert.equal(initArgs.length, 1, 'Stripe should be constructed exactly once');
    assert.equal(initArgs[0].secretKey, 'sk_test_load');
    assert.equal(
        initArgs[0].opts.apiVersion,
        EXPECTED_API_VERSION,
        `apiVersion must match the SDK-pinned version (${EXPECTED_API_VERSION})`
    );
});

test('does not initialize Stripe and reports disabled when SAAS is off', () => {
    const { lib, initArgs } = loadStripeLib({ saasEnabled: false });

    assert.equal(initArgs.length, 0, 'Stripe should not be constructed when SAAS is disabled');
    assert.equal(lib.isEnabled(), false, 'isEnabled() should be false when SAAS is disabled');
});

test('reports disabled when SAAS is enabled but the secret key is missing', () => {
    const { lib, initArgs } = loadStripeLib({ saasEnabled: true, env: { STRIPE_SECRET_KEY: '' } });

    assert.equal(initArgs.length, 0, 'Stripe should not be constructed without a secret key');
    assert.equal(lib.isEnabled(), false);
});

test('createSubscriptionCheckout creates a subscription-mode session for the monthly price', async () => {
    const { lib } = loadStripeLib({ saasEnabled: true });

    const user = {
        _id: 'u1',
        email: 'a@b.c',
        username: 'alice',
        stripeCustomerId: 'cus_existing',
        save: async () => {},
    };
    const session = await lib.createSubscriptionCheckout(user, 'https://ok', 'https://cancel');

    assert.equal(session.__params.mode, 'subscription');
    assert.equal(session.__params.customer, 'cus_existing');
    assert.deepEqual(session.__params.line_items, [{ price: 'price_monthly', quantity: 1 }]);
    assert.equal(session.__params.success_url, 'https://ok');
    assert.equal(session.__params.cancel_url, 'https://cancel');
    assert.equal(session.__params.metadata.plan, 'monthly');
    assert.equal(session.__params.metadata.userId, 'u1');
});

test('createLifetimeCheckout creates a payment-mode session for the lifetime price', async () => {
    const { lib } = loadStripeLib({ saasEnabled: true });

    const user = { _id: 'u2', email: 'x@y.z', username: 'bob', stripeCustomerId: 'cus_existing', save: async () => {} };
    const session = await lib.createLifetimeCheckout(user, 'https://ok', 'https://cancel');

    assert.equal(session.__params.mode, 'payment');
    assert.deepEqual(session.__params.line_items, [{ price: 'price_lifetime', quantity: 1 }]);
    assert.equal(session.__params.metadata.plan, 'lifetime');
});

test('getOrCreateCustomer reuses an existing customer id without calling Stripe', async () => {
    const { lib, fakeStripe } = loadStripeLib({ saasEnabled: true });

    let createCalled = false;
    fakeStripe.customers.create = async () => {
        createCalled = true;
        return { id: 'cus_should_not_be_used' };
    };

    const user = {
        _id: 'u3',
        email: 'a@b.c',
        username: 'alice',
        stripeCustomerId: 'cus_existing',
        save: async () => {},
    };
    const id = await lib.getOrCreateCustomer(user);

    assert.equal(id, 'cus_existing');
    assert.equal(createCalled, false, 'Stripe customers.create must not be called when a customer id already exists');
});

test('getOrCreateCustomer creates and persists a new customer id when missing', async () => {
    const { lib } = loadStripeLib({ saasEnabled: true });

    let saved = false;
    const user = {
        _id: 'u4',
        email: 'new@user.com',
        username: 'carol',
        stripeCustomerId: undefined,
        save: async () => {
            saved = true;
        },
    };

    const id = await lib.getOrCreateCustomer(user);

    assert.equal(id, 'cus_test_123');
    assert.equal(user.stripeCustomerId, 'cus_test_123', 'the new customer id should be written back to the user');
    assert.equal(saved, true, 'the user document should be persisted after creating a customer');
});

test('constructEvent verifies the webhook signature with the configured secret', () => {
    const { lib } = loadStripeLib({ saasEnabled: true, env: { STRIPE_WEBHOOK_SECRET: 'whsec_expected' } });

    const event = lib.constructEvent(Buffer.from('{}'), 'sig_header');

    assert.equal(event.__secret, 'whsec_expected');
    assert.equal(event.__signature, 'sig_header');
    assert.equal(event.type, 'checkout.session.completed');
});

test('createBillingPortal forwards the customer id and return url', async () => {
    const { lib } = loadStripeLib({ saasEnabled: true });

    const portal = await lib.createBillingPortal('cus_existing', 'https://return');

    assert.equal(portal.__params.customer, 'cus_existing');
    assert.equal(portal.__params.return_url, 'https://return');
});
