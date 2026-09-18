'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_KEY = 'legal-consent-test-key';
process.env.JWT_EXP = '1h';

const utils = require('../backend/common/utils');

test('confirmation token preserves versioned legal consent', () => {
    const acceptedAt = new Date('2026-09-18T10:00:00.000Z');
    const token = utils.tokenEncode({
        username: 'new-user',
        email: 'new@example.com',
        password: 'SecurePassword123!',
        termsAcceptedAt: acceptedAt,
        termsVersion: '2026-09-18',
        privacyPolicyVersion: '2026-09-18',
    });

    assert.deepEqual(utils.tokenDecode(token), {
        username: 'new-user',
        email: 'new@example.com',
        password: 'SecurePassword123!',
        termsAcceptedAt: acceptedAt.toISOString(),
        termsVersion: '2026-09-18',
        privacyPolicyVersion: '2026-09-18',
    });
});
