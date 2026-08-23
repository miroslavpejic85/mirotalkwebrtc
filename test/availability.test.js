'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOccupiedStarts, generateAvailableSlots } = require('../backend/common/availability');

function profile(overrides = {}) {
    return {
        timezone: 'Europe/Rome',
        durationMinutes: 30,
        minimumNoticeMinutes: 0,
        bookingWindowDays: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        weeklyHours: [{ dayOfWeek: 0, intervals: [{ start: '09:00', end: '11:00' }] }],
        dateOverrides: [],
        ...overrides,
    };
}

test('availability preserves organizer wall time across spring DST', () => {
    const slots = generateAvailableSlots(
        profile(),
        new Date('2026-03-29T00:00:00.000Z'),
        new Date('2026-03-30T00:00:00.000Z'),
        [],
        new Date('2026-03-01T00:00:00.000Z')
    );

    assert.equal(slots[0].toISOString(), '2026-03-29T07:00:00.000Z');
    assert.equal(slots.at(-1).toISOString(), '2026-03-29T08:30:00.000Z');
});

test('availability removes slots that overlap an existing booking and buffers', () => {
    const slots = generateAvailableSlots(
        profile({ bufferBeforeMinutes: 10, bufferAfterMinutes: 10 }),
        new Date('2026-03-29T00:00:00.000Z'),
        new Date('2026-03-30T00:00:00.000Z'),
        [
            {
                occupiedStartAt: new Date('2026-03-29T07:50:00.000Z'),
                occupiedEndAt: new Date('2026-03-29T08:40:00.000Z'),
            },
        ],
        new Date('2026-03-01T00:00:00.000Z')
    );

    assert.deepEqual(
        slots.map((slot) => slot.toISOString()),
        ['2026-03-29T07:00:00.000Z', '2026-03-29T07:05:00.000Z', '2026-03-29T07:10:00.000Z']
    );
});

test('occupied instants include meeting buffers at five-minute resolution', () => {
    const occupied = buildOccupiedStarts(new Date('2026-08-23T12:00:00.000Z'), 30, 10, 5);
    assert.equal(occupied.length, 9);
    assert.equal(occupied[0].toISOString(), '2026-08-23T11:50:00.000Z');
    assert.equal(occupied.at(-1).toISOString(), '2026-08-23T12:30:00.000Z');
});
