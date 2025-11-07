'use strict';

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();

    if (!email) {
        popupMessage('warning', 'Please enter your email address');
        return;
    }

    try {
        const response = await passwordResetRequest(email);

        if (response.message) {
            popupMessage('success', response.message);
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    } catch (err) {
        console.error('Forgot password error:', err);
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred. Please try again.';
        popupMessage('warning', errorMessage);
    }
});
