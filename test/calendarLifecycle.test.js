'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInvitationIcs } = require('../backend/lib/nodemailer');
const { hasCalendarChanges } = require('../backend/lib/calendarLifecycle');

const event = {
    room: 'planning-room',
    roomUrl: 'https://example.com/join/planning-room',
    date: '2026-08-24',
    time: '10:00',
    timezone: 'Europe/Rome',
    startAt: new Date('2026-08-24T08:00:00.000Z'),
    durationMin: 60,
    inviterName: 'Host',
    roomType: 'P2P',
    recipient: 'guest@example.com',
    calendarUid: 'stable-event@example.com',
};

test('calendar update keeps the UID and advances the sequence', () => {
    const ics = buildInvitationIcs({ ...event, calendarSequence: 3, calendarMethod: 'REQUEST' });

    assert.match(ics, /METHOD:REQUEST\r\n/);
    assert.match(ics, /UID:stable-event@example\.com\r\n/);
    assert.match(ics, /SEQUENCE:3\r\n/);
    assert.match(ics, /STATUS:CONFIRMED\r\n/);
});

test('calendar cancellation uses the same UID and CANCEL semantics', () => {
    const ics = buildInvitationIcs({ ...event, calendarSequence: 4, calendarMethod: 'CANCEL' });

    assert.match(ics, /METHOD:CANCEL\r\n/);
    assert.match(ics, /UID:stable-event@example\.com\r\n/);
    assert.match(ics, /SEQUENCE:4\r\n/);
    assert.match(ics, /STATUS:CANCELLED\r\n/);
    assert.doesNotMatch(ics, /RSVP=TRUE/);
    assert.doesNotMatch(ics, /BEGIN:VALARM/);
});

test('calendar change detection ignores metadata but catches event changes', () => {
    const current = {
        type: 'P2P',
        date: '2026-08-24',
        time: '10:00',
        timezone: 'Europe/Rome',
        startAt: new Date('2026-08-24T08:00:00.000Z'),
        duration: 60,
        room: 'planning-room',
    };

    assert.equal(hasCalendarChanges(current, { tag: 'New title' }), false);
    assert.equal(hasCalendarChanges(current, { duration: 90 }), true);
    assert.equal(hasCalendarChanges(current, { startAt: new Date('2026-08-24T08:00:00.000Z') }), false);
});
