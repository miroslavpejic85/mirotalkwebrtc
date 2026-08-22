'use strict';

(() => {
    const storageKey = 'mode';
    const themeToggleSelector = '[data-theme-toggle]';

    function getPreferredMode() {
        return (
            window.localStorage.getItem(storageKey) ||
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        );
    }

    function applyTheme(mode, persist = false) {
        const resolvedMode = mode === 'light' ? 'light' : 'dark';
        document.documentElement.dataset.theme = resolvedMode;
        if (persist) window.localStorage.setItem(storageKey, resolvedMode);
        return resolvedMode;
    }

    function updateToggle(toggle, mode) {
        const isLight = mode === 'light';
        const icon = toggle.querySelector('i');
        if (icon) icon.className = isLight ? 'uil uil-moon' : 'uil uil-sun';
        toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        toggle.title = isLight ? 'Dark mode' : 'Light mode';
    }

    function initThemeToggles() {
        const toggles = document.querySelectorAll(themeToggleSelector);
        toggles.forEach((toggle) => {
            updateToggle(toggle, document.documentElement.dataset.theme);
            toggle.addEventListener('click', () => {
                const mode = applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
                toggles.forEach((themeToggle) => updateToggle(themeToggle, mode));
            });
        });
    }

    applyTheme(getPreferredMode());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeToggles);
    } else {
        initThemeToggles();
    }
})();
