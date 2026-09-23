'use strict';

function initCursorLight() {
    const supportsPointerLight = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!supportsPointerLight || prefersReducedMotion) return;

    const light = document.createElement('div');
    light.className = 'cursor-light pricing-cursor-light';
    light.setAttribute('aria-hidden', 'true');
    document.body.prepend(light);

    document.addEventListener(
        'pointermove',
        (event) => {
            light.style.setProperty('--cursor-light-x', `${event.clientX}px`);
            light.style.setProperty('--cursor-light-y', `${event.clientY}px`);
            light.classList.add('is-visible');
        },
        { passive: true }
    );
    document.documentElement.addEventListener('mouseleave', () => light.classList.remove('is-visible'));
}

initCursorLight();

let currentBilling = null;
let activationSessionId = null;
let requestedPlan = null;

function loadPricingAppConfig(config) {
    if (config?.app?.Name) {
        document.querySelectorAll('[data-app-name]').forEach((element) => {
            element.textContent = config.app.Name;
        });
    }

    const promoText = config?.saas?.promo?.text?.trim();
    const promo = document.getElementById('pricingPromo');
    const showPromo = config?.saas?.promo?.active === true && Boolean(promoText);
    document.getElementById('pricingPromoText').textContent = showPromo ? promoText : '';
    promo.classList.toggle('hidden', !showPromo);
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const sessionId = params.get('session_id');
    requestedPlan = ['monthly', 'yearly', 'lifetime'].includes(params.get('plan')) ? params.get('plan') : null;

    const cachedConfig = sessionStorage.getItem('appConfig');
    getAppConfig()
        .then((config) => {
            sessionStorage.setItem('appConfig', JSON.stringify(config));
            loadPricingAppConfig(config);
        })
        .catch(() => {
            if (cachedConfig) loadPricingAppConfig(JSON.parse(cachedConfig));
        });

    if (status === 'success') {
        // The Stripe webhook activates the subscription asynchronously, so verify
        // the checkout session server-side (fallback) and poll the billing status
        // before sending the user to the dashboard. This avoids bouncing back to
        // /pricing if the webhook hasn't landed yet.
        waitForActivationThenRedirect(sessionId);
    } else if (status === 'cancel') {
        showPricingNotice('No payment was made', 'Your checkout was canceled. Your plan is still available below.');
        window.history.replaceState({}, document.title, requestedPlan ? `/pricing?plan=${requestedPlan}` : '/pricing');
    }

    if (requestedPlan) {
        if (status !== 'cancel') {
            showPricingNotice(
                'Welcome back',
                `Review the ${formatPlanName(requestedPlan)} plan and continue when ready.`
            );
        }
        highlightPlan(requestedPlan);
    }

    getStripePlans()
        .then((plans) => {
            document.getElementById('monthlyPrice').textContent = formatStripePrice(plans.monthly);
            document.getElementById('yearlyPrice').textContent = formatStripePrice(plans.yearly);
            document.getElementById('lifetimePrice').textContent = formatStripePrice(plans.lifetime);
        })
        .catch(() => {
            document.getElementById('monthlyPrice').textContent = 'Unavailable';
            document.getElementById('yearlyPrice').textContent = 'Unavailable';
            document.getElementById('lifetimePrice').textContent = 'Unavailable';
            document.getElementById('subscribeMonthly').disabled = true;
            document.getElementById('subscribeYearly').disabled = true;
            document.getElementById('buyLifetime').disabled = true;
            document.getElementById('monthlyNote').textContent = 'Price is temporarily unavailable';
            document.getElementById('yearlyNote').textContent = 'Price is temporarily unavailable';
            document.getElementById('lifetimeNote').textContent = 'Price is temporarily unavailable';
        });

    loadPricingBilling();

    const subscribeMonthly = document.getElementById('subscribeMonthly');
    const subscribeYearly = document.getElementById('subscribeYearly');
    const buyLifetime = document.getElementById('buyLifetime');

    subscribeMonthly.addEventListener('click', () => startCheckout('monthly', subscribeMonthly));
    subscribeYearly.addEventListener('click', () => startCheckout('yearly', subscribeYearly));
    buyLifetime.addEventListener('click', () => startCheckout('lifetime', buyLifetime));
    document.getElementById('pricingManageBilling').addEventListener('click', openBillingPortal);
    document.getElementById('retryActivation').addEventListener('click', () => {
        waitForActivationThenRedirect(activationSessionId);
    });
});

function formatStripePrice(price) {
    const currency = price.currency.toUpperCase();
    const locale = currency === 'USD' ? 'en-US' : undefined;
    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(price.unitAmount / 10 ** fractionDigits);
}

function loadPricingBilling() {
    getBilling()
        .then((billing) => {
            currentBilling = billing;
            renderPricingBilling(billing);
        })
        .catch(() => {
            currentBilling = null;
        });
}

function renderPricingBilling(billing) {
    if (!billing) return;

    const status = document.getElementById('pricingAccountStatus');
    const plan = document.getElementById('pricingAccountPlan');
    const detail = document.getElementById('pricingAccountDetail');
    const manage = document.getElementById('pricingManageBilling');
    const monthlyButton = document.getElementById('subscribeMonthly');
    const yearlyButton = document.getElementById('subscribeYearly');
    const lifetimeButton = document.getElementById('buyLifetime');

    status.classList.remove('hidden');
    manage.classList.toggle('hidden', !billing.hasBillingAccount || !billing.subscriptionType);

    if (!billing.subscriptionType) {
        const selectedPlan = requestedPlan;
        plan.textContent = selectedPlan ? `${formatPlanName(selectedPlan)} checkout not completed` : 'No active plan';
        detail.textContent = selectedPlan
            ? 'Continue below. Stripe will show the final price before you confirm.'
            : 'Choose a plan below to open your dashboard.';
        if (selectedPlan) highlightPlan(selectedPlan);
        return;
    }

    if (billing.subscriptionType === 'lifetime' && billing.active) {
        plan.textContent = 'Lifetime access is active';
        detail.textContent = 'There are no recurring access charges.';
        monthlyButton.textContent = 'Included in lifetime';
        monthlyButton.disabled = true;
        yearlyButton.textContent = 'Included in lifetime';
        yearlyButton.disabled = true;
        lifetimeButton.textContent = 'Current plan';
        lifetimeButton.disabled = true;
        return;
    }

    if (['monthly', 'yearly'].includes(billing.subscriptionType) && billing.active) {
        const isYearly = billing.subscriptionType === 'yearly';
        const planName = isYearly ? 'Annual' : 'Monthly';
        const endDate = billing.subscriptionExpiresAt
            ? new Date(billing.subscriptionExpiresAt).toLocaleDateString()
            : '';
        plan.textContent = billing.subscriptionCancelAtPeriodEnd
            ? `${planName} access is ending`
            : `${planName} plan is active`;
        detail.textContent = billing.subscriptionCancelAtPeriodEnd
            ? `Access continues until ${endDate}.`
            : `Next renewal: ${endDate}.`;
        const currentButton = isYearly ? yearlyButton : monthlyButton;
        const alternateButton = isYearly ? monthlyButton : yearlyButton;
        currentButton.textContent = 'Current plan';
        currentButton.disabled = true;
        alternateButton.textContent = isYearly
            ? 'Monthly unavailable'
            : billing.hasRecurringSubscription
              ? 'Upgrade to annual'
              : 'Annual unavailable';
        alternateButton.disabled = isYearly || !billing.hasRecurringSubscription;
        lifetimeButton.textContent = 'Upgrade to lifetime';
        document.getElementById('lifetimeNote').textContent =
            `Your ${planName.toLowerCase()} subscription is canceled after Lifetime activates`;
        return;
    }

    plan.textContent = 'No active plan';
    detail.textContent = 'Choose a plan below to restore dashboard access.';
}

function formatPlanName(plan) {
    if (plan === 'yearly') return 'Annual';
    if (plan === 'lifetime') return 'Lifetime';
    return 'Monthly';
}

function highlightPlan(plan) {
    const buttons = {
        monthly: document.getElementById('subscribeMonthly'),
        yearly: document.getElementById('subscribeYearly'),
        lifetime: document.getElementById('buyLifetime'),
    };
    document.querySelectorAll('.pricing-card.is-selected-plan').forEach((card) => {
        card.classList.remove('is-selected-plan');
    });
    const button = buttons[plan];
    if (!button) return;
    button.closest('.pricing-card')?.classList.add('is-selected-plan');
    button.textContent = `Continue with ${formatPlanName(plan)}`;
}

function showPricingNotice(title, message) {
    document.getElementById('pricingNoticeTitle').textContent = title;
    document.getElementById('pricingNoticeMessage').textContent = message;
    document.getElementById('pricingNotice').classList.remove('hidden');
}

function waitForActivationThenRedirect(sessionId) {
    activationSessionId = sessionId;
    // Clean the query string so a refresh does not re-trigger this flow.
    window.history.replaceState({}, document.title, '/pricing');
    setActivationState(
        'Activating your access',
        'We are confirming your plan. Keep this page open for a moment.',
        true
    );

    const redirectToDashboard = () => {
        // The /client route authenticates via the token query param (same as the
        // normal login flow), so the user is taken straight into the dashboard
        // without being asked to log in again.
        const token = window.sessionStorage.userToken;
        window.location.href = token ? `/client/?token=${encodeURIComponent(token)}` : '/client';
    };

    // Server-side fallback: activate immediately from the checkout session so we
    // do not depend solely on the webhook (which may be delayed or unconfigured).
    const verify = sessionId ? stripeVerifySession(sessionId).catch(() => null) : Promise.resolve(null);

    verify.then((result) => {
        if (result && result.active) {
            redirectToDashboard();
            return;
        }
        pollBilling(redirectToDashboard);
    });
}

function setActivationState(title, message, loading) {
    document.querySelector('.pricing-main').classList.add('is-activating');
    document.getElementById('checkoutStatus').classList.remove('hidden');
    document.getElementById('checkoutStatusTitle').textContent = title;
    document.getElementById('checkoutStatusMessage').textContent = message;
    document.querySelector('.checkout-status-spinner').classList.toggle('hidden', !loading);
    document.getElementById('checkoutStatusActions').classList.toggle('hidden', loading);
}

function pollBilling(onDone) {
    const maxAttempts = 10;
    const delayMs = 1500;
    let attempts = 0;

    const poll = () => {
        attempts++;
        getBilling()
            .then((billing) => {
                if (billing && billing.active) {
                    onDone();
                    return;
                }
                if (attempts < maxAttempts) {
                    setTimeout(poll, delayMs);
                } else {
                    setActivationState(
                        'Activation is taking longer than expected',
                        'Your payment is safe. Try the confirmation again in a moment; you will not be charged twice.',
                        false
                    );
                }
            })
            .catch(() => {
                if (attempts < maxAttempts) {
                    setTimeout(poll, delayMs);
                } else {
                    setActivationState(
                        'We could not confirm your plan yet',
                        'Check your connection and try again. Retrying only verifies the completed payment.',
                        false
                    );
                }
            });
    };

    poll();
}

function showAccountRequiredModal({ icon, title, html, requireFullAccount = false }) {
    return Swal.fire({
        position: 'top',
        icon,
        title,
        html,
        showCancelButton: true,
        showDenyButton: !requireFullAccount,
        reverseButtons: true,
        confirmButtonText: requireFullAccount
            ? '<i class="uil uil-user-plus"></i> Create account'
            : '<i class="uil uil-sign-in-alt"></i> Sign in',
        denyButtonText: '<i class="uil uil-user-plus"></i> Create account',
        cancelButtonText: 'Cancel',
        customClass: {
            popup: requireFullAccount ? 'pricing-account-modal pricing-account-modal-single' : 'pricing-account-modal',
            actions: 'pricing-account-actions',
            confirmButton: 'pricing-account-action',
            denyButton: 'pricing-account-action',
            cancelButton: 'pricing-account-action',
        },
        allowOutsideClick: false,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = requireFullAccount ? '/?signup=1' : '/';
        } else if (result.isDenied) {
            window.location.href = '/?signup=1';
        }
    });
}

async function startCheckout(plan, button) {
    if (
        plan === 'yearly' &&
        currentBilling?.subscriptionType === 'monthly' &&
        currentBilling.active &&
        currentBilling.hasRecurringSubscription
    ) {
        return upgradeToYearly(button);
    }

    if (
        plan === 'lifetime' &&
        ['monthly', 'yearly'].includes(currentBilling?.subscriptionType) &&
        currentBilling.active &&
        currentBilling.hasRecurringSubscription
    ) {
        const planName = currentBilling.subscriptionType === 'yearly' ? 'annual' : 'monthly';
        const result = await Swal.fire({
            position: 'top',
            icon: 'question',
            title: 'Upgrade to Lifetime?',
            text: `After Lifetime access is confirmed, your ${planName} subscription will be canceled automatically.`,
            showCancelButton: true,
            reverseButtons: true,
            confirmButtonText: 'Continue to Stripe',
            customClass: {
                popup: 'pricing-confirm-modal',
                actions: 'pricing-modal-actions',
                confirmButton: 'pricing-modal-action',
                cancelButton: 'pricing-modal-action',
            },
        });
        if (!result.isConfirmed) return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Opening Stripe...';
    stripeCheckout(plan)
        .then((data) => {
            if (data && data.url) {
                window.location.href = data.url;
            } else {
                popupMessage('error', 'Unable to start checkout. Please try again.');
                button.disabled = false;
                button.textContent = originalText;
            }
        })
        .catch((error) => {
            console.error('Response data:', error?.response?.data);
            const response = error?.response;
            const isDemoAccount =
                response?.data?.code === 'DEMO_ACCOUNT' ||
                (response?.status === 403 && response?.data?.message?.includes('demo accounts'));
            if (
                (response?.status === 404 && response?.data?.message === 'Token not found') ||
                response?.status === 401 ||
                isDemoAccount
            ) {
                button.disabled = false;
                button.textContent = originalText;
                return showAccountRequiredModal({
                    icon: 'info',
                    title: isDemoAccount ? 'Create a full account' : 'Sign in to continue',
                    html: isDemoAccount
                        ? 'Demo accounts cannot purchase plans.<br/>Create your own account to continue to checkout.'
                        : 'Sign in to connect the purchase to your account, or create an account if you are new.',
                    requireFullAccount: isDemoAccount,
                });
            }
            const message =
                response?.data?.message || response?.data?.error || 'Unable to start checkout. Please try again.';
            popupMessage('error', message);
            button.disabled = false;
            button.textContent = originalText;
            if (response?.data?.code === 'PLAN_ALREADY_ACTIVE') loadPricingBilling();
        });
}

async function upgradeToYearly(button) {
    const result = await Swal.fire({
        position: 'top',
        icon: 'question',
        title: 'Upgrade to Annual?',
        text: 'Your annual plan starts now. Stripe will immediately invoice the prorated difference.',
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: 'Upgrade now',
        customClass: {
            popup: 'pricing-confirm-modal',
            actions: 'pricing-modal-actions',
            confirmButton: 'pricing-modal-action',
            cancelButton: 'pricing-modal-action',
        },
    });
    if (!result.isConfirmed) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Upgrading...';
    try {
        const billing = await stripeChangePlan('yearly');
        currentBilling = { ...currentBilling, ...billing };
        renderPricingBilling(currentBilling);
        popupMessage('success', 'Your annual plan is now active.');
    } catch (error) {
        popupMessage('error', error?.response?.data?.message || 'Unable to upgrade your plan. Please try again.');
        button.disabled = false;
        button.textContent = originalText;
        loadPricingBilling();
    }
}

function openBillingPortal() {
    const button = document.getElementById('pricingManageBilling');
    button.disabled = true;
    stripePortal()
        .then((data) => {
            if (data?.url) window.location.href = data.url;
            else throw new Error('Missing billing portal URL');
        })
        .catch((error) => {
            popupMessage('error', error?.response?.data?.message || 'Unable to open billing. Please try again.');
            button.disabled = false;
        });
}
