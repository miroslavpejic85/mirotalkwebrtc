'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    const statusMap = {
        success: 'statusSuccess',
        already: 'statusAlready',
        error: 'statusError',
    };

    const elementId = statusMap[status] || statusMap.error;
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'flex';
});
