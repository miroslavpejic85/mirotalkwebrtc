'use strict';

console.log('Location', window.location);

const usernameIn = document.getElementById('usernameInput');
const emailIn = document.getElementById('emailIdInput');
const passwordIdIn = document.getElementById('passwordIdInput');
const repeatPasswordIdInput = document.getElementById('repeatPasswordIdInput');
const loginBtn = document.getElementById('loginBtn');

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
    if (
        passwordIdIn.value == '' ||
        repeatPasswordIdInput.value == '' ||
        passwordIdIn.value != repeatPasswordIdInput.value
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
