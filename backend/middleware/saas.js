'use strict';

const utils = require('../common/utils');
const logs = require('../common/logs');
const config = require('../config');
const User = require('../models/users');

const log = new logs('SaaS');

const SAAS_ENABLED = config.SAAS.enabled;

const USER_DEMO = {
    enabled: process.env.USER_DEMO_MODE == 'true',
    username: process.env.USER_DEMO_USERNAME,
    email: process.env.USER_DEMO_EMAIL,
};

/**
 * Determine whether a user is a demo account (exempt from subscription checks).
 */
function isDemoUser(user) {
    return USER_DEMO.enabled && user && user.email === USER_DEMO.email && user.username === USER_DEMO.username;
}

/**
 * Determine whether a user has an active subscription.
 * - Lifetime: type=lifetime && status=active (no expiry).
 * - Monthly: status=active && subscriptionExpiresAt in the future.
 */
function isSubscriptionActive(user) {
    if (!user) return false;

    if (user.subscriptionType === 'lifetime' && user.subscriptionStatus === 'active') {
        return true;
    }

    if (user.subscriptionType === 'monthly' && user.subscriptionStatus === 'active') {
        return !!user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() > Date.now();
    }

    return false;
}

/**
 * Global subscription guard.
 * - When SAAS is disabled, always allow (self-hosted behavior unchanged).
 * - When SAAS is enabled, demo and admin accounts are exempt; everyone else
 *   needs an active subscription. On failure, HTML requests are redirected to
 *   /pricing and API requests receive a 403.
 *
 * Must run AFTER the `auth` middleware so that `req.user` is populated.
 */
const requireSubscription = async (req, res, next) => {
    if (!SAAS_ENABLED) return next();

    try {
        const reqUser = req.user || {};
        const { email, username, password } = reqUser;

        // Demo accounts are always allowed.
        if (isDemoUser(reqUser)) return next();

        // Admin accounts are always allowed.
        if (await utils.isAdmin(email, username, password)) return next();

        const dbUser = await User.findOne({ email }).select(
            'subscriptionType subscriptionStatus subscriptionExpiresAt'
        );

        if (isSubscriptionActive(dbUser)) return next();

        log.debug('Subscription required', { email });

        if (req.accepts('html')) {
            return res.redirect('/pricing');
        }
        return res.status(403).json({ message: 'An active subscription is required to access this resource.' });
    } catch (error) {
        log.error('requireSubscription', error);
        return res.status(500).json({ message: 'Subscription verification error' });
    }
};

module.exports = {
    requireSubscription,
    isSubscriptionActive,
    isDemoUser,
};
