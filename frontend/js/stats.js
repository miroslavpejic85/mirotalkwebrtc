'use strict';

// https://github.com/mikecao/umami

async function loadUmami() {
    try {
        const response = await fetch('/app-config');
        if (!response.ok) throw new Error(`Unable to load analytics configuration (${response.status})`);

        const { analytics } = await response.json();
        if (!analytics?.enabled) return;
        if (!analytics.scriptUrl || !analytics.websiteId) throw new Error('Umami configuration is incomplete');

        const scriptUrl = new URL(analytics.scriptUrl, window.location.origin);
        if (!['http:', 'https:'].includes(scriptUrl.protocol)) throw new Error('Umami script URL is invalid');

        const script = document.createElement('script');
        script.async = true;
        script.src = scriptUrl.href;
        script.dataset.websiteId = analytics.websiteId;
        document.head.appendChild(script);
    } catch (error) {
        console.warn('Umami is unavailable', error.message);
    }
}

loadUmami();
