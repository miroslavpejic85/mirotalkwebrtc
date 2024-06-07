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
const signupBtn = document.getElementById('signupBtn');

// login
const loginUsernameInput = document.getElementById('loginUsernameInput');
const loginEmailIdInput = document.getElementById('loginEmailIdInput');
const loginPasswordIdInput = document.getElementById('loginPasswordIdInput');
const loginBtn = document.getElementById('loginBtn');

// support
const supportBtn = document.getElementById('supportBtn');

const config = {
    support: true,
    //...
};
!config.support && elementDisplay(supportBtn, false);

// Login/Signup
const chk = document.getElementById('chk');
const login = document.querySelector('.login');
const loginLabel = document.querySelector('.login label');
const signupLabel = document.querySelector('.signup label');

signupUsernameInput.value = storageUsername;
signupEmailIdInput.value = storageEmail;
signupPasswordIdInput.value = '';
signupRepeatPasswordIdInput.value = '';

loginUsernameInput.value = storageUsername;
loginEmailIdInput.value = storageEmail;
loginPasswordIdInput.value = '';

showLogin();

chk.addEventListener('change', () => {
    chk.checked ? showSignUp() : showLogin();
});

loginBtn.addEventListener('click', handleLogin);

signupBtn.addEventListener('click', handleSignup);

supportBtn.onclick = () => {
    window.open('https://codecanyon.net/user/miroslavpejic85', '_blank');
};

function handleLogin(e) {
    e.preventDefault();
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
    const validationError = validateInput(
        signupUsernameInput,
        signupEmailIdInput,
        signupPasswordIdInput,
        signupRepeatPasswordIdInput,
    );
    if (validationError) {
        popupMessage('warning', validationError);
        return false;
    }
    const data = gatherInputData(signupUsernameInput, signupEmailIdInput, signupPasswordIdInput);
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
    userLogin(data)
        .then((res) => {
            console.log('[API] - USER LOGIN RESPONSE', res);
            if (res.message) {
                res.success ? popupMessage('success', res.message) : popupMessage('warning', res.message);
                res.message.includes('Pending') ? showLogin() : showSignUp();
            } else {
                window.sessionStorage.userId = res._id;
                window.sessionStorage.userToken = res.token;
                window.location.href = `/client/?token=${res.token}`;
            }
        })
        .catch((err) => {
            console.error('[API] - USER LOGIN ERROR', err);
            popupMessage('error', `⚠️ API USER LOGIN error: ${err.message}`);
        });
}

function elementDisplay(elem, display) {
    if (!elem) return;
    elem.style.display = display ? 'block' : 'none';
}

function showSignUp() {
    login.style.transform = 'translateY(-180px)';
    loginLabel.style.transform = 'scale(0.6)';
    signupLabel.style.transform = 'scale(1)';
    cleanLoginInput();
}

function showLogin() {
    login.style.transform = 'translateY(-550px)';
    loginLabel.style.transform = 'scale(1)';
    signupLabel.style.transform = 'scale(0.6)';
    cleanSignUpInput();
}

function cleanLoginInput() {
    loginUsernameInput.value = '';
    loginEmailIdInput.value = '';
}

function cleanSignUpInput() {
    signupUsernameInput.value = '';
    signupEmailIdInput.value = '';
}
