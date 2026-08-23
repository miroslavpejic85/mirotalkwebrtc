'use strict';

const bookingApiPath = '/api/v1/booking';
const bookingPathParts = window.location.pathname.split('/').filter(Boolean);
const isCancellationPage = bookingPathParts[1] === 'cancel';
const bookingIdentifier = decodeURIComponent(bookingPathParts.at(-1) || '');
let publicProfile;
let publicSlots = [];
let selectedDate;
let selectedSlot;

function showBookingError(message) {
    document.getElementById('booking-loading').hidden = true;
    document.getElementById('booking-shell').hidden = true;
    document.getElementById('booking-error-text').textContent = message;
    document.getElementById('booking-error').hidden = false;
}

function timezoneDateKey(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
    );
    return `${values.year}-${values.month}-${values.day}`;
}

function addDateKey(value, days) {
    const date = new Date(`${value}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function dateFromKey(value) {
    return new Date(`${value}T12:00:00.000Z`);
}

function fillTimezoneSelect() {
    const select = document.getElementById('guest-timezone');
    let zones;
    try {
        zones = Intl.supportedValuesOf('timeZone');
    } catch (_) {
        zones = [Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC', 'Europe/London', 'America/New_York'];
    }
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    select.innerHTML = [...new Set(zones)]
        .map((zone) => `<option value="${zone}">${zone.replaceAll('_', ' ')}</option>`)
        .join('');
    select.value = local;
    select.addEventListener('change', () => {
        selectedDate = timezoneDateKey(new Date(), select.value);
        renderDates();
        renderSlots();
    });
}

function renderDates() {
    const timezone = document.getElementById('guest-timezone').value;
    const firstDate = timezoneDateKey(new Date(), timezone);
    const rail = document.getElementById('date-rail');
    rail.innerHTML = Array.from({ length: 14 }, (_, index) => addDateKey(firstDate, index))
        .map((key) => {
            const date = dateFromKey(key);
            const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(date);
            const day = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: 'UTC' }).format(date);
            const hasSlots = publicSlots.some((slot) => timezoneDateKey(new Date(slot), timezone) === key);
            return `<button type="button" role="tab" data-date="${key}" class="date-button ${key === selectedDate ? 'active' : ''}" ${hasSlots ? '' : 'disabled'}><span>${weekday}</span><strong>${day}</strong><i></i></button>`;
        })
        .join('');
    rail.querySelectorAll('button:not(:disabled)').forEach((button) => {
        button.addEventListener('click', () => {
            selectedDate = button.dataset.date;
            renderDates();
            renderSlots();
        });
    });
}

function renderSlots() {
    const timezone = document.getElementById('guest-timezone').value;
    const slots = publicSlots.filter((slot) => timezoneDateKey(new Date(slot), timezone) === selectedDate);
    const date = dateFromKey(selectedDate);
    document.getElementById('selected-date-label').textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(date);
    document.getElementById('slot-count').textContent = `${slots.length} time${slots.length === 1 ? '' : 's'}`;
    const grid = document.getElementById('slot-grid');
    grid.innerHTML = slots.length
        ? slots
              .map(
                  (slot) =>
                      `<button type="button" data-slot="${slot}">${new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(slot))}</button>`
              )
              .join('')
        : '<div class="no-slots"><i class="uil uil-clock"></i><strong>No times available</strong><span>Choose another day or timezone.</span></div>';
    grid.querySelectorAll('button').forEach((button) =>
        button.addEventListener('click', () => selectSlot(button.dataset.slot))
    );
}

function selectSlot(slot) {
    selectedSlot = slot;
    const timezone = document.getElementById('guest-timezone').value;
    const value = new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
    }).format(new Date(slot));
    document.getElementById('selected-time-label').textContent = value;
    document.getElementById('selected-time-fact').hidden = false;
    document.getElementById('slot-step').hidden = true;
    document.getElementById('details-step').hidden = false;
    document.getElementById('guest-name').focus();
}

async function loadPublicBooking() {
    fillTimezoneSelect();
    const now = new Date();
    const rangeEnd = new Date(now.getTime() + 15 * 86400000);
    try {
        const response = await axios.get(`${bookingApiPath}/public/${encodeURIComponent(bookingIdentifier)}/slots`, {
            params: { from: now.toISOString(), to: rangeEnd.toISOString() },
        });
        publicProfile = response.data.profile;
        publicSlots = response.data.slots;
        const initials = publicProfile.displayName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
        document.getElementById('host-avatar').textContent = initials;
        document.getElementById('host-name').textContent = publicProfile.displayName;
        document.getElementById('event-title').textContent = publicProfile.title;
        document.getElementById('event-description').textContent = publicProfile.description;
        document.getElementById('event-description').hidden = !publicProfile.description;
        document.getElementById('event-duration').textContent = `${publicProfile.durationMinutes} minutes`;
        selectedDate = timezoneDateKey(
            publicSlots.length ? new Date(publicSlots[0]) : now,
            document.getElementById('guest-timezone').value
        );
        renderDates();
        renderSlots();
        document.title = `${publicProfile.title} with ${publicProfile.displayName} | MiroTalk`;
        document.getElementById('booking-loading').hidden = true;
        document.getElementById('booking-shell').hidden = false;
    } catch (error) {
        showBookingError(error.response?.data?.message || 'This booking page could not be loaded.');
    }
}

document.getElementById('back-to-slots').addEventListener('click', () => {
    document.getElementById('details-step').hidden = true;
    document.getElementById('slot-step').hidden = false;
});

document.getElementById('details-step').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('confirm-booking');
    button.disabled = true;
    button.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Reserving time';
    try {
        const response = await axios.post(`${bookingApiPath}/public/${encodeURIComponent(bookingIdentifier)}`, {
            startAt: selectedSlot,
            name: document.getElementById('guest-name').value,
            email: document.getElementById('guest-email').value,
            notes: document.getElementById('guest-notes').value,
        });
        const result = response.data;
        const timezone = document.getElementById('guest-timezone').value;
        document.getElementById('details-step').hidden = true;
        document.getElementById('confirmation-email').textContent = document.getElementById('guest-email').value;
        document.getElementById('confirmation-title').textContent = result.title;
        document.getElementById('confirmation-time').textContent = new Intl.DateTimeFormat(undefined, {
            timeZone: timezone,
            dateStyle: 'full',
            timeStyle: 'short',
        }).format(new Date(result.startAt));
        document.getElementById('join-meeting').href = result.roomUrl;
        document.getElementById('cancel-booking-link').href = result.cancelUrl;
        document.getElementById('confirmation-step').hidden = false;
    } catch (error) {
        const message = error.response?.data?.message || 'The booking could not be confirmed.';
        if (error.response?.status === 409) {
            await loadPublicBooking();
            document.getElementById('details-step').hidden = true;
            document.getElementById('slot-step').hidden = false;
        }
        window.alert(message);
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="uil uil-calendar-check"></i> Confirm booking';
    }
});

async function loadCancellation() {
    document.getElementById('booking-loading').hidden = true;
    try {
        const response = await axios.get(`${bookingApiPath}/cancel/${encodeURIComponent(bookingIdentifier)}`);
        const booking = response.data;
        const time = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(
            new Date(booking.startAt)
        );
        document.getElementById('cancellation-copy').textContent =
            booking.status === 'canceled'
                ? `This meeting scheduled for ${time} has already been canceled.`
                : `This will release the time scheduled for ${time} and notify the calendar attendee.`;
        document.getElementById('cancel-confirm').hidden = booking.status === 'canceled';
        document.getElementById('cancellation-title').textContent =
            booking.status === 'canceled' ? 'Booking canceled' : 'Cancel this meeting?';
        document.getElementById('cancellation-shell').hidden = false;
    } catch (error) {
        showBookingError(error.response?.data?.message || 'This cancellation link is invalid.');
    }
}

document.getElementById('cancel-confirm').addEventListener('click', async () => {
    const button = document.getElementById('cancel-confirm');
    button.disabled = true;
    try {
        await axios.post(`${bookingApiPath}/cancel/${encodeURIComponent(bookingIdentifier)}`);
        document.getElementById('cancellation-icon').classList.add('canceled');
        document.getElementById('cancellation-icon').innerHTML = '<i class="uil uil-check"></i>';
        document.getElementById('cancellation-title').textContent = 'Booking canceled';
        document.getElementById('cancellation-copy').textContent =
            'The time has been released and the calendar cancellation is on its way.';
        button.hidden = true;
    } catch (error) {
        window.alert(error.response?.data?.message || 'Unable to cancel this booking.');
        button.disabled = false;
    }
});

isCancellationPage ? loadCancellation() : loadPublicBooking();
