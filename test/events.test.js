'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../backend/config');
const { localSchedule, roomUrl, scheduleInput, textInput } = require('../backend/controllers/events');

test('event schedules preserve organizer wall time', () => {
    const schedule = scheduleInput({
        date: '2026-10-25',
        time: '09:30',
        timezone: 'Europe/Rome',
        duration: 60,
    });

    assert.equal(schedule.error, undefined);
    assert.deepEqual(localSchedule(schedule.startAt, schedule.timezone), { date: '2026-10-25', time: '09:30' });
});

test('event schedule rejects nonexistent DST wall time', () => {
    const schedule = scheduleInput({
        date: '2026-03-29',
        time: '02:30',
        timezone: 'Europe/Rome',
        duration: 60,
    });

    assert.equal(schedule.error, 'Select a valid event date, time, and timezone');
});

test('event text is validated before linked room updates', () => {
    assert.equal(textInput({ title: ' ', description: '' }).error, 'Event title is required');
    assert.equal(
        textInput({ title: 'Event', description: 'x'.repeat(4001) }).error,
        'Event description cannot exceed 4000 characters'
    );
    assert.equal(
        textInput({ title: 'Event', imageUrl: 'file:///tmp/image.jpg' }).error,
        'Enter a valid HTTP or HTTPS image URL'
    );
    assert.equal(
        textInput({ title: 'Event', imageUrl: 'https://cdn.example.com/event.jpg' }).imageUrl,
        'https://cdn.example.com/event.jpg'
    );
});

test('event room links follow meeting service configuration', () => {
    assert.equal(
        roomUrl({ type: 'P2P', room: 'team room' }),
        `${config.MiroTalk.P2P.Join}${encodeURIComponent('team room')}`
    );
    assert.equal(
        roomUrl({ type: 'SFU', room: 'team room' }),
        `${config.MiroTalk.SFU.Join}?room=${encodeURIComponent('team room')}`
    );
});
