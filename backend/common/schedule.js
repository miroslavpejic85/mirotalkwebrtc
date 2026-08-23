'use strict';

const formatterCache = new Map();

function getFormatter(timezone) {
    if (!formatterCache.has(timezone)) {
        formatterCache.set(
            timezone,
            new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23',
            })
        );
    }
    return formatterCache.get(timezone);
}

function normalizeTimezone(timezone) {
    if (typeof timezone !== 'string' || !timezone.trim()) return null;
    const value = timezone.trim().slice(0, 100);
    try {
        getFormatter(value).format(new Date(0));
        return value;
    } catch (_) {
        return null;
    }
}

function parseWallClock(date, time) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(time || '').trim());
    if (!dateMatch || !timeMatch) return null;

    const parts = {
        year: Number(dateMatch[1]),
        month: Number(dateMatch[2]),
        day: Number(dateMatch[3]),
        hour: Number(timeMatch[1]),
        minute: Number(timeMatch[2]),
        second: 0,
    };
    const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
    if (
        check.getUTCFullYear() !== parts.year ||
        check.getUTCMonth() + 1 !== parts.month ||
        check.getUTCDate() !== parts.day ||
        check.getUTCHours() !== parts.hour ||
        check.getUTCMinutes() !== parts.minute
    ) {
        return null;
    }
    return parts;
}

function getZonedParts(instant, timezone) {
    const values = {};
    for (const part of getFormatter(timezone).formatToParts(instant)) {
        if (part.type !== 'literal') values[part.type] = Number(part.value);
    }
    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
        second: values.second,
    };
}

function partsEqual(left, right) {
    return (
        left.year === right.year &&
        left.month === right.month &&
        left.day === right.day &&
        left.hour === right.hour &&
        left.minute === right.minute
    );
}

function offsetAt(instant, timezone) {
    const parts = getZonedParts(instant, timezone);
    const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function zonedDateTimeToUtc(date, time, timezone) {
    const wall = parseWallClock(date, time);
    const zone = normalizeTimezone(timezone);
    if (!wall || !zone) return null;

    const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
    const offsets = new Set();
    for (const delta of [-36, 0, 36]) {
        offsets.add(offsetAt(new Date(wallAsUtc + delta * 60 * 60 * 1000), zone));
    }

    const matches = [];
    for (const offset of offsets) {
        const candidate = new Date(wallAsUtc - offset);
        if (partsEqual(getZonedParts(candidate, zone), wall)) matches.push(candidate);
    }
    if (matches.length === 0) return null;

    matches.sort((left, right) => left.getTime() - right.getTime());
    return matches[0];
}

function addDays(date, days) {
    const parts = parseWallClock(date, '00:00');
    if (!parts) return null;
    const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    const pad = (value) => String(value).padStart(2, '0');
    return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
}

function computeLastWeeklyOccurrence(date, time, timezone, now = new Date()) {
    const zone = normalizeTimezone(timezone);
    const base = zonedDateTimeToUtc(date, time, zone);
    if (!base || now.getTime() < base.getTime()) return null;

    const baseWall = parseWallClock(date, time);
    const nowWall = getZonedParts(now, zone);
    const baseDay = Date.UTC(baseWall.year, baseWall.month - 1, baseWall.day);
    const nowDay = Date.UTC(nowWall.year, nowWall.month - 1, nowWall.day);
    let weeks = Math.floor((nowDay - baseDay) / (7 * 24 * 60 * 60 * 1000));
    let occurrence = zonedDateTimeToUtc(addDays(date, weeks * 7), time, zone);

    while (weeks > 0 && (!occurrence || occurrence.getTime() > now.getTime())) {
        weeks--;
        occurrence = zonedDateTimeToUtc(addDays(date, weeks * 7), time, zone);
    }
    return occurrence && occurrence.getTime() <= now.getTime() ? occurrence : null;
}

module.exports = {
    normalizeTimezone,
    parseWallClock,
    getZonedParts,
    zonedDateTimeToUtc,
    computeLastWeeklyOccurrence,
};
