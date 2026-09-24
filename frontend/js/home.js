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
const signupPasswordGuidance = document.getElementById('signupPasswordGuidance');
const signupPasswordRequirements = document.getElementById('signupPasswordRequirements');
const signupPasswordHint = signupPasswordGuidance.querySelector('.password-hint');
const signupPasswordSuccess = signupPasswordGuidance.querySelector('.password-success');

// login
const loginUsernameInput = document.getElementById('loginUsernameInput');
const loginEmailIdInput = document.getElementById('loginEmailIdInput');
const loginPasswordIdInput = document.getElementById('loginPasswordIdInput');
const loginBtn = document.getElementById('loginBtn');
const pageLoadingOverlay = document.getElementById('pageLoadingOverlay');

// tabs
const tabHeader = document.querySelector('.tab-header');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginPanel = document.getElementById('loginPanel');
const signupPanel = document.getElementById('signupPanel');
const pendingConfirmationPanel = document.getElementById('pendingConfirmationPanel');
const pendingConfirmationEmail = document.getElementById('pendingConfirmationEmail');
const pendingConfirmationStatus = document.getElementById('pendingConfirmationStatus');
const resendConfirmationBtn = document.getElementById('resendConfirmationBtn');
const changeConfirmationEmailBtn = document.getElementById('changeConfirmationEmailBtn');
const pendingSignInBtn = document.getElementById('pendingSignInBtn');
let pendingRegistration = null;
let resendCountdownTimer = null;

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
tabHeader.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === 'ArrowLeft' || event.key === 'Home' ? tabLogin : tabSignup;
    switchTab(nextTab === tabLogin ? 'login' : 'signup');
    nextTab.focus();
});

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
    const showLogin = tab === 'login';
    tabHeader.hidden = false;
    pendingConfirmationPanel.hidden = true;
    pendingConfirmationPanel.classList.remove('active');
    tabLogin.classList.toggle('active', showLogin);
    tabSignup.classList.toggle('active', !showLogin);
    tabLogin.setAttribute('aria-selected', String(showLogin));
    tabSignup.setAttribute('aria-selected', String(!showLogin));
    tabLogin.tabIndex = showLogin ? 0 : -1;
    tabSignup.tabIndex = showLogin ? -1 : 0;
    loginPanel.classList.toggle('active', showLogin);
    signupPanel.classList.toggle('active', !showLogin);
    loginPanel.hidden = !showLogin;
    signupPanel.hidden = showLogin;

    if (showLogin) {
        cleanSignUpInput();
    } else {
        cleanLoginInput();
    }
}

loginPanel.addEventListener('submit', handleLogin);
signupPanel.addEventListener('submit', handleSignup);

function handleLogin(e) {
    e.preventDefault();
    cleanSignUpInput();
    if (!validateInputs(loginUsernameInput, loginEmailIdInput, loginPasswordIdInput)) return false;
    const data = gatherInputData(loginUsernameInput, loginEmailIdInput, loginPasswordIdInput);
    signupOrLogin(data);
}

function handleSignup(e) {
    e.preventDefault();
    cleanLoginInput();
    const fieldsValid = validateInputs(
        signupUsernameInput,
        signupEmailIdInput,
        signupPasswordIdInput,
        signupRepeatPasswordIdInput
    );
    const passwordValid = validateSignupPassword();
    const passwordsMatch = validateMatchingPasswords();
    const consentValid = validateConsent();
    if (!fieldsValid || !passwordValid || !passwordsMatch || !consentValid) {
        signupPanel.querySelector('[aria-invalid="true"]')?.focus();
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

function validateInputs(...inputs) {
    let isValid = true;
    for (const input of inputs) {
        if (input.value.trim() === '') {
            setFieldError(input, `${input.name} is required.`);
            isValid = false;
        } else if (input.type === 'email' && !input.validity.valid) {
            setFieldError(input, 'Enter a valid email address.');
            isValid = false;
        } else {
            clearFieldError(input);
        }
    }
    if (!isValid) inputs.find((input) => input.getAttribute('aria-invalid') === 'true')?.focus();
    return isValid;
}

function validateMatchingPasswords() {
    if (!signupPasswordIdInput.value || !signupRepeatPasswordIdInput.value) return true;
    if (signupPasswordIdInput.value !== signupRepeatPasswordIdInput.value) {
        setFieldError(signupRepeatPasswordIdInput, 'Passwords do not match.');
        return false;
    }
    clearFieldError(signupRepeatPasswordIdInput);
    return true;
}

function getPasswordRuleState(password) {
    return {
        length: password.length >= 6 && password.length <= 36,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!%&@#$^*?_~]/.test(password),
    };
}

function updatePasswordRequirements() {
    const rules = getPasswordRuleState(signupPasswordIdInput.value);
    signupPasswordRequirements.querySelectorAll('[data-password-rule]').forEach((item) => {
        item.classList.toggle('met', rules[item.dataset.passwordRule]);
    });
    const isValid = Object.values(rules).every(Boolean);
    const showRules =
        !isValid && (document.activeElement === signupPasswordIdInput || signupPasswordIdInput.ariaInvalid === 'true');
    signupPasswordHint.hidden = isValid || showRules;
    signupPasswordRequirements.hidden = isValid || !showRules;
    signupPasswordSuccess.hidden = !isValid;
    return isValid;
}

function validateSignupPassword() {
    if (!signupPasswordIdInput.value) {
        updatePasswordRequirements();
        return false;
    }
    if (updatePasswordRequirements()) return true;
    setFieldError(signupPasswordIdInput, 'Use a password that meets every requirement below.');
    updatePasswordRequirements();
    return false;
}

function validateConsent() {
    const errorId = 'signupConsentInputError';
    let error = document.getElementById(errorId);
    signupConsentInput.setAttribute('aria-invalid', String(!signupConsentInput.checked));
    signupConsentInput.closest('.legal-consent')?.classList.toggle('invalid', !signupConsentInput.checked);

    if (signupConsentInput.checked) {
        clearConsentError();
        return true;
    }

    if (!error) {
        error = document.createElement('p');
        error.id = errorId;
        error.className = 'field-error consent-error';
        signupConsentInput.closest('.legal-consent')?.insertAdjacentElement('afterend', error);
    }
    error.textContent = 'Accept the Terms of Service and Privacy Policy to continue.';
    signupConsentInput.setAttribute('aria-describedby', errorId);
    return false;
}

function setFieldError(input, message) {
    const errorId = `${input.id}Error`;
    let error = document.getElementById(errorId);
    input.setAttribute('aria-invalid', 'true');
    input.closest('.input-group')?.classList.add('invalid');

    if (!error) {
        error = document.createElement('p');
        error.id = errorId;
        error.className = 'field-error';
        input.closest('.input-group')?.insertAdjacentElement('afterend', error);
    }
    error.textContent = message;
    const descriptionIds = input === signupPasswordIdInput ? `signupPasswordGuidance ${errorId}` : errorId;
    input.setAttribute('aria-describedby', descriptionIds);
}

function clearFieldError(input) {
    document.getElementById(`${input.id}Error`)?.remove();
    input.removeAttribute('aria-invalid');
    if (input === signupPasswordIdInput) {
        input.setAttribute('aria-describedby', 'signupPasswordGuidance');
    } else {
        input.removeAttribute('aria-describedby');
    }
    input.closest('.input-group')?.classList.remove('invalid');
}

function clearConsentError() {
    document.getElementById('signupConsentInputError')?.remove();
    signupConsentInput.removeAttribute('aria-invalid');
    signupConsentInput.removeAttribute('aria-describedby');
    signupConsentInput.closest('.legal-consent')?.classList.remove('invalid');
}

[
    loginUsernameInput,
    loginEmailIdInput,
    loginPasswordIdInput,
    signupUsernameInput,
    signupEmailIdInput,
    signupPasswordIdInput,
    signupRepeatPasswordIdInput,
].forEach((input) => input.addEventListener('input', () => clearFieldError(input)));

signupPasswordIdInput.addEventListener('input', updatePasswordRequirements);
signupPasswordIdInput.addEventListener('focus', updatePasswordRequirements);
signupPasswordIdInput.addEventListener('blur', updatePasswordRequirements);
updatePasswordRequirements();

signupPasswordIdInput.addEventListener('input', () => {
    if (signupPasswordIdInput.value === signupRepeatPasswordIdInput.value) {
        clearFieldError(signupRepeatPasswordIdInput);
    }
});
signupConsentInput.addEventListener('change', validateConsent);

function signupOrLogin(data) {
    window.localStorage.name = data.username;
    window.localStorage.email = data.email;
    pageLoadingOverlay.hidden = false;
    userLogin(data)
        .then((res) => {
            console.log('[API] - USER LOGIN RESPONSE', res);
            if (res.pending) {
                pageLoadingOverlay.hidden = true;
                showPendingConfirmation(data);
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

function showPendingConfirmation(data) {
    pendingRegistration = { ...data };
    pendingConfirmationEmail.textContent = data.email;
    pendingConfirmationStatus.textContent = '';
    tabHeader.hidden = true;
    loginPanel.hidden = true;
    signupPanel.hidden = true;
    loginPanel.classList.remove('active');
    signupPanel.classList.remove('active');
    pendingConfirmationPanel.hidden = false;
    pendingConfirmationPanel.classList.add('active');
    startResendCountdown();
}

function startResendCountdown(seconds = 30) {
    clearInterval(resendCountdownTimer);
    let secondsRemaining = seconds;
    resendConfirmationBtn.disabled = true;
    resendConfirmationBtn.innerHTML = `<i class="uil uil-clock"></i> Resend in ${secondsRemaining}s`;
    resendCountdownTimer = setInterval(() => {
        secondsRemaining -= 1;
        if (secondsRemaining > 0) {
            resendConfirmationBtn.innerHTML = `<i class="uil uil-clock"></i> Resend in ${secondsRemaining}s`;
            return;
        }
        clearInterval(resendCountdownTimer);
        resendConfirmationBtn.disabled = false;
        resendConfirmationBtn.innerHTML = '<i class="uil uil-envelope-redo"></i> Resend confirmation';
    }, 1000);
}

resendConfirmationBtn.addEventListener('click', async () => {
    if (!pendingRegistration) return;
    resendConfirmationBtn.disabled = true;
    resendConfirmationBtn.innerHTML = '<i class="uil uil-sync"></i> Sending...';
    pendingConfirmationStatus.textContent = '';
    pendingConfirmationStatus.classList.remove('error');
    try {
        const response = await userResendConfirmation(pendingRegistration);
        pendingConfirmationStatus.textContent = response.message;
        startResendCountdown();
    } catch (error) {
        const response = error.response?.data;
        pendingConfirmationStatus.textContent = response?.message || 'Unable to resend right now. Please try again.';
        pendingConfirmationStatus.classList.add('error');
        if (response?.confirmed) {
            resendConfirmationBtn.hidden = true;
            return;
        }
        resendConfirmationBtn.disabled = false;
        resendConfirmationBtn.innerHTML = '<i class="uil uil-envelope-redo"></i> Try again';
    }
});

changeConfirmationEmailBtn.addEventListener('click', () => {
    clearInterval(resendCountdownTimer);
    switchTab('signup');
    signupEmailIdInput.focus();
    signupEmailIdInput.select();
});

pendingSignInBtn.addEventListener('click', () => {
    clearInterval(resendCountdownTimer);
    loginUsernameInput.value = pendingRegistration?.username || '';
    loginEmailIdInput.value = pendingRegistration?.email || '';
    switchTab('login');
    loginPasswordIdInput.focus();
});

function elementDisplay(elem, display) {
    if (!elem) return;
    elem.style.display = display ? 'block' : 'none';
}

function cleanLoginInput() {
    loginUsernameInput.value = '';
    loginEmailIdInput.value = '';
    loginPasswordIdInput.value = '';
    [loginUsernameInput, loginEmailIdInput, loginPasswordIdInput].forEach(clearFieldError);
}

function cleanSignUpInput() {
    signupUsernameInput.value = '';
    signupEmailIdInput.value = '';
    signupPasswordIdInput.value = '';
    signupRepeatPasswordIdInput.value = '';
    [signupUsernameInput, signupEmailIdInput, signupPasswordIdInput, signupRepeatPasswordIdInput].forEach(
        clearFieldError
    );
    clearConsentError();
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
        const showPassword = input.type === 'password';
        if (showPassword) {
            input.type = 'text';
            icon.classList.replace('uil-eye', 'uil-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('uil-eye-slash', 'uil-eye');
        }
        this.setAttribute('aria-pressed', String(showPassword));
        this.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
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
