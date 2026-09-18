'use strict';

console.log('Location', window.location);

// storage
const storageUsername = window.localStorage.name || '';
const storageEmail = window.localStorage.email || '';

// signup
const signupUsernameInput = document.getElementById('signupUsernameInput');
const signupEmailIdInput = document.getElementById('signupEmailIdInput');
const signupPasswordIdInput = document.getElementById('signupPasswordIdInput');
const signupRepeatPasswordIdInput = document.getElementById('signupRepeatPasswordIdInput');
const signupConsentInput = document.getElementById('signupConsentInput');
const signupBtn = document.getElementById('signupBtn');

// login
const loginUsernameInput = document.getElementById('loginUsernameInput');
const loginEmailIdInput = document.getElementById('loginEmailIdInput');
const loginPasswordIdInput = document.getElementById('loginPasswordIdInput');
const loginBtn = document.getElementById('loginBtn');
const pageLoadingOverlay = document.getElementById('pageLoadingOverlay');

// tabs
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginPanel = document.getElementById('loginPanel');
const signupPanel = document.getElementById('signupPanel');

// branding
const brandName = document.getElementById('brandName');
const brandLogo = document.getElementById('brandLogo');
const brandNameSubtitle = document.getElementById('brandNameSubtitle');
const brandImage = document.getElementById('brandImage');

// Pricing page buttons
const navPricingBtn = document.getElementById('navPricingBtn');
const heroPricingBtn = document.getElementById('heroPricingBtn');

// support
const supportBtn = document.getElementById('supportBtn');

function initCursorLight() {
    const supportsPointerLight = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!supportsPointerLight || prefersReducedMotion) return;

    const light = document.createElement('div');
    light.className = 'cursor-light';
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

const config = {
    support: true,
    //...
};
!config.support && elementDisplay(supportBtn, false);

signupUsernameInput.value = storageUsername;
signupEmailIdInput.value = storageEmail;
signupPasswordIdInput.value = '';
signupRepeatPasswordIdInput.value = '';

loginUsernameInput.value = storageUsername;
loginEmailIdInput.value = storageEmail;
loginPasswordIdInput.value = '';

// Tab switching
tabLogin.addEventListener('click', () => switchTab('login'));
tabSignup.addEventListener('click', () => switchTab('signup'));

// Landing CTA buttons -> switch to the proper auth tab and scroll the card into view
const heroSignUpBtn = document.getElementById('heroSignUpBtn');
const heroDemoBtn = document.getElementById('heroDemoBtn');
const navSignUpBtn = document.getElementById('navSignUpBtn');
const navSignInBtn = document.getElementById('navSignInBtn');
const switchToLoginLink = document.getElementById('switchToLoginLink');

function focusAuthCard(tab) {
    switchTab(tab);
    const card = document.querySelector('.main');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

heroSignUpBtn?.addEventListener('click', () => focusAuthCard('signup'));
navSignUpBtn?.addEventListener('click', () => focusAuthCard('signup'));
navSignInBtn?.addEventListener('click', () => focusAuthCard('login'));
switchToLoginLink?.addEventListener('click', () => switchTab('login'));

// Deep-link: /?signup=1 (e.g. coming from the pricing page) focuses the Sign up card.
(function handleSignupDeepLink() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === '1') {
        focusAuthCard('signup');
        window.history.replaceState({}, document.title, '/');
    }
})();

// Demo account: if the server has demo mode enabled, show a one-click
// "Try the demo" CTA that logs in with the shared demo credentials.
let demoCredentials = null;

function loginAsDemo() {
    if (!demoCredentials) return focusAuthCard('login');
    signupOrLogin({
        username: demoCredentials.username,
        email: (demoCredentials.email || '').toLowerCase().trim(),
        password: demoCredentials.password,
    });
}

(function initDemoMode() {
    if (sessionStorage.getItem('userDemo')) {
        demoCredentials = JSON.parse(sessionStorage.getItem('userDemo'));
        loadDemoCredentials(demoCredentials);
    } else {
        userDemoConfig()
            .then((cfg) => {
                demoCredentials = cfg;
                sessionStorage.setItem('userDemo', JSON.stringify(demoCredentials));
                loadDemoCredentials(demoCredentials);
            })
            .catch((err) => console.warn('[API] - DEMO CONFIG unavailable', err?.message));
    }

    function loadDemoCredentials(demoCredentials) {
        if (demoCredentials && demoCredentials.enabled) {
            heroDemoBtn.hidden = false;
            heroDemoBtn.addEventListener('click', loginAsDemo);
        }
    }
})();

function switchTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginPanel.classList.add('active');
        signupPanel.classList.remove('active');
        cleanSignUpInput();
    } else {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupPanel.classList.add('active');
        loginPanel.classList.remove('active');
        cleanLoginInput();
    }
}

loginBtn.addEventListener('click', handleLogin);

[loginUsernameInput, loginEmailIdInput, loginPasswordIdInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin(e);
    });
});

signupBtn.addEventListener('click', handleSignup);

[signupUsernameInput, signupEmailIdInput, signupPasswordIdInput, signupRepeatPasswordIdInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSignup(e);
    });
});

function handleLogin(e) {
    e.preventDefault();
    cleanSignUpInput();
    const validationError = validateInput(loginUsernameInput, loginEmailIdInput, loginPasswordIdInput);
    if (validationError) {
        popupMessage('warning', validationError);
        return false;
    }
    const data = gatherInputData(loginUsernameInput, loginEmailIdInput, loginPasswordIdInput);
    signupOrLogin(data);
}

function handleSignup(e) {
    e.preventDefault();
    cleanLoginInput();
    const validationError = validateInput(
        signupUsernameInput,
        signupEmailIdInput,
        signupPasswordIdInput,
        signupRepeatPasswordIdInput
    );
    if (validationError) {
        popupMessage('warning', validationError);
        return false;
    }
    if (!signupConsentInput.checked) {
        popupMessage('warning', 'Please accept the Terms of Service and acknowledge the Privacy Policy.');
        return false;
    }
    const data = gatherInputData(signupUsernameInput, signupEmailIdInput, signupPasswordIdInput);
    data.legalConsent = true;
    data.legalVersion = signupConsentInput.dataset.legalVersion;
    signupOrLogin(data);
}

function gatherInputData(usernameInput, emailInput, passwordInput) {
    return {
        username: usernameInput.value.trim(),
        email: emailInput.value.toLowerCase().trim(),
        password: passwordInput.value.trim(),
    };
}

function validateInput(...inputs) {
    for (const input of inputs) {
        if (input.value.trim() === '') {
            return `⚠️ ${input.name} field empty!`;
        }
    }
    if (signupRepeatPasswordIdInput && signupPasswordIdInput.value !== signupRepeatPasswordIdInput.value) {
        return '⚠️ Repeat password field does not match!';
    }
    return null;
}

function signupOrLogin(data) {
    window.localStorage.name = data.username;
    window.localStorage.email = data.email;
    pageLoadingOverlay.hidden = false;
    userLogin(data)
        .then((res) => {
            console.log('[API] - USER LOGIN RESPONSE', res);
            if (res.pending) {
                pageLoadingOverlay.hidden = true;
                showPendingConfirmation(data.email);
                switchTab('login');
                return;
            }
            if (res.message) {
                pageLoadingOverlay.hidden = true;
                res.success ? popupMessage('success', res.message) : popupMessage('warning', res.message);
                if (res.message.includes('CodeCanyon')) {
                    switchTab('login');
                }
            } else {
                window.sessionStorage.userId = res._id;
                window.sessionStorage.userToken = res.token;
                window.location.href = `/client/?token=${res.token}`;
                // Token will be stripped from URL by client.js after reading
            }
        })
        .catch((err) => {
            pageLoadingOverlay.hidden = true;
            console.error('[API] - USER LOGIN ERROR', err);
            popupMessage('error', `⚠️ API USER LOGIN error: ${err.message}`);
        });
}

function showPendingConfirmation(email) {
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'top',
        icon: 'success',
        title: 'Check your inbox',
        html: `
            <p class="pending-email-copy">We sent a confirmation link to <strong>${escapeHtml(email)}</strong>.</p>
            <p class="pending-email-hint">Open the link to activate your account. If it is not there, check your spam or junk folder.</p>
        `,
        confirmButtonText: 'Got it',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    });
}

function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
}

function elementDisplay(elem, display) {
    if (!elem) return;
    elem.style.display = display ? 'block' : 'none';
}

function cleanLoginInput() {
    loginUsernameInput.value = '';
    loginEmailIdInput.value = '';
    loginPasswordIdInput.value = '';
}

function cleanSignUpInput() {
    signupUsernameInput.value = '';
    signupEmailIdInput.value = '';
    signupPasswordIdInput.value = '';
    signupRepeatPasswordIdInput.value = '';
}

function loadAppConfig(cfg) {
    if (cfg && cfg.app && cfg.app.Name && cfg.app.Logo && cfg.app.Image) {
        brandNameSubtitle.textContent = cfg.app.Name;
        brandName.textContent = cfg.app.Name;
        brandLogo.src = cfg.app.Logo;
        brandImage.dataset.themeSrcDark = cfg.app.Image;
        brandImage.src =
            document.documentElement.dataset.theme === 'light'
                ? brandImage.dataset.themeSrcLight
                : brandImage.dataset.themeSrcDark;
    }
    if (cfg && cfg.saas && !cfg.saas.enabled) {
        elementDisplay(navPricingBtn, false);
        elementDisplay(heroPricingBtn, false);
    }
}

// Password visibility toggle
document.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', function () {
        const input = this.parentElement.querySelector('input');
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('uil-eye', 'uil-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('uil-eye-slash', 'uil-eye');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('appConfig')) {
        const cfg = JSON.parse(sessionStorage.getItem('appConfig'));
        loadAppConfig(cfg);
    } else {
        getAppConfig()
            .then((cfg) => {
                sessionStorage.setItem('appConfig', JSON.stringify(cfg));
                loadAppConfig(cfg);
            })
            .catch(() => {});
    }
});
