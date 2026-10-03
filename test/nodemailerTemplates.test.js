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
    const previousAdminEmail = process.env.ADMIN_EMAIL;

    process.env.SERVER_URL = 'https://meet.example.com';
    process.env.JWT_EXP = '1h';
    process.env.ADMIN_EMAIL = 'admin@example.com';
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
            if (previousAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
            else process.env.ADMIN_EMAIL = previousAdminEmail;
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
        /<h1[^>]*><span role="img" aria-label="Success"[^>]*font-size:32px[^>]*>&#10004;<\/span>Your account is ready<\/h1>/
    );
    assert.match(messages[1].html, /&#10004;/);
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

test('admin subscription templates include escaped details, UTC dates and Stripe links', async (t) => {
    const harness = loadMailer();
    t.after(harness.cleanup);
    const details = {
        eventType: 'customer.subscription.created',
        name: '<Customer>',
        email: 'customer@example.com',
        plan: 'yearly',
        status: 'incomplete',
        subscriptionId: 'sub_test',
        livemode: false,
        dashboardUrl: 'https://dashboard.stripe.com/acct_test/test/subscriptions/sub_test',
        eventAt: new Date('2026-09-20T12:00:00.000Z'),
        expiresAt: new Date('2027-09-20T12:00:00.000Z'),
    };
    await harness.mailer.sendAdminSubscriptionEmail(details);
    await harness.mailer.sendAdminSubscriptionEmail({
        ...details,
        eventType: 'customer.subscription.deleted',
        plan: 'monthly',
        status: 'canceled',
        livemode: true,
        dashboardUrl: 'https://dashboard.stripe.com/acct_test/subscriptions/sub_test',
        expiresAt: null,
    });
    const [created, ended] = harness.messages;
    for (const message of harness.messages) {
        assert.equal(message.to, 'admin@example.com');
        assert.ok(message.text);
        assert.match(message.html, /MiroTalk/);
        assert.match(message.html, /&lt;Customer&gt;/);
        assert.doesNotMatch(message.html, /<Customer>/);
        assert.match(message.html, /customer@example\.com/);
        assert.match(message.html, /UTC/);
        assert.match(message.html, />View subscription in Stripe</);
        assert.match(message.text, /Customer: <Customer>/);
    }
    assert.equal(created.subject, '[Test] MiroTalk: Annual subscription created');
    assert.match(created.html, /September 20, 2027/);
    assert.match(created.html, /incomplete/);
    assert.match(created.text, /does not confirm payment/);
    assert.match(created.html, /https:\/\/dashboard\.stripe\.com\/acct_test\/test\/subscriptions\/sub_test/);
    assert.equal(ended.subject, 'MiroTalk: Monthly subscription ended');
    assert.match(ended.html, /canceled/);
    assert.match(ended.html, /Not provided/);
    assert.match(ended.html, /https:\/\/dashboard\.stripe\.com\/acct_test\/subscriptions\/sub_test/);
    assert.doesNotMatch(ended.html, /aria-label="Success"/);
});

test('admin Annual upgrade email identifies both plans without claiming a new subscription', async (t) => {
    const harness = loadMailer();
    t.after(harness.cleanup);
    await harness.mailer.sendAdminSubscriptionEmail({
        eventType: 'customer.subscription.updated',
        name: '<Customer>',
        email: 'customer@example.com',
        plan: 'yearly',
        status: 'active',
        subscriptionId: 'sub_upgrade',
        livemode: false,
        dashboardUrl: 'https://dashboard.stripe.com/acct_test/test/subscriptions/sub_upgrade',
        eventAt: new Date('2026-10-03T06:00:00.000Z'),
        expiresAt: new Date('2027-10-03T06:00:00.000Z'),
    });
    const message = harness.messages[0];
    assert.equal(message.to, 'admin@example.com');
    assert.equal(message.subject, '[Test] MiroTalk: Annual subscription upgraded');
    assert.match(message.text, /Previous plan: Monthly/);
    assert.match(message.text, /Plan: Annual/);
    assert.match(message.text, /Upgraded at:.*UTC/);
    assert.match(message.html, /Subscription upgraded/);
    assert.match(message.html, /&lt;Customer&gt;/);
    assert.match(message.html, /prorated charges separately/);
    assert.match(message.html, /https:\/\/dashboard\.stripe\.com\/acct_test\/test\/subscriptions\/sub_upgrade/);
    assert.doesNotMatch(message.html, /New subscription created|Subscription ended|<Customer>/);
});

test('admin subscription templates reject missing recipients and unsupported events', async (t) => {
    const harness = loadMailer();
    t.after(harness.cleanup);
    assert.throws(
        () => harness.mailer.sendAdminSubscriptionEmail({ eventType: 'invoice.paid' }),
        /Unsupported admin subscription email event/
    );
    assert.throws(
        () =>
            harness.mailer.sendAdminSubscriptionEmail({
                eventType: 'customer.subscription.created',
                dashboardUrl: 'https://dashboard.stripe.com/test/subscriptions/sub_test',
            }),
        /account-scoped Stripe Dashboard URL is required/
    );
    process.env.ADMIN_EMAIL = '';
    assert.throws(
        () => harness.mailer.sendAdminSubscriptionEmail({ eventType: 'customer.subscription.created' }),
        /ADMIN_EMAIL is required/
    );
    assert.equal(harness.messages.length, 0);
});
