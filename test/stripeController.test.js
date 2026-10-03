'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CONTROLLER_PATH = path.resolve(__dirname, '../backend/controllers/stripe.js');
const USER_PATH = path.resolve(__dirname, '../backend/models/users.js');
const STRIPE_PATH = path.resolve(__dirname, '../backend/lib/stripe.js');
const CONFIG_PATH = path.resolve(__dirname, '../backend/config.js');
const SAAS_PATH = path.resolve(__dirname, '../backend/middleware/saas.js');
const NODEMAILER_PATH = path.resolve(__dirname, '../backend/lib/nodemailer.js');

function loadController({
    user,
    stripeOverrides = {},
    mailerOverrides = {},
    adminNotifications = false,
    adminEmail = 'admin@example.com',
}) {
    const previousAdminNotifications = process.env.SAAS_ADMIN_EMAIL_NOTIFICATIONS;
    const previousAdminEmail = process.env.ADMIN_EMAIL;
    process.env.SAAS_ADMIN_EMAIL_NOTIFICATIONS = String(adminNotifications);
    process.env.ADMIN_EMAIL = adminEmail;
    const calls = { checkout: [], canceled: [], emails: [], adminEmails: [], planChanges: [], updated: [] };
    const stripe = {
        isEnabled: () => true,
        getSubscriptionDashboardUrl: async (id, livemode) =>
            `https://dashboard.stripe.com/acct_test/${livemode ? '' : 'test/'}subscriptions/${encodeURIComponent(id)}`,
        createSubscriptionCheckout: async () => {
            calls.checkout.push('monthly');
            return { url: 'https://stripe.test/monthly' };
        },
        createYearlySubscriptionCheckout: async () => {
            calls.checkout.push('yearly');
            return { url: 'https://stripe.test/yearly' };
        },
        createLifetimeCheckout: async () => {
            calls.checkout.push('lifetime');
            return { url: 'https://stripe.test/lifetime' };
        },
        cancelSubscription: async (id) => calls.canceled.push(id),
        constructEvent: () => ({ type: 'unhandled', data: { object: {} } }),
        retrieveCheckoutSession: async () => ({
            id: 'cs_test',
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_test',
            ...lifetimePayment(user),
        }),
        retrieveSubscription: async (id) => ({
            id,
            customer: 'cus_test',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 3600,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: id.includes('yearly') ? 'price_yearly' : 'price_monthly' } }] },
        }),
        upgradeSubscriptionToYearly: async (id) => {
            calls.planChanges.push(id);
            return {
                id,
                customer: 'cus_test',
                livemode: false,
                status: 'active',
                current_period_end: Math.floor(Date.now() / 1000) + 31536000,
                cancel_at_period_end: false,
                items: { data: [{ price: { id: 'price_yearly' } }] },
                metadata: { plan: 'yearly' },
            };
        },
        retrievePrice: async (id) => {
            if (id === 'price_monthly') return { unit_amount: 900, currency: 'usd', recurring: { interval: 'month' } };
            if (id === 'price_yearly') return { unit_amount: 7900, currency: 'usd', recurring: { interval: 'year' } };
            return { unit_amount: 19900, currency: 'usd' };
        },
        ...stripeOverrides,
    };
    const User = {
        findOne: () => user,
        updateOne: async (filter, update) => {
            calls.updated.push({ filter, update });
            const matchesCustomer = !filter.stripeCustomerId || user.stripeCustomerId === filter.stripeCustomerId;
            const excludesCurrentPlan = filter.subscriptionType?.$ne === user.subscriptionType;
            const matchesId = !filter._id || String(user._id) === String(filter._id);
            const matchesPayment =
                !filter.stripeLifetimePaymentIntentId ||
                (typeof filter.stripeLifetimePaymentIntentId === 'string'
                    ? user.stripeLifetimePaymentIntentId === filter.stripeLifetimePaymentIntentId
                    : user.stripeLifetimePaymentIntentId === undefined);
            const matchesPlan =
                typeof filter.subscriptionType !== 'string' || user.subscriptionType === filter.subscriptionType;
            if (!matchesCustomer || excludesCurrentPlan || !matchesId || !matchesPayment || !matchesPlan) return;
            if (update.$addToSet) {
                user.revokedLifetimePaymentIntentIds = [
                    ...new Set([
                        ...(user.revokedLifetimePaymentIntentIds || []),
                        update.$addToSet.revokedLifetimePaymentIntentIds,
                    ]),
                ];
            }
            if (update.$set) {
                Object.assign(user, update.$set);
            }
            if (update.$pull?.subscriptionAdminEmailKeys) {
                user.subscriptionAdminEmailKeys = (user.subscriptionAdminEmailKeys || []).filter(
                    (key) => key !== update.$pull.subscriptionAdminEmailKeys
                );
            }
            if (
                update.$unset?.subscriptionActivationEmailKey !== undefined &&
                user.subscriptionActivationEmailKey === filter.subscriptionActivationEmailKey
            ) {
                delete user.subscriptionActivationEmailKey;
            }
        },
        findOneAndUpdate: async (filter, update) => {
            if (filter._id && String(user._id) !== String(filter._id)) return null;
            if (
                filter.revokedLifetimePaymentIntentIds &&
                user.revokedLifetimePaymentIntentIds?.includes(filter.revokedLifetimePaymentIntentIds.$ne)
            )
                return null;
            if (filter.stripeCustomerId && user.stripeCustomerId !== filter.stripeCustomerId) return null;
            if (filter.stripeSubscriptionId && user.stripeSubscriptionId !== filter.stripeSubscriptionId) return null;
            if (filter.subscriptionType && user.subscriptionType !== filter.subscriptionType) return null;
            const activationKey = filter.subscriptionActivationEmailKey?.$ne;
            if (activationKey && user.subscriptionActivationEmailKey === activationKey) return null;
            const adminKey = filter.subscriptionAdminEmailKeys?.$ne;
            if (adminKey && user.subscriptionAdminEmailKeys?.includes(adminKey)) return null;
            if (update.$addToSet?.subscriptionAdminEmailKeys) {
                user.subscriptionAdminEmailKeys = [
                    ...(user.subscriptionAdminEmailKeys || []),
                    update.$addToSet.subscriptionAdminEmailKeys,
                ];
            }
            if (update.$set) Object.assign(user, update.$set);
            if (update.$unset) for (const field of Object.keys(update.$unset)) delete user[field];
            return user;
        },
    };
    const config = {
        SAAS: {
            enabled: true,
            monthlyPriceId: 'price_monthly',
            yearlyPriceId: 'price_yearly',
            lifetimePriceId: 'price_lifetime',
        },
    };

    const replacements = new Map([
        [USER_PATH, User],
        [STRIPE_PATH, stripe],
        [CONFIG_PATH, config],
        [SAAS_PATH, { isSubscriptionActive }],
        [
            NODEMAILER_PATH,
            {
                sendPlanActivatedEmail: async (...args) => calls.emails.push(args),
                sendAdminSubscriptionEmail: async (details) => calls.adminEmails.push(details),
                ...mailerOverrides,
            },
        ],
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
            if (previousAdminNotifications === undefined) delete process.env.SAAS_ADMIN_EMAIL_NOTIFICATIONS;
            else process.env.SAAS_ADMIN_EMAIL_NOTIFICATIONS = previousAdminNotifications;
            if (previousAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
            else process.env.ADMIN_EMAIL = previousAdminEmail;
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
        ['monthly', 'yearly'].includes(user.subscriptionType) &&
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
        username: 'Test User',
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

function adminSubscriptionEvent(type = 'customer.subscription.created', overrides = {}) {
    return {
        type,
        created: 1791000000,
        livemode: true,
        data: {
            object: {
                id: 'sub_monthly',
                customer: 'cus_test',
                status: type === 'customer.subscription.deleted' ? 'canceled' : 'active',
                created: 1790000000,
                current_period_end: 1792000000,
                items: { data: [{ price: { id: 'price_monthly' } }] },
                ...overrides,
            },
        },
    };
}

test('admin subscription emails deduplicate concurrent deliveries and distinguish creation from ending', async (t) => {
    const user = activeMonthlyUser();
    let event = adminSubscriptionEvent();
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: () => event },
    });
    t.after(harness.cleanup);
    const request = { headers: {}, body: Buffer.from('{}') };
    const responses = [createResponse(), createResponse()];
    await Promise.all(responses.map((response) => harness.controller.handleWebhook(request, response)));
    assert.ok(responses.every((response) => response.statusCode === 200));
    assert.equal(harness.calls.adminEmails.length, 1);
    assert.equal(harness.calls.emails.length, 1);
    assert.deepEqual(harness.calls.adminEmails[0], {
        eventType: 'customer.subscription.created',
        name: user.username,
        email: user.email,
        plan: 'monthly',
        status: 'active',
        subscriptionId: 'sub_monthly',
        livemode: true,
        dashboardUrl: 'https://dashboard.stripe.com/acct_test/subscriptions/sub_monthly',
        eventAt: new Date(1790000000000),
        expiresAt: new Date(1792000000000),
    });

    event = adminSubscriptionEvent('customer.subscription.deleted', { ended_at: 1791000100 });
    await harness.controller.handleWebhook(request, createResponse());
    await harness.controller.handleWebhook(request, createResponse());
    assert.equal(harness.calls.adminEmails.length, 2);
    assert.equal(harness.calls.adminEmails[1].eventType, 'customer.subscription.deleted');
    assert.equal(harness.calls.adminEmails[1].status, 'canceled');
    assert.equal(harness.calls.adminEmails[1].eventAt.getTime(), 1791000100000);
    assert.equal(user.subscriptionStatus, 'canceled');
    assert.equal(harness.calls.emails.length, 1);

    event = adminSubscriptionEvent('customer.subscription.created', { id: 'sub_second' });
    await harness.controller.handleWebhook(request, createResponse());
    event = adminSubscriptionEvent();
    await harness.controller.handleWebhook(request, createResponse());
    assert.equal(harness.calls.adminEmails.length, 3);
});

test('admin subscription notification failures return 500 and allow a webhook retry', async (t) => {
    const user = activeMonthlyUser();
    let attempts = 0;
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: () => adminSubscriptionEvent('customer.subscription.deleted') },
        mailerOverrides: {
            sendAdminSubscriptionEmail: async () => {
                if (++attempts === 1) throw new Error('SMTP unavailable');
            },
        },
    });
    t.after(harness.cleanup);
    const request = { headers: {}, body: Buffer.from('{}') };
    const failed = createResponse();
    await harness.controller.handleWebhook(request, failed);
    assert.equal(failed.statusCode, 500);
    assert.deepEqual(user.subscriptionAdminEmailKeys, []);
    const retried = createResponse();
    await harness.controller.handleWebhook(request, retried);
    assert.equal(retried.statusCode, 200);
    await harness.controller.handleWebhook(request, createResponse());
    assert.equal(attempts, 2);
    assert.equal(user.subscriptionStatus, 'canceled');
});

test('admin subscription notifications are disabled by default', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: { constructEvent: () => adminSubscriptionEvent() },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(harness.calls.adminEmails.length, 0);
    assert.equal(user.subscriptionAdminEmailKeys, undefined);
    assert.equal(harness.calls.emails.length, 1);
});

test('Dashboard account lookup failure releases the email marker for webhook retry', async (t) => {
    const user = activeMonthlyUser();
    let lookups = 0;
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: {
            constructEvent: () => adminSubscriptionEvent(),
            getSubscriptionDashboardUrl: async () => {
                if (++lookups === 1) throw new Error('Stripe account lookup unavailable');
                return 'https://dashboard.stripe.com/acct_test/subscriptions/sub_monthly';
            },
        },
    });
    t.after(harness.cleanup);
    const request = { headers: {}, body: Buffer.from('{}') };
    const failed = createResponse();
    await harness.controller.handleWebhook(request, failed);
    assert.equal(failed.statusCode, 500);
    assert.deepEqual(user.subscriptionAdminEmailKeys, []);
    assert.equal(harness.calls.adminEmails.length, 0);
    const retried = createResponse();
    await harness.controller.handleWebhook(request, retried);
    assert.equal(retried.statusCode, 200);
    assert.equal(harness.calls.adminEmails.length, 1);
});

test('enabled admin notifications require a recipient before claiming a delivery', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        adminNotifications: true,
        adminEmail: '',
        stripeOverrides: { constructEvent: () => adminSubscriptionEvent() },
    });
    t.after(harness.cleanup);
    const response = createResponse();
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(user.subscriptionAdminEmailKeys, undefined);
    assert.equal(harness.calls.adminEmails.length, 0);
});

test('admin creation email reports incomplete status without sending customer activation', async (t) => {
    const user = activeMonthlyUser();
    const event = adminSubscriptionEvent('customer.subscription.created', {
        status: 'incomplete',
        items: { data: [{ price: { id: 'price_yearly' } }] },
    });
    event.livemode = false;
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: () => event },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(harness.calls.emails.length, 0);
    assert.equal(harness.calls.adminEmails.length, 1);
    assert.equal(harness.calls.adminEmails[0].status, 'incomplete');
    assert.equal(harness.calls.adminEmails[0].plan, 'yearly');
    assert.equal(harness.calls.adminEmails[0].livemode, false);
});

test('admin subscription emails exclude updates and unrelated Stripe plans', async (t) => {
    const user = activeMonthlyUser();
    let event = adminSubscriptionEvent('customer.subscription.updated');
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: () => event },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    event = adminSubscriptionEvent('customer.subscription.created', {
        items: { data: [{ price: { id: 'price_unrelated' } }] },
    });
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(harness.calls.adminEmails.length, 0);
});

function adminUpgradeEvent() {
    const event = adminSubscriptionEvent('customer.subscription.updated', {
        items: { data: [{ price: { id: 'price_yearly' } }] },
    });
    event.data.previous_attributes = { items: { data: [{ price: { id: 'price_monthly' } }] } };
    return event;
}

test('Annual upgrade sends one admin email across the app request and webhook', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: adminUpgradeEvent },
    });
    t.after(harness.cleanup);
    const response = createResponse();
    await harness.controller.changePlan({ body: { plan: 'yearly' }, user: { email: user.email } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(harness.calls.adminEmails.length, 1);
    assert.equal(harness.calls.adminEmails[0].eventType, 'customer.subscription.updated');
    assert.equal(harness.calls.adminEmails[0].plan, 'yearly');
    assert.equal(harness.calls.adminEmails[0].livemode, false);
    const request = { headers: {}, body: Buffer.from('{}') };
    await harness.controller.handleWebhook(request, createResponse());
    await harness.controller.handleWebhook(request, createResponse());
    assert.equal(harness.calls.adminEmails.length, 1);
    assert.deepEqual(user.subscriptionAdminEmailKeys, ['customer.subscription.updated:sub_monthly:plan:yearly']);
});

test('upgrade webhook identifies the price transition even after local reconciliation', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'yearly';
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: adminUpgradeEvent },
    });
    t.after(harness.cleanup);
    const request = { headers: {}, body: Buffer.from('{}') };
    const responses = [createResponse(), createResponse()];
    await Promise.all(responses.map((response) => harness.controller.handleWebhook(request, response)));
    assert.ok(responses.every((response) => response.statusCode === 200));
    assert.equal(harness.calls.adminEmails.length, 1);
    assert.equal(harness.calls.adminEmails[0].eventAt.getTime(), 1791000000000);
});

test('SMTP failure preserves a successful Annual upgrade and the webhook retries its email', async (t) => {
    const user = activeMonthlyUser();
    let attempts = 0;
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: adminUpgradeEvent },
        mailerOverrides: {
            sendAdminSubscriptionEmail: async () => {
                if (++attempts <= 2) throw new Error('SMTP unavailable');
            },
        },
    });
    t.after(harness.cleanup);
    const upgraded = createResponse();
    await harness.controller.changePlan({ body: { plan: 'yearly' }, user: { email: user.email } }, upgraded);
    assert.equal(upgraded.statusCode, 200);
    assert.equal(user.subscriptionType, 'yearly');
    assert.deepEqual(user.subscriptionAdminEmailKeys, []);
    const request = { headers: {}, body: Buffer.from('{}') };
    const failed = createResponse();
    await harness.controller.handleWebhook(request, failed);
    assert.equal(failed.statusCode, 500);
    const retried = createResponse();
    await harness.controller.handleWebhook(request, retried);
    assert.equal(retried.statusCode, 200);
    await harness.controller.handleWebhook(request, createResponse());
    assert.equal(attempts, 3);
});

test('yearly renewals and scheduled cancellations do not send upgrade notifications', async (t) => {
    const user = activeMonthlyUser();
    let event = adminUpgradeEvent();
    event.data.previous_attributes = {
        items: { data: [{ price: { id: 'price_yearly' } }] },
    };
    const harness = loadController({
        user,
        adminNotifications: true,
        stripeOverrides: { constructEvent: () => event },
    });
    t.after(harness.cleanup);
    const request = { headers: {}, body: Buffer.from('{}') };
    await harness.controller.handleWebhook(request, createResponse());
    event = adminUpgradeEvent();
    event.data.previous_attributes = { cancel_at_period_end: false };
    event.data.object.cancel_at_period_end = true;
    await harness.controller.handleWebhook(request, createResponse());
    assert.equal(harness.calls.adminEmails.length, 0);
});

function lifetimePayment(user) {
    return {
        status: 'complete',
        amount_total: 19900,
        currency: 'usd',
        metadata: { userId: String(user._id), plan: 'lifetime' },
        line_items: { has_more: false, data: [{ price: { id: 'price_lifetime' }, quantity: 1 }] },
        payment_intent: {
            id: 'pi_lifetime',
            status: 'succeeded',
            customer: 'cus_test',
            amount_received: 19900,
            currency: 'usd',
            latest_charge: {
                id: 'ch_lifetime',
                payment_intent: 'pi_lifetime',
                customer: 'cus_test',
                paid: true,
                captured: true,
                refunded: false,
                amount_refunded: 0,
                disputed: false,
                currency: 'usd',
            },
        },
    };
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

test('changePlan upgrades an active monthly subscription to yearly', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionActivationEmailKey = 'subscription:sub_monthly';
    const harness = loadController({ user });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.changePlan({ body: { plan: 'yearly' }, user: { email: user.email } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.subscriptionType, 'yearly');
    assert.equal(user.subscriptionType, 'yearly');
    assert.deepEqual(harness.calls.planChanges, ['sub_monthly']);
    assert.equal(harness.calls.emails.length, 1);
    assert.deepEqual(harness.calls.emails[0].slice(0, 3), ['Test User', 'user@example.com', 'yearly']);
    assert.equal(user.subscriptionActivationEmailKey, 'subscription:sub_monthly:plan:yearly');
});

test('changePlan rejects yearly to monthly downgrades', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'yearly';
    const harness = loadController({ user });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.changePlan({ body: { plan: 'monthly' }, user: { email: user.email } }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'PLAN_CHANGE_NOT_ALLOWED');
    assert.deepEqual(harness.calls.planChanges, []);
});

test('createCheckout creates a yearly subscription for a user without an active plan', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = null;
    user.subscriptionStatus = null;
    const harness = loadController({ user });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.createCheckout({ body: { plan: 'yearly' }, user: { email: user.email } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.url, 'https://stripe.test/yearly');
    assert.deepEqual(harness.calls.checkout, ['yearly']);
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
    assert.deepEqual(res.body.yearly, { unitAmount: 7900, currency: 'usd', interval: 'year' });
    assert.deepEqual(res.body.lifetime, { unitAmount: 19900, currency: 'usd' });
});

test('verifySession activates the yearly plan from the purchased Stripe price', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = null;
    user.subscriptionStatus = null;
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveCheckoutSession: async () => ({
                mode: 'subscription',
                subscription: 'sub_yearly',
                customer: 'cus_test',
                metadata: { userId: String(user._id), plan: 'yearly' },
            }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.verifySession({ query: { session_id: 'cs_yearly' }, user: { email: user.email } }, res);

    assert.equal(res.body.active, true);
    assert.equal(user.subscriptionType, 'yearly');
    assert.equal(user.stripeSubscriptionId, 'sub_yearly');
    assert.deepEqual(harness.calls.emails[0].slice(0, 3), ['Test User', 'user@example.com', 'yearly']);
});

test('verifySession and webhook send only one email for the same subscription', async (t) => {
    const user = activeMonthlyUser();
    user.username = 'Test User';
    user.subscriptionType = null;
    user.subscriptionStatus = null;
    const subscription = {
        id: 'sub_new',
        customer: 'cus_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        metadata: { plan: 'yearly' },
        items: { data: [{ price: { id: 'price_yearly' } }] },
    };
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveCheckoutSession: async () => ({
                id: 'cs_yearly',
                mode: 'subscription',
                subscription: subscription.id,
                customer: subscription.customer,
                metadata: { userId: String(user._id), plan: 'yearly' },
            }),
            retrieveSubscription: async () => subscription,
            constructEvent: () => ({ type: 'customer.subscription.created', data: { object: subscription } }),
        },
    });
    t.after(harness.cleanup);

    await harness.controller.verifySession(
        { query: { session_id: 'cs_yearly' }, user: { email: user.email } },
        createResponse()
    );
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());

    assert.equal(harness.calls.emails.length, 1);
    assert.equal(user.subscriptionActivationEmailKey, 'subscription:sub_new');
});

test('verifySession and webhook send only one email for the same Lifetime checkout', async (t) => {
    const user = activeMonthlyUser();
    const session = {
        id: 'cs_lifetime',
        mode: 'payment',
        payment_status: 'paid',
        customer: 'cus_test',
        metadata: { userId: String(user._id), plan: 'lifetime' },
        ...lifetimePayment(user),
    };
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveCheckoutSession: async () => session,
            constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }),
        },
    });
    t.after(harness.cleanup);

    await harness.controller.verifySession(
        { query: { session_id: session.id }, user: { email: user.email } },
        createResponse()
    );
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());

    assert.equal(harness.calls.emails.length, 1);
    assert.equal(user.subscriptionActivationEmailKey, 'checkout:cs_lifetime');
});

test('unpaid Lifetime checkout webhook does not activate access or send email', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => ({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_unpaid',
                        mode: 'payment',
                        payment_status: 'unpaid',
                        customer: 'cus_test',
                    },
                },
            }),
        },
    });
    t.after(harness.cleanup);

    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());

    assert.equal(user.subscriptionType, 'monthly');
    assert.equal(harness.calls.emails.length, 0);
    assert.deepEqual(harness.calls.canceled, []);
});

test('activation remains successful and a later verification retries after email failure', async (t) => {
    const user = activeMonthlyUser();
    let attempts = 0;
    const harness = loadController({
        user,
        mailerOverrides: {
            sendPlanActivatedEmail: async () => {
                attempts++;
                if (attempts === 1) throw new Error('SMTP unavailable');
            },
        },
    });
    t.after(harness.cleanup);

    const firstResponse = createResponse();
    await harness.controller.verifySession(
        { query: { session_id: 'cs_test' }, user: { email: user.email } },
        firstResponse
    );
    assert.equal(firstResponse.body.active, true);
    assert.equal(user.subscriptionActivationEmailKey, undefined);

    await harness.controller.verifySession(
        { query: { session_id: 'cs_test' }, user: { email: user.email } },
        createResponse()
    );
    assert.equal(attempts, 2);
    assert.equal(user.subscriptionActivationEmailKey, 'checkout:cs_test');
});

test('subscription webhook stores the purchased yearly plan', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => ({
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_yearly',
                        customer: 'cus_test',
                        status: 'active',
                        current_period_end: Math.floor(Date.now() / 1000) + 86400,
                        metadata: { plan: 'yearly' },
                        items: { data: [{ price: { id: 'price_yearly' } }] },
                    },
                },
            }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(harness.calls.updated.length, 1);
    assert.equal(harness.calls.updated[0].update.$set.subscriptionType, 'yearly');
    assert.equal(harness.calls.emails.length, 1);
    assert.equal(harness.calls.emails[0][2], 'yearly');
});

test('subscription update webhook trusts the yearly price over stale monthly metadata', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => ({
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_monthly',
                        customer: 'cus_test',
                        status: 'active',
                        current_period_end: Math.floor(Date.now() / 1000) + 31536000,
                        metadata: { plan: 'monthly' },
                        items: { data: [{ price: { id: 'price_yearly' } }] },
                    },
                },
            }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(harness.calls.updated[0].update.$set.subscriptionType, 'yearly');
});

test('stale recurring creation does not email a Lifetime user', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    user.stripeSubscriptionId = undefined;
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => ({
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_stale',
                        customer: 'cus_test',
                        status: 'active',
                        current_period_end: Math.floor(Date.now() / 1000) + 86400,
                        metadata: { plan: 'monthly' },
                    },
                },
            }),
        },
    });
    t.after(harness.cleanup);

    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());

    assert.equal(harness.calls.emails.length, 0);
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
                items: { data: [{ price: { id: 'price_monthly' } }] },
            }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.controller.getBilling({ user: { email: 'user@example.com' } }, res);

    assert.equal(res.body.active, true);
    assert.equal(res.body.hasRecurringSubscription, true);
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
    assert.equal(res.body.hasRecurringSubscription, false);
    assert.equal(res.body.subscriptionStatus, 'canceled');
    assert.equal(res.body.subscriptionCancelAtPeriodEnd, false);
    assert.equal(user.stripeSubscriptionId, undefined);
});

for (const [name, mutate] of [
    [
        'unrelated product',
        (session) => {
            session.line_items.data[0].price.id = 'price_other';
        },
    ],
    [
        'wrong plan metadata',
        (session) => {
            session.metadata.plan = 'monthly';
        },
    ],
    [
        'conflicting user metadata',
        (session) => {
            session.metadata.userId = 'other-user';
        },
    ],
    [
        'conflicting customer',
        (session) => {
            session.customer = 'cus_other';
        },
    ],
    [
        'incomplete checkout',
        (session) => {
            session.status = 'open';
        },
    ],
    [
        'refunded payment',
        (session) => {
            session.payment_intent.latest_charge.amount_refunded = 19900;
        },
    ],
    [
        'partial refund',
        (session) => {
            session.payment_intent.latest_charge.amount_refunded = 100;
        },
    ],
    [
        'disputed payment',
        (session) => {
            session.payment_intent.latest_charge.disputed = true;
        },
    ],
    [
        'unexpanded payment',
        (session) => {
            session.payment_intent = 'pi_lifetime';
        },
    ],
    [
        'zero payment',
        (session) => {
            session.amount_total = 0;
        },
    ],
    [
        'amount mismatch',
        (session) => {
            session.payment_intent.amount_received = 100;
        },
    ],
]) {
    test(`verifySession rejects Lifetime activation for ${name}`, async (t) => {
        const user = activeMonthlyUser();
        const session = {
            id: 'cs_invalid',
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_test',
            ...lifetimePayment(user),
        };
        mutate(session);
        const harness = loadController({ user, stripeOverrides: { retrieveCheckoutSession: async () => session } });
        t.after(harness.cleanup);
        const res = createResponse();
        await harness.controller.verifySession({ query: { session_id: session.id }, user: { email: user.email } }, res);
        assert.ok([400, 403].includes(res.statusCode));
        assert.equal(user.subscriptionType, 'monthly');
        assert.deepEqual(harness.calls.canceled, []);
        assert.equal(harness.calls.emails.length, 0);
    });
}

test('Lifetime webhook rechecks the current payment instead of trusting an old paid event', async (t) => {
    const user = activeMonthlyUser();
    const session = {
        id: 'cs_refunded',
        mode: 'payment',
        payment_status: 'paid',
        customer: 'cus_test',
        ...lifetimePayment(user),
    };
    const currentSession = structuredClone(session);
    currentSession.payment_intent.latest_charge.refunded = true;
    currentSession.payment_intent.latest_charge.amount_refunded = 19900;
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }),
            retrieveCheckoutSession: async () => currentSession,
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.subscriptionType, 'monthly');
});

for (const eventType of ['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed']) {
    test(`${eventType} revokes Lifetime and blocks replay even if Stripe later reports paid`, async (t) => {
        const user = activeMonthlyUser();
        const session = {
            id: 'cs_lifetime',
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_test',
            ...lifetimePayment(user),
        };
        const charge = { ...session.payment_intent.latest_charge, amount_refunded: 19900 };
        const harness = loadController({
            user,
            stripeOverrides: {
                retrieveCheckoutSession: async () => session,
                retrieveCharge: async (id) => {
                    assert.equal(id, charge.id);
                    return charge;
                },
                constructEvent: () => ({
                    type: eventType,
                    data: { object: eventType === 'charge.refunded' ? charge : { charge: charge.id, status: 'lost' } },
                }),
            },
        });
        t.after(harness.cleanup);
        await harness.controller.verifySession(
            { query: { session_id: session.id }, user: { email: user.email } },
            createResponse()
        );
        assert.equal(user.stripeLifetimePaymentIntentId, 'pi_lifetime');
        assert.equal(user.stripeLifetimeCheckoutSessionId, session.id);
        await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
        assert.equal(user.subscriptionStatus, 'canceled');
        assert.deepEqual(user.revokedLifetimePaymentIntentIds, ['pi_lifetime']);
        const res = createResponse();
        await harness.controller.verifySession({ query: { session_id: session.id }, user: { email: user.email } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(user.subscriptionStatus, 'canceled');
    });
}

test('refund of another payment does not revoke the current Lifetime purchase', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    user.stripeLifetimePaymentIntentId = 'pi_current';
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => ({
                type: 'charge.refunded',
                data: { object: { customer: 'cus_test', payment_intent: 'pi_other', amount_refunded: 100 } },
            }),
        },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(user.subscriptionStatus, 'active');
});

test('refund before activation prevents a later checkout webhook from granting Lifetime', async (t) => {
    const user = activeMonthlyUser();
    let event = {
        type: 'charge.refunded',
        data: { object: { customer: 'cus_test', payment_intent: 'pi_lifetime', amount_refunded: 19900 } },
    };
    const session = {
        id: 'cs_lifetime',
        mode: 'payment',
        payment_status: 'paid',
        customer: 'cus_test',
        ...lifetimePayment(user),
    };
    const harness = loadController({
        user,
        stripeOverrides: {
            constructEvent: () => event,
            retrieveCheckoutSession: async () => session,
        },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    event = { type: 'checkout.session.completed', data: { object: session } };
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(user.subscriptionType, 'monthly');
    assert.deepEqual(harness.calls.canceled, []);
});

test('refund resolves and revokes a legacy Lifetime purchase without stored payment IDs', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    const session = {
        id: 'cs_legacy',
        mode: 'payment',
        payment_status: 'paid',
        customer: 'cus_test',
        ...lifetimePayment(user),
    };
    const harness = loadController({
        user,
        stripeOverrides: {
            listCheckoutSessionsForPayment: async (id) => {
                assert.equal(id, 'pi_lifetime');
                return { data: [session] };
            },
            retrieveCheckoutSession: async () => session,
            constructEvent: () => ({
                type: 'charge.refunded',
                data: { object: { customer: 'cus_test', payment_intent: 'pi_lifetime', amount_refunded: 19900 } },
            }),
        },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(user.stripeLifetimePaymentIntentId, 'pi_lifetime');
    assert.equal(user.subscriptionStatus, 'canceled');
});

test('subscription metadata cannot grant access for an unrelated price', async (t) => {
    const user = activeMonthlyUser();
    const subscription = {
        id: 'sub_other',
        customer: 'cus_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        metadata: { plan: 'yearly' },
        items: { data: [{ price: { id: 'price_other' } }] },
    };
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveCheckoutSession: async () => ({
                mode: 'subscription',
                customer: 'cus_test',
                subscription: subscription.id,
                metadata: { userId: String(user._id) },
            }),
            retrieveSubscription: async () => subscription,
            constructEvent: () => ({ type: 'customer.subscription.updated', data: { object: subscription } }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.controller.verifySession({ query: { session_id: 'cs_other' }, user: { email: user.email } }, res);
    assert.equal(res.statusCode, 400);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(user.subscriptionStatus, 'inactive');
    assert.equal(user.subscriptionType, null);
});

test('recurring verification rejects a subscription belonging to another customer', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: {
            retrieveCheckoutSession: async () => ({
                mode: 'subscription',
                customer: 'cus_test',
                subscription: 'sub_other',
                metadata: { userId: String(user._id) },
            }),
            retrieveSubscription: async () => ({
                id: 'sub_other',
                customer: 'cus_other',
                status: 'active',
                items: { data: [{ price: { id: 'price_yearly' } }] },
            }),
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.controller.verifySession({ query: { session_id: 'cs_other' }, user: { email: user.email } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(user.subscriptionType, 'monthly');
});

test('atomic activation rejects a reversal arriving after payment validation', async (t) => {
    const user = activeMonthlyUser();
    const harness = loadController({
        user,
        stripeOverrides: {
            cancelSubscription: async () => {
                user.revokedLifetimePaymentIntentIds = ['pi_lifetime'];
            },
        },
    });
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.controller.verifySession({ query: { session_id: 'cs_test' }, user: { email: user.email } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(user.subscriptionType, 'monthly');
    assert.equal(harness.calls.emails.length, 0);
});

test('a revoked purchase does not prevent buying a new valid Lifetime plan', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    user.subscriptionStatus = 'canceled';
    user.revokedLifetimePaymentIntentIds = ['pi_old'];
    const harness = loadController({ user });
    t.after(harness.cleanup);
    const res = createResponse();
    await harness.controller.verifySession({ query: { session_id: 'cs_test' }, user: { email: user.email } }, res);
    assert.equal(res.body.active, true);
    assert.equal(user.stripeLifetimePaymentIntentId, 'pi_lifetime');
    assert.deepEqual(user.revokedLifetimePaymentIntentIds, ['pi_old']);
});

test('a recorded legacy purchase is revoked after the configured Lifetime price changes', async (t) => {
    const user = activeMonthlyUser();
    user.subscriptionType = 'lifetime';
    user.subscriptionActivationEmailKey = 'checkout:cs_old_price';
    user.select = async (fields) => {
        assert.equal(fields, '+subscriptionActivationEmailKey');
        return user;
    };
    const session = {
        id: 'cs_old_price',
        mode: 'payment',
        payment_status: 'paid',
        customer: 'cus_test',
        ...lifetimePayment(user),
    };
    session.line_items.data[0].price.id = 'price_legacy';
    const harness = loadController({
        user,
        stripeOverrides: {
            listCheckoutSessionsForPayment: async () => ({ data: [session] }),
            retrieveCheckoutSession: async () => session,
            constructEvent: () => ({
                type: 'charge.refunded',
                data: { object: { customer: 'cus_test', payment_intent: 'pi_lifetime', amount_refunded: 19900 } },
            }),
        },
    });
    t.after(harness.cleanup);
    await harness.controller.handleWebhook({ headers: {}, body: Buffer.from('{}') }, createResponse());
    assert.equal(user.subscriptionStatus, 'canceled');
});
