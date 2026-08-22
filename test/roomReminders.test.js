'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeReminderAt } = require('../backend/lib/roomReminders');
const { summarizeReminderJobs } = require('../backend/lib/emailQueue');

test('computeReminderAt subtracts the selected offset from the local meeting time', () => {
    const reminderAt = computeReminderAt('2026-08-22', '14:30', 60);

    assert.equal(reminderAt.toISOString(), '2026-08-22T13:30:00.000Z');
});

test('computeReminderAt supports reminders on the previous day', () => {
    const reminderAt = computeReminderAt('2026-08-22', '09:00', 1440);

    assert.equal(reminderAt.toISOString(), '2026-08-21T09:00:00.000Z');
});

test('computeReminderAt converts browser-local meeting time to UTC', () => {
    const reminderAt = computeReminderAt('2026-08-21', '21:10', 10, -120);

    assert.equal(reminderAt.toISOString(), '2026-08-21T19:00:00.000Z');
});

test('computeReminderAt accepts an omitted timezone offset for older clients', () => {
    const reminderAt = computeReminderAt('2026-08-21', '21:30', 10);

    assert.equal(reminderAt.toISOString(), '2026-08-21T21:20:00.000Z');
});

test('computeReminderAt accepts custom reminder offsets', () => {
    const reminderAt = computeReminderAt('2026-08-22', '10:00', 90);

    assert.equal(reminderAt.toISOString(), '2026-08-22T08:30:00.000Z');
});

test('computeReminderAt rejects invalid schedules and offsets', () => {
    assert.equal(computeReminderAt('', '09:00', 60), null);
    assert.equal(computeReminderAt('2026-08-22', 'invalid', 60), null);
    assert.equal(computeReminderAt('2026-08-22', '09:00', 0), null);
    assert.equal(computeReminderAt('2026-08-22', '09:00', 10081), null);
});

test('summarizeReminderJobs reports retries and completed delivery', () => {
    assert.deepEqual(summarizeReminderJobs([{ status: 'pending', attempts: 1, lastError: 'SMTP unavailable' }]), {
        status: 'retrying',
        attempts: 1,
        lastError: 'SMTP unavailable',
    });

    const sentAt = new Date('2026-08-22T08:00:00.000Z');
    assert.deepEqual(summarizeReminderJobs([{ status: 'sent', attempts: 1, sentAt }]), {
        status: 'sent',
        attempts: 1,
        sentAt,
        lastError: null,
    });
});
