'use strict';

// https://github.com/mikecao/umami

const umami = true;

if (!umami) {
    console.warn('Umami is disabled');
    return;
}

const script = document.createElement('script');
script.setAttribute('async', '');
script.setAttribute('src', 'https://stats.mirotalk.com/script.js');
script.setAttribute('data-website-id', 'fbaf621d-b2da-4b33-a2f2-43f8f0037663');
document.head.appendChild(script);
