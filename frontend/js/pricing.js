'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const sessionId = params.get('session_id');

    if (status === 'success') {
        // The Stripe webhook activates the subscription asynchronously, so verify
        // the checkout session server-side (fallback) and poll the billing status
        // before sending the user to the dashboard. This avoids bouncing back to
        // /pricing if the webhook hasn't landed yet.
        waitForActivationThenRedirect(sessionId);
        return;
    } else if (status === 'cancel') {
        popupMessage('warning', 'Checkout canceled. You can pick a plan whenever you are ready.');
        window.history.replaceState({}, document.title, '/pricing');
    }

    // Populate price labels from the server config.
    getConfig()
        .then((config) => {
            const saas = config && config.SAAS;
            if (saas && saas.pricing) {
                const monthlyEl = document.getElementById('monthlyPrice');
                const lifetimeEl = document.getElementById('lifetimePrice');
                if (monthlyEl && saas.pricing.monthly) monthlyEl.textContent = saas.pricing.monthly;
                if (lifetimeEl && saas.pricing.lifetime) lifetimeEl.textContent = saas.pricing.lifetime;
            }
        })
        .catch(() => {
            // Non-fatal: keep the default labels rendered in the HTML.
        });

    const subscribeMonthly = document.getElementById('subscribeMonthly');
    const buyLifetime = document.getElementById('buyLifetime');

    subscribeMonthly.addEventListener('click', () => startCheckout('monthly', subscribeMonthly));
    buyLifetime.addEventListener('click', () => startCheckout('lifetime', buyLifetime));
});

function waitForActivationThenRedirect(sessionId) {
    // Clean the query string so a refresh does not re-trigger this flow.
    window.history.replaceState({}, document.title, '/pricing');
    popupMessage('toast', 'Payment received! Activating your access...');

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
                    // Taking longer than expected; let the user proceed.
                    // The /client guard will redirect back here if still not active.
                    popupMessage(
                        'success',
                        'Payment received! If your dashboard is not ready, please refresh shortly.'
                    );
                    setTimeout(onDone, 2000);
                }
            })
            .catch(() => {
                if (attempts < maxAttempts) {
                    setTimeout(poll, delayMs);
                } else {
                    onDone();
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
        confirmButtonText: '<i class="uil uil-user-plus"></i> Create account',
        cancelButtonText: 'Cancel',
        allowOutsideClick: false,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/?signup=1';
        }
    });
}

function startCheckout(plan, button) {
    // Subscribing requires an account: Stripe checkout is tied to the logged-in
    // user. If there is no session token, guide the visitor to sign up first.
    const isLoggedIn = !!window.sessionStorage.userToken;

    if (!isLoggedIn) {
        return showAccountRequiredModal({
            icon: 'info',
            title: 'Create your account first',
            html: 'To subscribe, please create a free account first.<br/>Your plan will unlock your private dashboard and meeting rooms.',
        });
    }

    button.disabled = true;
    stripeCheckout(plan)
        .then((data) => {
            if (data && data.url) {
                window.location.href = data.url;
            } else {
                popupMessage('error', 'Unable to start checkout. Please try again.');
                button.disabled = false;
            }
        })
        .catch((error) => {
            const message = error?.response?.data?.message || 'Unable to start checkout. Please try again.';
            popupMessage('error', message);
            button.disabled = false;
        });
}
