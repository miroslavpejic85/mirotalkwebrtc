'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const DEMO_PATH = path.resolve(__dirname, '../backend/middleware/demo.js');
const UTILS_PATH = path.resolve(__dirname, '../backend/common/utils.js');

function loadDemo() {
    const previousUtils = require.cache[UTILS_PATH];
    require.cache[UTILS_PATH] = {
        id: UTILS_PATH,
        filename: UTILS_PATH,
        loaded: true,
        exports: {
            isDemo: (email) => email === 'demo@example.com',
        },
    };

    delete require.cache[DEMO_PATH];
    const demo = require(DEMO_PATH);

    return {
        demo,
        cleanup() {
            delete require.cache[DEMO_PATH];
            if (previousUtils) require.cache[UTILS_PATH] = previousUtils;
            else delete require.cache[UTILS_PATH];
        },
    };
}

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('authenticated regular user can continue to checkout', async (t) => {
    const harness = loadDemo();
    t.after(harness.cleanup);
    let nextCalled = false;

    await harness.demo({ user: { email: 'user@example.com' } }, createResponse(), () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
});

test('authenticated demo user is blocked from checkout', async (t) => {
    const harness = loadDemo();
    t.after(harness.cleanup);
    const res = createResponse();

    await harness.demo({ user: { email: 'demo@example.com' } }, res, () => assert.fail('next must not be called'));

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'DEMO_ACCOUNT');
    assert.match(res.body.message, /demo accounts/);
});
