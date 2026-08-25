'use strict';

let publicEvent;

function showEventError(message) {
    document.getElementById('event-loading').hidden = true;
    document.getElementById('event-shell').hidden = true;
    document.getElementById('event-error-text').textContent = message;
    document.getElementById('event-error').hidden = false;
}

function escapeCalendarText(value) {
    return String(value || '')
        .replaceAll('\\', '\\\\')
        .replaceAll('\n', '\\n')
        .replaceAll(',', '\\,')
        .replaceAll(';', '\\;');
}

function calendarTimestamp(date) {
    return new Date(date)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
}

function downloadCalendarEvent() {
    const endAt = new Date(new Date(publicEvent.startAt).getTime() + publicEvent.duration * 60000);
    const calendar = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MiroTalk//Events//EN',
        'BEGIN:VEVENT',
        `UID:${publicEvent.slug}@mirotalk`,
        `DTSTAMP:${calendarTimestamp(new Date())}`,
        `DTSTART:${calendarTimestamp(publicEvent.startAt)}`,
        `DTEND:${calendarTimestamp(endAt)}`,
        `SUMMARY:${escapeCalendarText(publicEvent.title)}`,
        `DESCRIPTION:${escapeCalendarText(`${publicEvent.description || ''}\nJoin: ${publicEvent.roomUrl}`)}`,
        `LOCATION:${escapeCalendarText(publicEvent.roomUrl)}`,
        `URL:${escapeCalendarText(window.location.href)}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${publicEvent.slug}.ics`;
    link.click();
    URL.revokeObjectURL(url);
}

async function loadPublicEvent() {
    const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) || '');
    try {
        publicEvent = (await axios.get(`/api/v1/events/public/${encodeURIComponent(slug)}`)).data;
        const organizer = publicEvent.organizer || 'MiroTalk host';
        const initials = organizer
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
        const start = new Date(publicEvent.startAt);
        document.getElementById('event-avatar').textContent = initials;
        document.getElementById('event-organizer').textContent = `Hosted by ${organizer}`;
        document.getElementById('event-title').textContent = publicEvent.title;
        document.getElementById('event-description').textContent = publicEvent.description;
        document.getElementById('event-description').hidden = !publicEvent.description;
        if (publicEvent.imageUrl) {
            const media = document.getElementById('event-media');
            const image = document.getElementById('event-image');
            image.alt = `${publicEvent.title} event image`;
            image.addEventListener('load', () => (media.hidden = false), { once: true });
            image.addEventListener('error', () => (media.hidden = true), { once: true });
            image.src = publicEvent.imageUrl;
        }
        document.getElementById('event-date').textContent = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        }).format(start);
        document.getElementById('event-time').textContent = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(start);
        document.getElementById('event-duration').textContent = `${publicEvent.duration} minutes`;
        document.getElementById('event-timezone').textContent =
            `Organizer timezone: ${publicEvent.timezone.replaceAll('_', ' ')}`;
        document.getElementById('event-service').textContent = `${publicEvent.roomType} video room`;
        document.getElementById('event-join').href = publicEvent.roomUrl;
        document.title = `${publicEvent.title} | MiroTalk`;
        document.getElementById('event-loading').hidden = true;
        document.getElementById('event-shell').hidden = false;
    } catch (error) {
        showEventError(error.response?.data?.message || 'This event could not be loaded.');
    }
}

document.getElementById('event-calendar').addEventListener('click', downloadCalendarEvent);
document.getElementById('event-share').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        document.getElementById('event-copy-status').textContent = 'Event link copied';
    } catch (_) {
        document.getElementById('event-copy-status').textContent = 'Copy the URL from your browser to share this event';
    }
});

loadPublicEvent();
