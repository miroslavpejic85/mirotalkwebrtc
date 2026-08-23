'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { zonedDateTimeToUtc, computeLastWeeklyOccurrence } = require('../backend/common/schedule');

test('converts an IANA-zone wall time to the correct UTC instant', () => {
    assert.equal(
        zonedDateTimeToUtc('2026-08-23', '14:30', 'Europe/Rome').toISOString(),
        '2026-08-23T12:30:00.000Z'
    );
});

test('rejects a wall time skipped by the spring DST transition', () => {
    assert.equal(zonedDateTimeToUtc('2026-03-29', '02:30', 'Europe/Rome'), null);
});

test('rejects calendar dates that JavaScript would otherwise roll over', () => {
    assert.equal(zonedDateTimeToUtc('2026-02-29', '10:00', 'UTC'), null);
    assert.equal(zonedDateTimeToUtc('2026-04-31', '10:00', 'UTC'), null);
});

test('chooses the earlier instant when fall DST repeats a wall time', () => {
    assert.equal(
        zonedDateTimeToUtc('2026-10-25', '02:30', 'Europe/Rome').toISOString(),
        '2026-10-25T00:30:00.000Z'
    );
});

test('weekly recurrence preserves local wall time across a DST change', () => {
    const occurrence = computeLastWeeklyOccurrence(
        '2026-03-22',
        '10:00',
        'Europe/Rome',
        new Date('2026-03-29T08:30:00.000Z')
    );

    assert.equal(occurrence.toISOString(), '2026-03-29T08:00:00.000Z');
});