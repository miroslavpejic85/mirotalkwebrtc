'use strict';

const form = document.getElementById('forgotPasswordForm');
const emailInput = document.getElementById('email');
const submitButton = form.querySelector('button[type="submit"]');
const statusMessage = document.getElementById('formStatus');

function setFormStatus(type, message) {
    statusMessage.className = `form-status ${type}`;
    statusMessage.textContent = message;
    statusMessage.hidden = !message;
}

function setSubmitting(isSubmitting) {
    form.setAttribute('aria-busy', String(isSubmitting));
    submitButton.disabled = isSubmitting;
    submitButton.querySelector('span').textContent = isSubmitting ? 'Sending...' : 'Send Reset Link';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    setFormStatus('', '');

    if (!email) {
        setFormStatus('warning', 'Please enter your email address.');
        emailInput.focus();
        return;
    }

    if (!emailInput.validity.valid) {
        setFormStatus('warning', 'Enter a valid email address.');
        emailInput.focus();
        return;
    }

    setSubmitting(true);

    try {
        const response = await passwordResetRequest(email);

        if (response.message) {
            setFormStatus('success', 'If an account exists for this email, a reset link has been sent.');
            emailInput.value = '';
        }
    } catch (err) {
        console.error('Forgot password error:', err);
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred. Please try again.';
        setFormStatus('error', errorMessage);
    } finally {
        setSubmitting(false);
    }
});
