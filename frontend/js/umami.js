'use strict';

// https://github.com/mikecao/umami

const uamami = true;

if (!uamami) {
	console.warn('Umami is disabled');
}

const script = document.createElement('script');
script.setAttribute('async', '');
script.setAttribute('src', 'https://stats.mirotalk.com/script.js');
script.setAttribute('data-website-id', 'a6a58a3f-b605-4de7-96b5-c9a073f6b0e2');
document.head.appendChild(script);
