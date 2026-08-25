'use strict';

let managedEvents = [];
let eventsLoaded = false;
let eventsCanManage = true;

async function resolveEventPlanAccess() {
    const saasEnabled = !!(config && config.SAAS && config.SAAS.enabled);
    if (!saasEnabled || user.role === 'admin') return true;
    try {
        const billing = await getBilling();
        return !!billing?.active;
    } catch (_) {
        return false;
    }
}

function applyEventPlanAccess(canManage) {
    eventsCanManage = canManage;
    document.getElementById('events-premium-notice').hidden = canManage;
    document.getElementById('event-form').classList.toggle('is-locked', !canManage);
    document
        .querySelectorAll('#event-form input, #event-form textarea, #event-form select, #event-form button')
        .forEach((control) => {
            control.disabled = !canManage;
        });
}

function requireEventPlan() {
    if (eventsCanManage) return true;
    requirePaidPlan('Creating and managing shareable events requires an active paid plan.');
    return false;
}

function eventPublicUrl(event) {
    return `${window.location.origin}/event/${encodeURIComponent(event.slug)}`;
}

function renderEventTimezones(selected) {
    const select = document.getElementById('event-timezone');
    let zones;
    try {
        zones = Intl.supportedValuesOf('timeZone');
    } catch (_) {
        zones = ['UTC', 'America/New_York', 'Europe/London', 'Europe/Rome', 'Asia/Tokyo'];
    }
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (!zones.includes('UTC')) zones.unshift('UTC');
    select.innerHTML = zones.map((zone) => `<option value="${zone}">${zone.replaceAll('_', ' ')}</option>`).join('');
    select.value = selected || local;
}

function initEventFlatpickr() {
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const onReady = getFlatpickrOnReady();
    if (!dateInput._flatpickr) {
        flatpickr(dateInput, {
            dateFormat: 'Y-m-d',
            minDate: 'today',
            allowInput: true,
            disableMobile: true,
            onReady,
        });
    }
    if (!timeInput._flatpickr) {
        flatpickr(timeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: 'H:i',
            time_24hr: true,
            minuteIncrement: 5,
            allowInput: true,
            disableMobile: true,
            onReady,
        });
    }
}

function resetEventForm() {
    document.getElementById('event-form').reset();
    document.getElementById('event-id').value = '';
    document.getElementById('event-form-title').textContent = 'Create event';
    document.getElementById('event-save').innerHTML = '<i class="uil uil-check"></i> Create event';
    document.getElementById('event-cancel').hidden = true;
    document.getElementById('event-published').checked = true;
    document.getElementById('event-duration').value = '60';
    document.getElementById('event-room-type').value = 'SFU';
    document.getElementById('event-date')._flatpickr?.setDate(new Date().toISOString().slice(0, 10), false);
    document.getElementById('event-time')._flatpickr?.setDate(currentTimeHHmmRoundedTo5(), false);
    renderEventTimezones();
}

function eventLocalParts(event) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: event.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(event.startAt));
    const values = Object.fromEntries(
        parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
    );
    return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function editEvent(event) {
    if (!requireEventPlan()) return;
    const local = eventLocalParts(event);
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-name').value = event.title;
    document.getElementById('event-description').value = event.description || '';
    document.getElementById('event-image-url').value = event.imageUrl || '';
    document.getElementById('event-date')._flatpickr.setDate(local.date, false);
    document.getElementById('event-time')._flatpickr.setDate(local.time, false);
    renderEventTimezones(event.timezone);
    document.getElementById('event-duration').value = String(event.duration);
    document.getElementById('event-room-type').value = event.roomType;
    document.getElementById('event-published').checked = event.published;
    document.getElementById('event-form-title').textContent = 'Edit event';
    document.getElementById('event-save').innerHTML = '<i class="uil uil-check"></i> Save changes';
    document.getElementById('event-cancel').hidden = false;
    document.getElementById('event-name').focus();
}

function renderEvents() {
    const list = document.getElementById('events-list');
    if (!managedEvents.length) {
        list.innerHTML =
            '<div class="booking-empty"><i class="uil uil-calendar-slash"></i><strong>No events yet</strong><span>Create an event to get a public share link.</span></div>';
        return;
    }
    list.innerHTML = managedEvents
        .map((event) => {
            const when = new Intl.DateTimeFormat(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }).format(new Date(event.startAt));
            const publicActions = event.published
                ? `<button type="button" data-action="share" title="Copy public link" aria-label="Copy public link"><i class="uil uil-link"></i></button>
                    <button type="button" data-action="open" title="Open public page" aria-label="Open public page"><i class="uil uil-external-link-alt"></i></button>`
                : '';
            return `<article class="event-item" data-event-id="${escapeHtml(event.id)}">
                <div class="event-item-top"><span class="event-service">${escapeHtml(event.roomType)}</span><span class="event-status ${event.published ? '' : 'is-draft'}">${event.published ? 'Public' : 'Draft'}</span></div>
                <h3>${escapeHtml(event.title)}</h3>
                <p><i class="uil uil-calendar-alt"></i> ${escapeHtml(when)} · ${event.duration} min</p>
                <div class="event-item-actions">
                    ${publicActions}
                    <button type="button" class="action-icon action-primary" data-action="join" title="Join meeting" aria-label="Join meeting"><i class="uil uil-video"></i><span class="action-label">Join</span></button>
                    <button type="button" data-action="edit" title="Edit event" aria-label="Edit event"><i class="uil uil-pen"></i></button>
                    <button type="button" class="action-icon danger" data-action="delete" title="Delete event" aria-label="Delete event"><i class="uil uil-trash-alt"></i></button>
                </div>
            </article>`;
        })
        .join('');
}

async function refreshEvents() {
    document.getElementById('events-loading').hidden = false;
    try {
        managedEvents = await eventList();
        renderEvents();
    } catch (error) {
        popupMessage('error', error.response?.data?.message || 'Unable to load events');
    } finally {
        document.getElementById('events-loading').hidden = true;
    }
}

window.loadEvents = async function () {
    if (!eventsLoaded) {
        initEventFlatpickr();
        resetEventForm();
        applyEventPlanAccess(await resolveEventPlanAccess());
        eventsLoaded = true;
    }
    await refreshEvents();
};

document.getElementById('event-form').addEventListener('submit', async () => {
    if (!requireEventPlan()) return;
    const id = document.getElementById('event-id').value;
    const button = document.getElementById('event-save');
    const data = {
        title: document.getElementById('event-name').value,
        description: document.getElementById('event-description').value,
        imageUrl: document.getElementById('event-image-url').value,
        date: document.getElementById('event-date').value,
        time: document.getElementById('event-time').value,
        timezone: document.getElementById('event-timezone').value,
        duration: Number(document.getElementById('event-duration').value),
        roomType: document.getElementById('event-room-type').value,
        published: document.getElementById('event-published').checked,
    };
    button.disabled = true;
    try {
        id ? await eventUpdate(id, data) : await eventCreate(data);
        popupMessage('toast', id ? 'Event updated' : 'Event created');
        resetEventForm();
        await refreshEvents();
    } catch (error) {
        popupMessage('error', error.response?.data?.message || 'Unable to save event');
    } finally {
        button.disabled = false;
    }
});

document.getElementById('events-list').addEventListener('click', async (clickEvent) => {
    const button = clickEvent.target.closest('button[data-action]');
    if (!button) return;
    const event = managedEvents.find((item) => item.id === button.closest('[data-event-id]').dataset.eventId);
    if (!event) return;
    if (button.dataset.action === 'edit') return editEvent(event);
    if (button.dataset.action === 'open') return window.open(eventPublicUrl(event), '_blank', 'noopener');
    if (button.dataset.action === 'join') return window.open(event.roomUrl, '_blank', 'noopener');
    if (button.dataset.action === 'share') {
        await navigator.clipboard.writeText(eventPublicUrl(event));
        return popupMessage('toast', 'Event link copied');
    }
    if (!requireEventPlan()) return;
    const result = await Swal.fire({
        position: 'top',
        title: 'Delete event?',
        text: 'The public page and linked meeting room will be removed.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    await eventDelete(event.id);
    if (document.getElementById('event-id').value === event.id) resetEventForm();
    await refreshEvents();
});

document.getElementById('event-new').addEventListener('click', () => {
    if (!requireEventPlan()) return;
    resetEventForm();
    document.getElementById('event-name').focus();
});
document.getElementById('event-cancel').addEventListener('click', resetEventForm);
document.getElementById('event-refresh').addEventListener('click', refreshEvents);
document.getElementById('events-view-plans').addEventListener('click', () => openURL('/pricing'));
