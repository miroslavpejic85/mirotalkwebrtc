'use strict';

const authModeToggle = document.getElementById('authModeToggle');
const authBrandName = document.getElementById('authBrandName');
const authBrandLogo = document.getElementById('authBrandLogo');

function setAuthTheme(mode) {
    const isLight = mode === 'light';
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
    window.localStorage.mode = isLight ? 'light' : 'dark';
    authModeToggle.querySelector('i').className = isLight ? 'uil uil-moon' : 'uil uil-sun';
    authModeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    authModeToggle.title = isLight ? 'Dark mode' : 'Light mode';
}

setAuthTheme(document.documentElement.dataset.theme);
authModeToggle.addEventListener('click', () => {
    setAuthTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

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
