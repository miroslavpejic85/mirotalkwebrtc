'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../frontend/js/pricing.js'), 'utf8');

function loadPricing({ billing, token = 'session-token', confirmed = true, error } = {}) {
    const messages = [];
    const calls = [];
    const context = {
        window: {
            matchMedia: () => ({ matches: false }),
            location: { href: '/pricing' },
            sessionStorage: { userToken: token },
        },
        document: { addEventListener() {} },
        Swal: { fire: async () => ({ isConfirmed: confirmed }) },
        stripeChangePlan: async (plan) => {
            calls.push(plan);
            if (error) throw error;
            return billing;
        },
        popupMessage: (...message) => messages.push(message),
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.renderPricingBilling = () => {};
    context.loadPricingBilling = () => {};
    return { context, messages, calls };
}

test('active annual upgrade redirects to the dashboard with the existing token', async () => {
    const { context, calls } = loadPricing({
        billing: { active: true, subscriptionType: 'yearly' },
        token: 'token/value',
    });
    await context.upgradeToYearly({ disabled: false, textContent: 'Upgrade to Annual' });
    assert.equal(context.window.location.href, '/client/?token=token%2Fvalue');
    assert.deepEqual(calls, ['yearly']);
});

test('active annual upgrade supports cookie authentication without a stored token', async () => {
    const { context } = loadPricing({ billing: { active: true, subscriptionType: 'yearly' }, token: '' });
    await context.upgradeToYearly({ disabled: false, textContent: 'Upgrade to Annual' });
    assert.equal(context.window.location.href, '/client');
});

for (const billing of [
    { active: false, subscriptionType: 'yearly' },
    { active: true, subscriptionType: 'monthly' },
]) {
    test(`unconfirmed annual upgrade stays on pricing (${billing.subscriptionType}, active=${billing.active})`, async () => {
        const { context, messages } = loadPricing({ billing });
        await context.upgradeToYearly({ disabled: false, textContent: 'Upgrade to Annual' });
        assert.equal(context.window.location.href, '/pricing');
        assert.equal(messages[0][0], 'info');
    });
}

test('failed annual upgrade stays on pricing and restores the upgrade button', async () => {
    const { context, messages } = loadPricing({ error: new Error('Stripe unavailable') });
    const button = { disabled: false, textContent: 'Upgrade to Annual' };
    await context.upgradeToYearly(button);
    assert.equal(context.window.location.href, '/pricing');
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Upgrade to Annual');
    assert.equal(messages[0][0], 'error');
});

test('canceling annual upgrade does not change the plan or redirect', async () => {
    const { context, calls } = loadPricing({ confirmed: false });
    await context.upgradeToYearly({ disabled: false, textContent: 'Upgrade to Annual' });
    assert.equal(context.window.location.href, '/pricing');
    assert.deepEqual(calls, []);
});
