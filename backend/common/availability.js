'use strict';

const { getZonedParts, normalizeTimezone, zonedDateTimeToUtc } = require('./schedule');

const SLOT_INTERVAL_MINUTES = 5;

function pad(value) {
    return String(value).padStart(2, '0');
}

function dateKey(parts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function addCalendarDays(date, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;
    const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function minutesToTime(minutes) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return null;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function timeToMinutes(time) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(time || ''));
    if (!match) return null;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    return Number(match[1]) < 24 && Number(match[2]) < 60 ? minutes : null;
}

function buildOccupiedStarts(startAt, durationMinutes, bufferBeforeMinutes = 0, bufferAfterMinutes = 0) {
    const first = startAt.getTime() - bufferBeforeMinutes * 60000;
    const end = startAt.getTime() + (durationMinutes + bufferAfterMinutes) * 60000;
    const occupied = [];
    for (let value = first; value < end; value += SLOT_INTERVAL_MINUTES * 60000) {
        occupied.push(new Date(value));
    }
    return occupied;
}

function generateAvailableSlots(profile, rangeStart, rangeEnd, existingBookings = [], now = new Date()) {
    const timezone = normalizeTimezone(profile.timezone);
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    if (!timezone || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return [];

    const duration = Number(profile.durationMinutes);
    const minimumNotice = Math.max(0, Number(profile.minimumNoticeMinutes) || 0);
    const bookingWindow = Math.max(1, Number(profile.bookingWindowDays) || 60);
    const earliest = Math.max(start.getTime(), now.getTime() + minimumNotice * 60000);
    const latest = Math.min(end.getTime(), now.getTime() + bookingWindow * 86400000);
    const busy = existingBookings.map((booking) => ({
        start: new Date(booking.occupiedStartAt || booking.startAt).getTime(),
        end: new Date(booking.occupiedEndAt || booking.endAt).getTime(),
    }));
    const overrides = new Map((profile.dateOverrides || []).map((override) => [override.date, override]));
    const weekly = new Map((profile.weeklyHours || []).map((day) => [Number(day.dayOfWeek), day.intervals || []]));
    const slots = [];

    let localDate = dateKey(getZonedParts(start, timezone));
    const finalLocalDate = dateKey(getZonedParts(end, timezone));
    while (localDate <= finalLocalDate) {
        const dayOfWeek = new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
        const override = overrides.get(localDate);
        const intervals = override ? (override.available ? override.intervals || [] : []) : weekly.get(dayOfWeek) || [];
        for (const interval of intervals) {
            const intervalStart = timeToMinutes(interval.start);
            const intervalEnd = timeToMinutes(interval.end);
            if (intervalStart === null || intervalEnd === null || intervalEnd <= intervalStart) continue;
            for (let minute = intervalStart; minute + duration <= intervalEnd; minute += SLOT_INTERVAL_MINUTES) {
                const startAt = zonedDateTimeToUtc(localDate, minutesToTime(minute), timezone);
                if (!startAt) continue;
                const startMs = startAt.getTime();
                const endMs = startMs + duration * 60000;
                const occupiedStartMs = startMs - (Number(profile.bufferBeforeMinutes) || 0) * 60000;
                const occupiedEndMs = endMs + (Number(profile.bufferAfterMinutes) || 0) * 60000;
                if (startMs < earliest || startMs >= latest || endMs > end.getTime()) continue;
                if (busy.some((booking) => occupiedStartMs < booking.end && occupiedEndMs > booking.start)) continue;
                slots.push(startAt);
            }
        }
        localDate = addCalendarDays(localDate, 1);
    }
    return slots;
}

module.exports = { SLOT_INTERVAL_MINUTES, buildOccupiedStarts, generateAvailableSlots };
