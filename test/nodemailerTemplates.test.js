'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MODULE_PATH = path.resolve(__dirname, '../backend/lib/nodemailer.js');
const NODEMAILER_PATH = require.resolve('nodemailer');

function loadMailer() {
    const messages = [];
    const previousModule = require.cache[MODULE_PATH];
    const previousNodemailer = require.cache[NODEMAILER_PATH];
    const previousServerUrl = process.env.SERVER_URL;
    const previousJwtExp = process.env.JWT_EXP;

    process.env.SERVER_URL = 'https://meet.example.com';
    process.env.JWT_EXP = '1h';
    require.cache[NODEMAILER_PATH] = {
        id: NODEMAILER_PATH,
        filename: NODEMAILER_PATH,
        loaded: true,
        exports: {
            createTransport: () => ({
                async sendMail(message) {
                    messages.push(message);
                    return { messageId: `message-${messages.length}` };
                },
            }),
        },
    };
    delete require.cache[MODULE_PATH];
    const mailer = require(MODULE_PATH);

    return {
        mailer,
        messages,
        cleanup() {
            delete require.cache[MODULE_PATH];
            if (previousModule) require.cache[MODULE_PATH] = previousModule;
            if (previousNodemailer) require.cache[NODEMAILER_PATH] = previousNodemailer;
            else delete require.cache[NODEMAILER_PATH];
            if (previousServerUrl === undefined) delete process.env.SERVER_URL;
            else process.env.SERVER_URL = previousServerUrl;
            if (previousJwtExp === undefined) delete process.env.JWT_EXP;
            else process.env.JWT_EXP = previousJwtExp;
        },
    };
}

test('transactional emails use safe branded HTML and plain-text alternatives', async (t) => {
    const harness = loadMailer();
    t.after(harness.cleanup);
    const { mailer, messages } = harness;

    await mailer.sendConfirmationEmail('<Admin>', 'user@example.com', '?token=confirmation-token');
    await mailer.sendConfirmationOkEmail('<Admin>', 'user@example.com');
    await mailer.sendPasswordResetEmail('<Admin>', 'user@example.com', 'https://meet.example.com/reset');
    await mailer.sendPasswordChangeConfirmation('<Admin>', 'user@example.com');
    await mailer.sendInvitationEmail(
        '<Admin>',
        'user@example.com',
        'https://meet.example.com/password-reset?token=setup-token'
    );

    assert.equal(messages.length, 5);
    for (const message of messages) {
        assert.ok(message.text);
        assert.match(message.html, /MiroTalk/);
        assert.doesNotMatch(message.html, /<Admin>/);
        assert.doesNotMatch(message.html, /CodeCanyon|View pricing options/);
    }
    assert.match(
        messages[1].html,
        /<h1[^>]*><span role="img" aria-label="Success"[^>]*>&#10003;<\/span>Your account is ready<\/h1>/
    );
    assert.match(messages[1].html, /&#10003;/);
    assert.doesNotMatch(messages[1].html, /aria-label="Success"[^>]*(?:background|border-radius)/);
    assert.match(messages[2].html, /Reset password/);
    assert.match(messages[3].html, /Secure my account/);
    assert.match(messages[4].html, /Set my password/);
    assert.match(messages[4].text, /Username: <Admin>/);
    assert.match(messages[4].html, /<strong>Username:<\/strong> &lt;Admin&gt;/);
    assert.match(messages[4].html, /<strong>Email:<\/strong> user@example\.com/);
    assert.doesNotMatch(messages[4].html, /Password<\/td>|login credentials/i);
});

test('meeting emails provide readable details and purpose-specific actions', async (t) => {
    const harness = loadMailer();
    t.after(harness.cleanup);
    const { mailer, messages } = harness;
    const meeting = {
        to: 'guest@example.com',
        roomUrl: 'https://p2p.example.com/join/planning',
        roomType: 'P2P',
        room: '<Planning>',
        date: '2026-08-24',
        time: '10:00',
        timezone: 'Europe/Rome',
        startAt: new Date('2026-08-24T08:00:00.000Z'),
        calendarUid: 'planning@example.com',
        calendarSequence: 1,
        durationMin: 60,
        inviterName: '<Host>',
        message: '<Bring notes>',
    };

    await mailer.sendRoomInvitationEmail(meeting);
    await mailer.sendRoomInvitationEmail({ ...meeting, kind: 'reminder' });
    await mailer.sendRoomInvitationEmail({ ...meeting, kind: 'update' });
    await mailer.sendRoomInvitationEmail({ ...meeting, kind: 'cancellation' });

    assert.equal(messages.length, 4);
    for (const message of messages) {
        assert.ok(message.text);
        assert.match(message.html, /August 24, 2026/);
        assert.doesNotMatch(message.html, /<Planning>|<Host>|<Bring notes>/);
        assert.doesNotMatch(message.html, /CodeCanyon|View pricing options/);
    }
    assert.match(messages[0].subject, /^You are invited to a meeting:/);
    assert.match(messages[0].html, />View meeting</);
    assert.match(messages[1].html, />Join meeting</);
    assert.match(messages[2].html, />View updated meeting</);
    assert.match(messages[3].subject, /^Meeting canceled:/);
    assert.doesNotMatch(messages[3].html, />View meeting</);
    assert.equal(messages[3].icalEvent.method, 'CANCEL');
});

test('plan activation emails identify access without duplicating a receipt', async (t) => {
    const harness = loadMailer();
    t.after(harness.cleanup);

    await harness.mailer.sendPlanActivatedEmail(
        '<Admin>',
        'user@example.com',
        'yearly',
        new Date('2027-09-20T00:00:00.000Z')
    );
    await harness.mailer.sendPlanActivatedEmail('<Admin>', 'user@example.com', 'lifetime', null);

    assert.equal(harness.messages.length, 2);
    assert.match(harness.messages[0].subject, /Annual plan is active/);
    assert.match(harness.messages[0].html, /September 20, 2027/);
    assert.match(harness.messages[0].html, />Open dashboard</);
    assert.match(harness.messages[1].subject, /Lifetime plan is active/);
    assert.match(harness.messages[1].html, /no recurring charges/i);
    assert.doesNotMatch(harness.messages[0].html, /amount|receipt number|charged/i);
    assert.doesNotMatch(harness.messages[0].html, /<Admin>/);
});
