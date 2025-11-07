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
const signupTermsBtn = document.getElementById('signupTermsBtn');
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

elementDisplay(signupBtn, false);
elementDisplay(signupTermsBtn, true);

showLogin();

chk.addEventListener('change', () => {
    chk.checked ? showSignUp() : showLogin();
});

loginBtn.addEventListener('click', handleLogin);

signupTermsBtn.addEventListener('click', handleSignupTerms);

signupBtn.addEventListener('click', handleSignup);

supportBtn.onclick = () => {
    window.open('https://codecanyon.net/user/miroslavpejic85', '_blank');
};

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

function handleSignupTerms() {
    Swal.fire({
        title: 'Terms & Conditions',
        html: `
<div class="terms-conditions">
    <h3>1. Introduction</h3>
    <p>By using the Room Scheduler, you agree to comply with our Terms and Conditions. Please read them carefully before using the service.</p>

    <h3>2. User Responsibilities</h3>
    <p>Do not use this service for any illegal, harmful, or abusive activities. You agree to use the service only for lawful purposes and in compliance with applicable laws and regulations.</p>

    <h3>3. Privacy & Data</h3>
    <p>We do not store your video, audio, or chat messages. Your data is processed securely and in accordance with our Privacy Policy. We may collect and use certain non-personally identifiable information for service improvement purposes.</p>

    <h3>4. Account Security</h3>
    <p>You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account or any other security breach.</p>

    <h3>5. Service Availability</h3>
    <p>We strive to maintain the availability of the Room Scheduler, but cannot guarantee continuous or uninterrupted access. We may temporarily suspend the service for maintenance, upgrades, or technical issues.</p>

    <h3>6. Modifications to the Terms</h3>
    <p>We may update or modify these Terms and Conditions at any time. Any changes will be posted on this page, and it is your responsibility to review the Terms regularly. Continued use of the service constitutes acceptance of any modifications.</p>

    <h3>7. Limitation of Liability</h3>
    <p>We are not liable for any damages arising from the use or inability to use the Room Scheduler, including but not limited to direct, indirect, incidental, or consequential damages.</p>

    <h3>8. Termination</h3>
    <p>We reserve the right to suspend or terminate your access to the service at any time, for any reason, including violation of these Terms and Conditions.</p>

    <p><strong>Do you agree to these Terms & Conditions?</strong></p>
</div>
        `,
        icon: 'info',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'I Agree',
        confirmButtonColor: '#007bff',
        cancelButtonColor: '#dc3545',
        focusCancel: true,
        allowOutsideClick: false,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            elementDisplay(signupBtn, true);
            elementDisplay(signupTermsBtn, false);
        }
    });
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
                if (res.message.includes('Pending') || res.message.includes('CodeCanyon')) {
                    showLogin();
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
    login.style.transform = 'translateY(-580px)';
    loginLabel.style.transform = 'scale(1)';
    signupLabel.style.transform = 'scale(0.6)';
    cleanSignUpInput();
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
