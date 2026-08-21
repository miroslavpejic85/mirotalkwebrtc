'use strict';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const form = document.getElementById('resetPasswordForm');
const submitButton = form.querySelector('button[type="submit"]');
const statusMessage = document.getElementById('formStatus');
const resetFields = document.getElementById('resetFields');

function setFormStatus(type, message) {
    statusMessage.className = `form-status ${type}`;
    statusMessage.textContent = message;
    statusMessage.hidden = !message;
}

function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.querySelector('span').textContent = isSubmitting ? 'Resetting...' : 'Reset Password';
}

async function initializeResetForm() {
    form.setAttribute('aria-busy', 'true');

    if (!token) {
        setFormStatus('error', 'This password reset link is invalid. Request a new link to continue.');
        form.setAttribute('aria-busy', 'false');
        return;
    }

    try {
        const response = await passwordResetVerify(token);

        if (!response.valid) {
            setFormStatus(
                'error',
                'This password reset link is invalid or has expired. Request a new link to continue.'
            );
            return;
        }

        window.history.replaceState({}, document.title, window.location.pathname);
        resetFields.hidden = false;
        setFormStatus('', '');
        document.getElementById('password').focus();
    } catch (err) {
        console.error('Token verification error:', err);
        const errorMessage = err.response?.data?.message || 'This password reset link is invalid or has expired';
        setFormStatus('error', errorMessage);
    } finally {
        form.setAttribute('aria-busy', 'false');
    }
}

initializeResetForm();

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    setFormStatus('', '');

    if (!password || !confirmPassword) {
        setFormStatus('warning', 'Please fill in both password fields.');
        return;
    }

    if (password !== confirmPassword) {
        setFormStatus('warning', 'Passwords do not match.');
        return;
    }

    if (password.length < 6) {
        setFormStatus('warning', 'Password must be at least 6 characters.');
        return;
    }

    setSubmitting(true);

    try {
        const response = await passwordResetConfirm({ token, password });

        if (response.message) {
            setFormStatus('success', 'Your password has been reset. You can now sign in.');
            form.reset();
            resetFields.hidden = true;
            document.getElementById('signInLink').focus();
        }
    } catch (err) {
        console.error('Password reset error:', err);
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred. Please try again.';
        setFormStatus('error', errorMessage);
        setSubmitting(false);
    }
});

// Password visibility toggle
document.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', function () {
        const input = this.parentElement.querySelector('input');
        const icon = this.querySelector('i');
        const showPassword = input.type === 'password';
        input.type = showPassword ? 'text' : 'password';
        icon.classList.toggle('uil-eye', !showPassword);
        icon.classList.toggle('uil-eye-slash', showPassword);
        this.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
        this.setAttribute('aria-pressed', String(showPassword));
    });
});
