'use strict';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (!token) {
    popupMessage('error', 'Invalid password reset link');
    setTimeout(() => {
        window.location.href = '/';
    }, 2000);
}

// Verify token on page load
(async () => {
    try {
        const response = await passwordResetVerify(token);

        if (!response.valid) {
            popupMessage('error', 'This password reset link is invalid or has expired');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    } catch (err) {
        console.error('Token verification error:', err);
        const errorMessage = err.response?.data?.message || 'This password reset link is invalid or has expired';
        popupMessage('error', errorMessage);
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
})();

document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    if (!password || !confirmPassword) {
        popupMessage('warning', 'Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        popupMessage('warning', 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        popupMessage('warning', 'Password must be at least 6 characters');
        return;
    }

    try {
        const response = await passwordResetConfirm({ token, password });

        if (response.message) {
            popupMessage('success', 'Your password has been reset successfully');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    } catch (err) {
        console.error('Password reset error:', err);
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred. Please try again.';
        popupMessage('warning', errorMessage);
    }
});
