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

function loadPricingAppConfig(config) {
    if (config?.app?.Name) {
        document.querySelectorAll('[data-app-name]').forEach((element) => {
            element.textContent = config.app.Name;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const sessionId = params.get('session_id');

    if (sessionStorage.getItem('appConfig')) {
        loadPricingAppConfig(JSON.parse(sessionStorage.getItem('appConfig')));
    } else {
        getAppConfig()
            .then((config) => {
                sessionStorage.setItem('appConfig', JSON.stringify(config));
                loadPricingAppConfig(config);
            })
            .catch(() => {});
    }

    if (status === 'success') {
        // The Stripe webhook activates the subscription asynchronously, so verify
        // the checkout session server-side (fallback) and poll the billing status
        // before sending the user to the dashboard. This avoids bouncing back to
        // /pricing if the webhook hasn't landed yet.
        waitForActivationThenRedirect(sessionId);
    } else if (status === 'cancel') {
        popupMessage('warning', 'Checkout canceled. You can pick a plan whenever you are ready.');
        window.history.replaceState({}, document.title, '/pricing');
    }

    getStripePlans()
        .then((plans) => {
            document.getElementById('monthlyPrice').textContent = formatStripePrice(plans.monthly);
            document.getElementById('lifetimePrice').textContent = formatStripePrice(plans.lifetime);
        })
        .catch(() => {
            document.getElementById('monthlyPrice').textContent = 'Unavailable';
            document.getElementById('lifetimePrice').textContent = 'Unavailable';
            document.getElementById('subscribeMonthly').disabled = true;
            document.getElementById('buyLifetime').disabled = true;
            document.getElementById('monthlyNote').textContent = 'Price is temporarily unavailable';
            document.getElementById('lifetimeNote').textContent = 'Price is temporarily unavailable';
        });

    loadPricingBilling();

    const subscribeMonthly = document.getElementById('subscribeMonthly');
    const buyLifetime = document.getElementById('buyLifetime');

    subscribeMonthly.addEventListener('click', () => startCheckout('monthly', subscribeMonthly));
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
    if (!billing || !billing.subscriptionType) return;

    const status = document.getElementById('pricingAccountStatus');
    const plan = document.getElementById('pricingAccountPlan');
    const detail = document.getElementById('pricingAccountDetail');
    const manage = document.getElementById('pricingManageBilling');
    const monthlyButton = document.getElementById('subscribeMonthly');
    const lifetimeButton = document.getElementById('buyLifetime');

    status.classList.remove('hidden');
    manage.classList.toggle('hidden', !billing.hasBillingAccount);

    if (billing.subscriptionType === 'lifetime' && billing.active) {
        plan.textContent = 'Lifetime access is active';
        detail.textContent = 'There are no recurring access charges.';
        monthlyButton.textContent = 'Included in lifetime';
        monthlyButton.disabled = true;
        lifetimeButton.textContent = 'Current plan';
        lifetimeButton.disabled = true;
        return;
    }

    if (billing.subscriptionType === 'monthly' && billing.active) {
        const endDate = billing.subscriptionExpiresAt
            ? new Date(billing.subscriptionExpiresAt).toLocaleDateString()
            : '';
        plan.textContent = billing.subscriptionCancelAtPeriodEnd
            ? 'Monthly access is ending'
            : 'Monthly plan is active';
        detail.textContent = billing.subscriptionCancelAtPeriodEnd
            ? `Access continues until ${endDate}.`
            : `Next renewal: ${endDate}.`;
        monthlyButton.textContent = 'Current plan';
        monthlyButton.disabled = true;
        lifetimeButton.textContent = 'Upgrade to lifetime';
        document.getElementById('lifetimeNote').textContent =
            'Your monthly subscription is canceled after Lifetime activates';
        return;
    }

    plan.textContent = 'No active plan';
    detail.textContent = 'Choose a plan below to restore dashboard access.';
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

function showAccountRequiredModal({ icon, title, html }) {
    return Swal.fire({
        position: 'top',
        icon,
        title,
        html,
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: '<i class="uil uil-user-plus"></i> Create account',
        cancelButtonText: 'Cancel',
        customClass: {
            popup: 'pricing-account-modal',
            actions: 'pricing-account-actions',
            confirmButton: 'pricing-account-action',
            cancelButton: 'pricing-account-action',
        },
        allowOutsideClick: false,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/?signup=1';
        }
    });
}

async function startCheckout(plan, button) {
    if (plan === 'lifetime' && currentBilling?.subscriptionType === 'monthly' && currentBilling.active) {
        const result = await Swal.fire({
            position: 'top',
            icon: 'question',
            title: 'Upgrade to Lifetime?',
            text: 'After Lifetime access is confirmed, your monthly subscription will be canceled automatically.',
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
                    title: isDemoAccount ? 'Create a full account' : 'Create your account first',
                    html: isDemoAccount
                        ? 'Demo accounts cannot purchase plans.<br/>Create your own account to continue to checkout.'
                        : 'Your account connects the purchase to your private dashboard and meeting rooms.',
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
