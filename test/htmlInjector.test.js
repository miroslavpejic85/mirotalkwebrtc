'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const HtmlInjector = require('../backend/middleware/htmlInjector');

test('injectHtml replaces and escapes deployment legal metadata', () => {
    const injector = Object.create(HtmlInjector.prototype);
    injector.config = {
        App: {
            Name: 'Example <Cloud>',
        },
        LEGAL: {
            policyVersion: '2026-09-18',
            operatorName: 'Example & Partners',
            contactEmail: 'privacy@example.com',
            forumUrl: 'https://forum.example.com/?topic=terms&view=all',
            governingLaw: 'the laws of Example',
        },
        ANALYTICS: {
            scriptUrl: 'https://stats.example.com/script.js',
        },
    };
    injector.injectData = injector.getInjectData();
    injector.cache = {
        legal: '{{APP_NAME}}|{{LEGAL_OPERATOR_NAME}}|{{LEGAL_FORUM_URL}}|{{ANALYTICS_ORIGIN}}|{{LEGAL_POLICY_VERSION}}',
    };
    let body;

    injector.injectHtml('legal', {
        headersSent: false,
        send(value) {
            body = value;
        },
    });

    assert.equal(
        body,
        'Example &lt;Cloud&gt;|Example &amp; Partners|https://forum.example.com/?topic=terms&amp;view=all|https://stats.example.com|2026-09-18'
    );
});

test('injectHtml replaces APP_VERSION with package version unless disabled', () => {
    const { version } = require('../package.json');
    const render = (config) => {
        const injector = Object.create(HtmlInjector.prototype);
        injector.config = config;
        injector.injectData = injector.getInjectData();
        injector.cache = { home: '<span>{{APP_VERSION}}</span>' };
        let body;
        injector.injectHtml('home', {
            headersSent: false,
            send(value) {
                body = value;
            },
        });
        return body;
    };

    assert.equal(render({}), `<span>v${version}</span>`);
    assert.equal(render({ App: { ShowVersion: true } }), `<span>v${version}</span>`);
    assert.equal(render({ App: { ShowVersion: false } }), '<span></span>');
});
