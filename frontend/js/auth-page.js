'use strict';

const authBrandName = document.getElementById('authBrandName');
const authBrandLogo = document.getElementById('authBrandLogo');

fetch('/app-config')
    .then((response) => {
        if (!response.ok) throw new Error(`App config request failed: ${response.status}`);
        return response.json();
    })
    .then((config) => {
        const appName = config?.app?.Name;
        const appLogo = config?.app?.Logo;

        if (appName) {
            authBrandName.textContent = appName;
            authBrandLogo.alt = `${appName} logo`;
        }
        if (appLogo) authBrandLogo.src = appLogo;
    })
    .catch((error) => console.warn('Unable to load app branding', error));
