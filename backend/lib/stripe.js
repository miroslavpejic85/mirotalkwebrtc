'use strict';

const logs = require('../common/logs');
const config = require('../config');

const log = new logs('Stripe');

const SAAS_ENABLED = config.SAAS.enabled;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID;
const STRIPE_LIFETIME_PRICE_ID = process.env.STRIPE_LIFETIME_PRICE_ID;

let stripe = null;

if (SAAS_ENABLED) {
    if (!STRIPE_SECRET_KEY) {
        log.error('SAAS mode enabled but STRIPE_SECRET_KEY is missing');
    } else {
        stripe = require('stripe')(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' });
        log.info('Stripe initialized', {
            monthlyPrice: !!STRIPE_MONTHLY_PRICE_ID,
            lifetimePrice: !!STRIPE_LIFETIME_PRICE_ID,
            webhookSecret: !!STRIPE_WEBHOOK_SECRET,
        });
    }
}

function isEnabled() {
    return SAAS_ENABLED && !!stripe;
}

/**
 * Return an existing Stripe customer id for the user, or create a new one.
 * Persists the customer id back to the user document.
 */
async function getOrCreateCustomer(user) {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: { userId: String(user._id) },
    });

    user.stripeCustomerId = customer.id;
    await user.save();
    return customer.id;
}

/**
 * Create a Stripe Checkout session for the monthly subscription plan.
 */
async function createSubscriptionCheckout(user, successUrl, cancelUrl) {
    const customerId = await getOrCreateCustomer(user);
    return stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: STRIPE_MONTHLY_PRICE_ID, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId: String(user._id), plan: 'monthly' },
    });
}

/**
 * Create a Stripe Checkout session for the one-time lifetime payment.
 */
async function createLifetimeCheckout(user, successUrl, cancelUrl) {
    const customerId = await getOrCreateCustomer(user);
    return stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [{ price: STRIPE_LIFETIME_PRICE_ID, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId: String(user._id), plan: 'lifetime' },
    });
}

/**
 * Create a Stripe Billing Portal session so the user can manage their subscription.
 */
async function createBillingPortal(customerId, returnUrl) {
    return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}

/**
 * Verify and construct a Stripe webhook event from the raw request body.
 */
function constructEvent(rawBody, signature) {
    return stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Retrieve a subscription by id (used to read current_period_end).
 */
async function retrieveSubscription(subscriptionId) {
    return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Retrieve a Checkout Session by id (used to verify payment on the success page).
 */
async function retrieveCheckoutSession(sessionId) {
    return stripe.checkout.sessions.retrieve(sessionId);
}

module.exports = {
    isEnabled,
    getOrCreateCustomer,
    createSubscriptionCheckout,
    createLifetimeCheckout,
    createBillingPortal,
    constructEvent,
    retrieveSubscription,
    retrieveCheckoutSession,
};
