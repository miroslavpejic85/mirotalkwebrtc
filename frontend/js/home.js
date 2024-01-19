'use strict';

console.log('Location', window.location);

const usernameIn = document.getElementById('usernameInput');
const emailIn = document.getElementById('emailIdInput');
const passwordIdIn = document.getElementById('passwordIdInput');
const repeatPasswordIdLabel = document.getElementById('repeatPasswordIdLabel');
const repeatPasswordIdInput = document.getElementById('repeatPasswordIdInput');
const loginBtn = document.getElementById('loginBtn');
const registerDiv = document.getElementById('registerDiv');
const loginDiv = document.getElementById('loginDiv');
const registerNowBtn = document.getElementById('registerNowBtn');
const loginNowBtn = document.getElementById('loginNowBtn');
const supportDiv = document.getElementById('supportDiv');
const supportBtn = document.getElementById('supportBtn');

const config = {
    support: true,
    //...
};
!config.support && elementDisplay(supportDiv, false);

usernameIn.value = window.localStorage.name || '';
emailIn.value = window.localStorage.email || '';

loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (usernameIn.value == '') {
        popupMessage('warning', '⚠️ Username field empty!');
        return false;
    }
    if (emailIn.value == '') {
        popupMessage('warning', '⚠️ Email field empty!');
        return false;
    }
    if (passwordIdIn.value == '') {
        popupMessage('warning', '⚠️ Password field empty!');
        return false;
    }
    if (
        loginBtn.innerText == 'Register' &&
        (passwordIdIn.value == '' ||
            repeatPasswordIdInput.value == '' ||
            passwordIdIn.value != repeatPasswordIdInput.value)
    ) {
        popupMessage('warning', '⚠️ Repeat password field not match!');
        return false;
    }

    window.localStorage.name = usernameIn.value.trim();
    window.localStorage.email = emailIn.value.toLowerCase().trim();

    const data = {
        username: usernameIn.value.trim(),
        email: emailIn.value.toLowerCase().trim(),
        password: passwordIdIn.value.trim(),
    };

    userLogin(data)
        .then((res) => {
            console.log('[API] - USER LOGIN RESPONSE', res);
            if (res.message) {
                popupMessage('warning', res.message);
                if (!res.message.includes('Pending')) {
                    showRegisterDiv();
                }
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
});

registerNowBtn.addEventListener('click', (e) => {
    showLoginDiv();
});

loginNowBtn.addEventListener('click', (e) => {
    showRegisterDiv();
});

supportBtn.onclick = () => {
    window.open('https://codecanyon.net/user/miroslavpejic85', '_blank');
};

function showLoginDiv() {
    loginBtn.innerText = 'Register';
    elementDisplay(registerDiv, false);
    elementDisplay(repeatPasswordIdLabel, true);
    elementDisplay(repeatPasswordIdInput, true);
    elementDisplay(loginDiv, true);
}

function showRegisterDiv() {
    loginBtn.innerText = 'Login';
    elementDisplay(loginDiv, false);
    elementDisplay(repeatPasswordIdLabel, false);
    elementDisplay(repeatPasswordIdInput, false);
    elementDisplay(registerDiv, true);
}

function elementDisplay(elem, display) {
    if (!elem) return;
    elem.style.display = display ? 'block' : 'none';
}
