'use strict';

const crypto = require('crypto');

function calendarUidHost() {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || '';
    return from.includes('@') ? from.split('@').pop() : 'mirotalk.local';
}

function icsUtcStamp(date) {
    return new Date(date)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
}

function createCalendarUid() {
    return `${crypto.randomUUID()}@${calendarUidHost()}`;
}

function buildLegacyCalendarUid(room, startAt, date, time) {
    const instant = startAt ? new Date(startAt) : null;
    const hasInstant = instant && !Number.isNaN(instant.getTime());
    const localStamp = `${String(date || '').replace(/-/g, '')}T${String(time || '').replace(':', '')}00`;
    const stamp = hasInstant ? icsUtcStamp(instant) : localStamp;
    const uidBase = `${room || 'mirotalk'}-${stamp}`.replace(/[^A-Za-z0-9._-]/g, '-');
    return `${uidBase}@${calendarUidHost()}`;
}

module.exports = { createCalendarUid, buildLegacyCalendarUid, icsUtcStamp };
