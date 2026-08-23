'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeInvitationHistory } = require('../backend/controllers/invitations');

test('summarizes the latest delivery and attendee status for each recipient', () => {
    const jobs = [
        {
            recipient: 'alice@example.com',
            kind: 'reminder',
            status: 'sent',
            calendarUid: 'event-1',
            sentAt: new Date('2026-08-24T09:00:00Z'),
        },
        {
            recipient: 'alice@example.com',
            kind: 'update',
            status: 'sent',
            attendeeStatus: 'accepted',
            calendarUid: 'event-1',
            sentAt: new Date('2026-08-23T10:00:00Z'),
        },
        {
            recipient: 'bob@example.com',
            kind: 'invitation',
            status: 'pending',
            calendarUid: 'event-1',
            createdAt: new Date('2026-08-23T11:00:00Z'),
        },
        {
            recipient: 'other@example.com',
            kind: 'invitation',
            status: 'sent',
            calendarUid: 'other-event',
        },
    ];

    const result = summarizeInvitationHistory(jobs, 'event-1');

    assert.equal(result.attendees.length, 2);
    assert.equal(result.attendees[0].attendeeStatus, 'accepted');
    assert.equal(result.counts.accepted, 1);
    assert.equal(result.counts.invited, 1);
    assert.equal(result.counts.sent, 1);
    assert.equal(result.counts.pending, 1);
});
