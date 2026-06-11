'use strict';

const User = require('../models/users');
const stripeLib = require('../lib/stripe');
const logs = require('../common/logs');
const config = require('../config');
const { isSubscriptionActive } = require('../middleware/saas');

const log = new logs('Controllers-stripe');

const SERVER_URL = process.env.SERVER_URL;

/**
 * Create a Stripe Checkout session for the requested plan.
 * Body: { plan: 'monthly' | 'lifetime' }
 */
async function createCheckout(req, res) {
    try {
        if (!stripeLib.isEnabled()) {
            return res.status(400).json({ message: 'SaaS mode is not enabled' });
        }

        const { plan } = req.body;
        if (plan !== 'monthly' && plan !== 'lifetime') {
            return res.status(400).json({ message: 'Invalid plan' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const successUrl = `${SERVER_URL}/pricing?status=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${SERVER_URL}/pricing?status=cancel`;

        const session =
            plan === 'monthly'
                ? await stripeLib.createSubscriptionCheckout(user, successUrl, cancelUrl)
                : await stripeLib.createLifetimeCheckout(user, successUrl, cancelUrl);

        log.debug('Checkout session created', { plan, email: user.email });
        return res.status(200).json({ url: session.url });
    } catch (error) {
        log.error('createCheckout', error);
        return res.status(400).json({ message: error.message });
    }
}

/**
 * Create a Stripe Billing Portal session so the user can manage their subscription.
 */
async function createPortal(req, res) {
    try {
        if (!stripeLib.isEnabled()) {
            return res.status(400).json({ message: 'SaaS mode is not enabled' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user || !user.stripeCustomerId) {
            return res.status(404).json({ message: 'No billing account found' });
        }

        const returnUrl = `${SERVER_URL}/client`;
        const session = await stripeLib.createBillingPortal(user.stripeCustomerId, returnUrl);

        return res.status(200).json({ url: session.url });
    } catch (error) {
        log.error('createPortal', error);
        return res.status(400).json({ message: error.message });
    }
}

/**
 * Return the current billing/subscription status for the authenticated user.
 */
async function getBilling(req, res) {
    try {
        const user = await User.findOne({ email: req.user.email }).select(
            'subscriptionType subscriptionStatus subscriptionExpiresAt stripeCustomerId'
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            saas: config.SAAS.enabled,
            subscriptionType: user.subscriptionType || null,
            subscriptionStatus: user.subscriptionStatus || null,
            subscriptionExpiresAt: user.subscriptionExpiresAt || null,
            active: isSubscriptionActive(user),
            hasBillingAccount: !!user.stripeCustomerId,
        });
    } catch (error) {
        log.error('getBilling', error);
        return res.status(400).json({ message: error.message });
    }
}

/**
 * Verify a completed Checkout Session and activate the subscription immediately.
 * This is a fallback used on the success page so activation does not depend on
 * the webhook arriving first (important for local dev or webhook delays).
 * Idempotent: webhook and verify can both run safely.
 * Query: ?session_id=cs_xxx
 */
async function verifySession(req, res) {
    try {
        if (!stripeLib.isEnabled()) {
            return res.status(400).json({ message: 'SaaS mode is not enabled' });
        }

        const sessionId = req.query.session_id;
        if (!sessionId) {
            return res.status(400).json({ message: 'Missing session_id' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const session = await stripeLib.retrieveCheckoutSession(sessionId);

        // Ensure the session actually belongs to the authenticated user.
        const sessionUserId = session.metadata && session.metadata.userId;
        const belongsToUser =
            (sessionUserId && sessionUserId === String(user._id)) ||
            (user.stripeCustomerId && session.customer === user.stripeCustomerId);
        if (!belongsToUser) {
            log.warn('verifySession: session does not belong to user', { email: user.email });
            return res.status(403).json({ message: 'Session does not belong to this user' });
        }

        // Persist the customer id if it was not stored yet.
        if (session.customer && !user.stripeCustomerId) {
            user.stripeCustomerId = session.customer;
        }

        if (session.mode === 'payment' && session.payment_status === 'paid') {
            user.subscriptionType = 'lifetime';
            user.subscriptionStatus = 'active';
            user.subscriptionExpiresAt = null;
            user.updatedAt = new Date().toISOString();
            await user.save();
            log.debug('Lifetime activated via verifySession', { email: user.email });
        } else if (session.mode === 'subscription' && session.subscription) {
            const subscription = await stripeLib.retrieveSubscription(session.subscription);
            user.subscriptionType = 'monthly';
            user.subscriptionStatus = mapSubscriptionStatus(subscription.status);
            user.stripeSubscriptionId = subscription.id;
            user.subscriptionExpiresAt = periodEndToDate(subscription);
            user.updatedAt = new Date().toISOString();
            await user.save();
            log.debug('Monthly subscription activated via verifySession', { email: user.email });
        } else {
            // Payment not completed yet.
            await user.save();
            return res.status(200).json({ active: isSubscriptionActive(user), pending: true });
        }

        return res.status(200).json({ active: isSubscriptionActive(user) });
    } catch (error) {
        log.error('verifySession', error);
        return res.status(400).json({ message: error.message });
    }
}

/**
 * Stripe webhook handler. Requires the raw request body (configured in server.js).
 */
async function handleWebhook(req, res) {
    if (!stripeLib.isEnabled()) {
        return res.status(400).json({ message: 'SaaS mode is not enabled' });
    }

    let event;
    try {
        const signature = req.headers['stripe-signature'];
        event = stripeLib.constructEvent(req.body, signature);
    } catch (error) {
        log.error('Webhook signature verification failed', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                // Lifetime payments only (subscriptions are handled by their own events).
                if (session.mode === 'payment') {
                    await updateUserByCustomer(session.customer, {
                        subscriptionType: 'lifetime',
                        subscriptionStatus: 'active',
                        subscriptionExpiresAt: null,
                    });
                    log.debug('Lifetime purchase activated', { customer: session.customer });
                }
                break;
            }
            case 'customer.subscription.created': {
                const subscription = event.data.object;
                await updateUserByCustomer(subscription.customer, {
                    subscriptionType: 'monthly',
                    subscriptionStatus: mapSubscriptionStatus(subscription.status),
                    stripeSubscriptionId: subscription.id,
                    subscriptionExpiresAt: periodEndToDate(subscription),
                });
                log.debug('Monthly subscription created', { customer: subscription.customer });
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                await updateUserByCustomer(subscription.customer, {
                    subscriptionStatus: mapSubscriptionStatus(subscription.status),
                    subscriptionExpiresAt: periodEndToDate(subscription),
                });
                log.debug('Subscription updated', { customer: subscription.customer, status: subscription.status });
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await updateUserByCustomer(subscription.customer, {
                    subscriptionStatus: 'canceled',
                });
                log.debug('Subscription canceled', { customer: subscription.customer });
                break;
            }
            default:
                log.debug('Unhandled Stripe event', event.type);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        log.error('handleWebhook', error);
        return res.status(500).json({ message: 'Webhook handler error' });
    }
}

/**
 * Map a Stripe subscription status to the values stored on the user document.
 */
function mapSubscriptionStatus(status) {
    if (status === 'active' || status === 'trialing') return 'active';
    if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'canceled';
    return 'inactive';
}

/**
 * Convert a Stripe subscription current_period_end (seconds) into a Date.
 * Newer Stripe API versions expose current_period_end on the subscription
 * items rather than on the subscription object, so both shapes are handled.
 */
function periodEndToDate(subscription) {
    let periodEnd = subscription.current_period_end;
    if (!periodEnd && subscription.items && Array.isArray(subscription.items.data)) {
        periodEnd = subscription.items.data[0]?.current_period_end;
    }
    if (!periodEnd) return null;
    return new Date(periodEnd * 1000);
}

/**
 * Update the user document matching the given Stripe customer id.
 */
async function updateUserByCustomer(customerId, update) {
    if (!customerId) return;
    update.updatedAt = new Date().toISOString();
    await User.updateOne({ stripeCustomerId: customerId }, { $set: update });
}

module.exports = {
    createCheckout,
    createPortal,
    getBilling,
    verifySession,
    handleWebhook,
};
