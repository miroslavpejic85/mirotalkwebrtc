'use strict';

const User = require('../models/users');
const stripeLib = require('../lib/stripe');
const logs = require('../common/logs');
const config = require('../config');
const { isSubscriptionActive } = require('../middleware/saas');
const nodemailer = require('../lib/nodemailer');

const log = new logs('Controllers-stripe');

const SERVER_URL = process.env.SERVER_URL;

/**
 * Create a Stripe Checkout session for the requested plan.
 * Body: { plan: 'monthly' | 'yearly' | 'lifetime' }
 */
async function createCheckout(req, res) {
    try {
        if (!stripeLib.isEnabled()) {
            return res.status(400).json({ message: 'SaaS mode is not enabled' });
        }

        const { plan } = req.body;
        if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (isSubscriptionActive(user)) {
            if (user.subscriptionType === 'lifetime' || plan !== 'lifetime') {
                return res.status(409).json({
                    code: 'PLAN_ALREADY_ACTIVE',
                    message:
                        user.subscriptionType === 'lifetime'
                            ? 'Lifetime access is already active on this account.'
                            : 'A recurring subscription is already active. Manage it from your billing settings.',
                });
            }
        }

        const successUrl = `${SERVER_URL}/pricing?status=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${SERVER_URL}/pricing?status=cancel&plan=${plan}`;

        let session;
        if (plan === 'monthly') {
            session = await stripeLib.createSubscriptionCheckout(user, successUrl, cancelUrl);
        } else if (plan === 'yearly') {
            session = await stripeLib.createYearlySubscriptionCheckout(user, successUrl, cancelUrl);
        } else {
            session = await stripeLib.createLifetimeCheckout(user, successUrl, cancelUrl);
        }

        log.debug('Checkout session created', { plan, email: user.email });
        return res.status(200).json({ url: session.url });
    } catch (error) {
        log.error('createCheckout', error);
        return res.status(400).json({ message: error.message });
    }
}

/**
 * Upgrade an active monthly subscription to yearly billing.
 * Downgrades and changes away from Lifetime are intentionally not supported.
 */
async function changePlan(req, res) {
    try {
        if (!stripeLib.isEnabled()) {
            return res.status(400).json({ message: 'SaaS mode is not enabled' });
        }

        const { plan } = req.body;
        if (!['monthly', 'yearly'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan change' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (
            plan !== 'yearly' ||
            user.subscriptionType !== 'monthly' ||
            !isSubscriptionActive(user) ||
            !user.stripeSubscriptionId
        ) {
            return res.status(409).json({
                code: 'PLAN_CHANGE_NOT_ALLOWED',
                message: 'Only an active monthly subscription can be upgraded to annual billing.',
            });
        }

        const subscription = await stripeLib.upgradeSubscriptionToYearly(user.stripeSubscriptionId);
        user.subscriptionType = getRecurringPlan(subscription);
        user.subscriptionStatus = mapSubscriptionStatus(subscription.status);
        user.subscriptionExpiresAt = subscriptionEndToDate(subscription);
        user.subscriptionCancelAtPeriodEnd = isSubscriptionEnding(subscription);
        user.updatedAt = new Date().toISOString();
        await user.save();

        if (isSubscriptionActive(user)) {
            await sendPlanActivationEmailOnce(
                { _id: user._id },
                `subscription:${subscription.id}:plan:${user.subscriptionType}`,
                user.subscriptionType,
                user.subscriptionExpiresAt
            );
        }

        log.debug('Subscription upgraded', { email: user.email, plan: user.subscriptionType });
        return res.status(200).json({
            subscriptionType: user.subscriptionType,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            active: isSubscriptionActive(user),
        });
    } catch (error) {
        log.error('changePlan', error);
        return res.status(400).json({ message: error.message });
    }
}

async function getPlans(req, res) {
    try {
        if (!stripeLib.isEnabled()) {
            return res.status(400).json({ message: 'SaaS mode is not enabled' });
        }

        const [monthly, yearly, lifetime] = await Promise.all([
            stripeLib.retrievePrice(config.SAAS.monthlyPriceId),
            stripeLib.retrievePrice(config.SAAS.yearlyPriceId),
            stripeLib.retrievePrice(config.SAAS.lifetimePriceId),
        ]);

        return res.status(200).json({
            monthly: {
                unitAmount: monthly.unit_amount,
                currency: monthly.currency,
                interval: monthly.recurring?.interval || 'month',
            },
            yearly: {
                unitAmount: yearly.unit_amount,
                currency: yearly.currency,
                interval: yearly.recurring?.interval || 'year',
            },
            lifetime: {
                unitAmount: lifetime.unit_amount,
                currency: lifetime.currency,
            },
        });
    } catch (error) {
        log.error('getPlans', error);
        return res.status(400).json({ message: 'Unable to load plan prices' });
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
            'subscriptionType subscriptionStatus subscriptionExpiresAt subscriptionCancelAtPeriodEnd stripeCustomerId stripeSubscriptionId'
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await reconcileMonthlySubscription(user);

        return res.status(200).json({
            saas: config.SAAS.enabled,
            subscriptionType: user.subscriptionType || null,
            subscriptionStatus: user.subscriptionStatus || null,
            subscriptionExpiresAt: user.subscriptionExpiresAt || null,
            subscriptionCancelAtPeriodEnd: !!user.subscriptionCancelAtPeriodEnd,
            active: isSubscriptionActive(user),
            hasBillingAccount: !!user.stripeCustomerId,
            hasRecurringSubscription: !!user.stripeSubscriptionId,
        });
    } catch (error) {
        log.error('getBilling', error);
        return res.status(400).json({ message: error.message });
    }
}

async function reconcileMonthlySubscription(user) {
    if (!stripeLib.isEnabled() || !isRecurringPlan(user.subscriptionType) || !user.stripeSubscriptionId) return;

    try {
        const subscription = await stripeLib.retrieveSubscription(user.stripeSubscriptionId);
        user.subscriptionType = getRecurringPlan(subscription);
        user.subscriptionStatus = user.subscriptionType ? mapSubscriptionStatus(subscription.status) : 'inactive';
        user.subscriptionExpiresAt = subscriptionEndToDate(subscription);
        user.subscriptionCancelAtPeriodEnd = isSubscriptionEnding(subscription);
        user.updatedAt = new Date().toISOString();
        await user.save();
    } catch (error) {
        if (error?.code === 'resource_missing') {
            user.subscriptionStatus = 'canceled';
            user.stripeSubscriptionId = undefined;
            user.subscriptionCancelAtPeriodEnd = false;
            user.updatedAt = new Date().toISOString();
            await user.save();
            return;
        }

        log.warn('Unable to reconcile subscription; using cached billing state', { email: user.email });
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
            sessionUserId === String(user._id) &&
            !!session.customer &&
            (!user.stripeCustomerId || session.customer === user.stripeCustomerId);
        if (!belongsToUser) {
            log.warn('verifySession: session does not belong to user', { email: user.email });
            return res.status(403).json({ message: 'Session does not belong to this user' });
        }

        if (session.mode === 'payment' && session.payment_status === 'paid') {
            if (!(await activateLifetime(user, session))) {
                return res.status(400).json({ message: 'Invalid or revoked Lifetime payment' });
            }
            log.debug('Lifetime activated via verifySession', { email: user.email });
        } else if (session.mode === 'subscription' && session.subscription) {
            if (user.subscriptionType === 'lifetime' && user.subscriptionStatus === 'active') {
                return res.status(200).json({ active: true });
            }
            const subscription = await stripeLib.retrieveSubscription(session.subscription);
            const plan = getRecurringPlan(subscription);
            if (
                !plan ||
                subscription.id !== resourceId(session.subscription) ||
                resourceId(subscription.customer) !== session.customer
            ) {
                return res.status(400).json({ message: 'Invalid subscription purchase' });
            }
            user.subscriptionType = plan;
            user.subscriptionStatus = mapSubscriptionStatus(subscription.status);
            user.stripeSubscriptionId = subscription.id;
            user.subscriptionExpiresAt = subscriptionEndToDate(subscription);
            user.subscriptionCancelAtPeriodEnd = isSubscriptionEnding(subscription);
            user.updatedAt = new Date().toISOString();
            await user.save();
            if (isSubscriptionActive(user)) {
                await sendPlanActivationEmailOnce(
                    { _id: user._id },
                    `subscription:${subscription.id}`,
                    user.subscriptionType,
                    user.subscriptionExpiresAt
                );
            }
            log.debug('Recurring subscription activated via verifySession', {
                email: user.email,
                plan: user.subscriptionType,
            });
        } else {
            // Payment not completed yet.
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
                if (
                    session.mode === 'payment' &&
                    session.payment_status === 'paid' &&
                    session.metadata?.plan === 'lifetime'
                ) {
                    const currentSession = await stripeLib.retrieveCheckoutSession(session.id);
                    const user = await User.findOne({ stripeCustomerId: currentSession.customer });
                    if (user && (await activateLifetime(user, currentSession))) {
                        log.debug('Lifetime purchase activated', { customer: session.customer });
                    }
                }
                break;
            }
            case 'charge.refunded': {
                if (event.data.object.amount_refunded > 0) await revokeLifetimePayment(event.data.object);
                break;
            }
            case 'charge.dispute.created':
            case 'charge.dispute.closed': {
                const dispute = event.data.object;
                if (event.type === 'charge.dispute.created' || dispute.status === 'lost') {
                    const charge = await stripeLib.retrieveCharge(resourceId(dispute.charge));
                    await revokeLifetimePayment(charge);
                }
                break;
            }
            case 'customer.subscription.created': {
                const subscription = event.data.object;
                const subscriptionType = getRecurringPlan(subscription);
                const subscriptionStatus = subscriptionType ? mapSubscriptionStatus(subscription.status) : 'inactive';
                const subscriptionExpiresAt = subscriptionEndToDate(subscription);
                await updateUserByCustomer(subscription.customer, {
                    subscriptionType,
                    subscriptionStatus,
                    stripeSubscriptionId: subscription.id,
                    subscriptionExpiresAt,
                    subscriptionCancelAtPeriodEnd: isSubscriptionEnding(subscription),
                });
                if (subscriptionStatus === 'active') {
                    await sendPlanActivationEmailOnce(
                        {
                            stripeCustomerId: subscription.customer,
                            stripeSubscriptionId: subscription.id,
                            subscriptionType,
                        },
                        `subscription:${subscription.id}`,
                        subscriptionType,
                        subscriptionExpiresAt
                    );
                }
                log.debug('Recurring subscription created', { customer: subscription.customer });
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const subscriptionType = getRecurringPlan(subscription);
                await updateUserByCustomer(subscription.customer, {
                    subscriptionType,
                    subscriptionStatus: subscriptionType ? mapSubscriptionStatus(subscription.status) : 'inactive',
                    subscriptionExpiresAt: subscriptionEndToDate(subscription),
                    subscriptionCancelAtPeriodEnd: isSubscriptionEnding(subscription),
                });
                log.debug('Subscription updated', { customer: subscription.customer, status: subscription.status });
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await updateUserByCustomer(subscription.customer, {
                    subscriptionStatus: 'canceled',
                    subscriptionCancelAtPeriodEnd: false,
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

function isRecurringPlan(plan) {
    return plan === 'monthly' || plan === 'yearly';
}

function getRecurringPlan(subscription) {
    const items = subscription.items?.data;
    if (!items || items.length !== 1 || subscription.items.has_more) return null;
    const priceId = items[0].price?.id;
    if (priceId && priceId === config.SAAS.yearlyPriceId) return 'yearly';
    if (priceId && priceId === config.SAAS.monthlyPriceId) return 'monthly';
    return null;
}

/**
 * Return whether Stripe has scheduled this subscription to end.
 */
function isSubscriptionEnding(subscription) {
    return !!subscription.cancel_at_period_end || !!subscription.cancel_at;
}

/**
 * Convert a Stripe subscription access end (seconds) into a Date.
 * Newer Stripe API versions expose current_period_end on the subscription
 * items and may represent portal cancellations with cancel_at.
 */
function subscriptionEndToDate(subscription) {
    let periodEnd = subscription.cancel_at || subscription.current_period_end;
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
    await User.updateOne({ stripeCustomerId: customerId, subscriptionType: { $ne: 'lifetime' } }, { $set: update });
}

async function sendPlanActivationEmailOnce(identity, activationKey, plan, expiresAt) {
    const user = await User.findOneAndUpdate(
        { ...identity, subscriptionActivationEmailKey: { $ne: activationKey } },
        { $set: { subscriptionActivationEmailKey: activationKey } },
        { returnDocument: 'after' }
    );
    if (!user) return;

    try {
        await nodemailer.sendPlanActivatedEmail(user.username, user.email, plan, expiresAt);
    } catch (error) {
        try {
            await User.updateOne(
                { _id: user._id, subscriptionActivationEmailKey: activationKey },
                { $unset: { subscriptionActivationEmailKey: '' } }
            );
        } catch (cleanupError) {
            log.error('Unable to release plan activation email marker', {
                email: user.email,
                error: cleanupError.message,
            });
        }
        log.error('Unable to send plan activation email', { email: user.email, error: error.message });
    }
}

function resourceId(resource) {
    return typeof resource === 'string' ? resource : resource?.id;
}

function isLifetimeProduct(session, user) {
    const items = session.line_items;
    return (
        session.mode === 'payment' &&
        session.metadata?.plan === 'lifetime' &&
        session.metadata?.userId === String(user._id) &&
        !!session.customer &&
        (!user.stripeCustomerId || session.customer === user.stripeCustomerId) &&
        !!config.SAAS.lifetimePriceId &&
        items?.has_more === false &&
        items.data?.length === 1 &&
        items.data[0].price?.id === config.SAAS.lifetimePriceId &&
        items.data[0].quantity === 1
    );
}

async function activateLifetime(user, session) {
    const payment = session.payment_intent;
    const charge = payment?.latest_charge;
    if (
        !isLifetimeProduct(session, user) ||
        session.status !== 'complete' ||
        session.payment_status !== 'paid' ||
        !payment?.id ||
        payment.status !== 'succeeded' ||
        resourceId(payment.customer) !== session.customer ||
        !charge?.id ||
        charge.paid !== true ||
        charge.captured !== true ||
        charge.refunded ||
        charge.amount_refunded > 0 ||
        charge.disputed ||
        resourceId(charge.payment_intent) !== payment.id ||
        resourceId(charge.customer) !== session.customer ||
        !(session.amount_total > 0) ||
        payment.amount_received !== session.amount_total ||
        payment.currency !== session.currency ||
        charge.currency !== session.currency ||
        user.revokedLifetimePaymentIntentIds?.includes(payment.id)
    )
        return false;

    if (isRecurringPlan(user.subscriptionType) && user.stripeSubscriptionId) {
        await stripeLib.cancelSubscription(user.stripeSubscriptionId);
    }

    const activated = await User.findOneAndUpdate(
        { _id: user._id, revokedLifetimePaymentIntentIds: { $ne: payment.id } },
        {
            $set: {
                subscriptionType: 'lifetime',
                subscriptionStatus: 'active',
                stripeCustomerId: session.customer,
                stripeLifetimePaymentIntentId: payment.id,
                stripeLifetimeCheckoutSessionId: session.id,
                subscriptionExpiresAt: null,
                subscriptionCancelAtPeriodEnd: false,
                updatedAt: new Date().toISOString(),
            },
            $unset: { stripeSubscriptionId: '' },
        },
        { returnDocument: 'after' }
    );
    if (!activated) return false;
    Object.assign(user, {
        subscriptionType: 'lifetime',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: null,
        stripeSubscriptionId: undefined,
        subscriptionCancelAtPeriodEnd: false,
    });
    await sendPlanActivationEmailOnce(
        { _id: user._id },
        `checkout:${session.id}`,
        user.subscriptionType,
        user.subscriptionExpiresAt
    );
    return true;
}

async function revokeLifetimePayment(charge) {
    const customerId = resourceId(charge.customer);
    const paymentId = resourceId(charge.payment_intent);
    if (!customerId || !paymentId) return;

    await User.updateOne(
        { stripeCustomerId: customerId },
        { $addToSet: { revokedLifetimePaymentIntentIds: paymentId } }
    );
    const user = await User.findOne({ stripeCustomerId: customerId }).select('+subscriptionActivationEmailKey');
    if (!user || user.subscriptionType !== 'lifetime') return;

    if (!user.stripeLifetimePaymentIntentId) {
        const sessions = await stripeLib.listCheckoutSessionsForPayment(paymentId);
        let matchingSession;
        for (const session of sessions.data) {
            if (session.metadata?.userId !== String(user._id) || session.metadata?.plan !== 'lifetime') continue;
            const currentSession = await stripeLib.retrieveCheckoutSession(session.id);
            const recordedPurchase =
                user.subscriptionActivationEmailKey === `checkout:${currentSession.id}` &&
                currentSession.metadata?.userId === String(user._id) &&
                currentSession.metadata?.plan === 'lifetime' &&
                currentSession.customer === customerId;
            if (
                (recordedPurchase || isLifetimeProduct(currentSession, user)) &&
                resourceId(currentSession.payment_intent) === paymentId
            ) {
                matchingSession = currentSession;
                break;
            }
        }
        if (!matchingSession) return;
        await User.updateOne(
            { _id: user._id, stripeLifetimePaymentIntentId: { $exists: false }, subscriptionType: 'lifetime' },
            { $set: { stripeLifetimePaymentIntentId: paymentId, stripeLifetimeCheckoutSessionId: matchingSession.id } }
        );
    }

    await User.updateOne(
        { stripeCustomerId: customerId, subscriptionType: 'lifetime', stripeLifetimePaymentIntentId: paymentId },
        { $set: { subscriptionStatus: 'canceled', updatedAt: new Date().toISOString() } }
    );
}

module.exports = {
    getPlans,
    createCheckout,
    changePlan,
    createPortal,
    getBilling,
    verifySession,
    handleWebhook,
};
