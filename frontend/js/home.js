'use strict';

console.log('Location', window.location);

const emailIn = document.getElementById('emailIdInput');
const passwordIdIn = document.getElementById('passwordIdInput');
const repeatPasswordIdInput = document.getElementById('repeatPasswordIdInput');
const loginBtn = document.getElementById('loginBtn');

emailIn.value = window.localStorage.email || '';

loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (emailIn.value == '') {
        alert('⚠️ Email field empty!');
        return false;
    }
    if (
        passwordIdIn.value == '' ||
        repeatPasswordIdInput.value == '' ||
        passwordIdIn.value != repeatPasswordIdInput.value
    ) {
        alert('⚠️ Repeat password field not match!');
        return false;
    }

    window.localStorage.email = emailIn.value.toLowerCase();

    const data = {
        email: emailIn.value.toLowerCase(),
        password: passwordIdIn.value,
    };

    userLogin(data)
        .then((res) => {
            console.log('[API] - USER LOGIN RESPONSE', res);
            if (res.message) {
                alert(res.message);
            } else {
                window.sessionStorage.userId = res._id;
                window.sessionStorage.userToken = res.token;
                window.location.href = `/client/?token=${res.token}`;
            }
        })
        .catch((err) => {
            console.error('[API] - USER LOGIN ERROR', err);
            alert(`⚠️ API USER LOGIN error: ${err.message}`);
        });
});
