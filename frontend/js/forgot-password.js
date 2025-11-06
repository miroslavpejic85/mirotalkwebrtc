'use strict';

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();

    if (!email) {
        popupMessage('warning', 'Please enter your email address');
        return;
    }

    try {
        const response = await fetch('/api/v1/password/reset/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok) {
            await popupMessage('success', data.message);
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            await popupMessage('error', data.message);
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        await popupMessage('error', 'An error occurred. Please try again.');
    }
});
