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
