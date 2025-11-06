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
        const response = await fetch(`/api/v1/password/reset/verify/${token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
            await popupMessage('error', 'This password reset link is invalid or has expired');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    } catch (error) {
        console.error('Token verification error:', error);
        await popupMessage('error', 'An error occurred. Please try again.');
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
        popupMessage('error', 'Passwords do not match');
        return;
    }

    if (password.length < 8) {
        popupMessage('error', 'Password must be at least 8 characters');
        return;
    }

    try {
        const response = await fetch('/api/v1/password/reset/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, password }),
        });

        const data = await response.json();

        if (response.ok) {
            await popupMessage('success', 'Your password has been reset successfully');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            await popupMessage('error', data.message);
        }
    } catch (error) {
        console.error('Password reset error:', error);
        await popupMessage('error', 'An error occurred. Please try again.');
    }
});
