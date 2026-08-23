'use strict';

const bookingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let bookingProfile = null;
let bookingProfileLoaded = false;
let bookingCanPublish = true;

async function resolveBookingPlanAccess() {
    const saasEnabled = !!(config && config.SAAS && config.SAAS.enabled);
    if (!saasEnabled || user.role === 'admin') return true;
    try {
        const billing = await getBilling();
        return !!billing?.active;
    } catch (_) {
        return false;
    }
}

function applyBookingPlanAccess(canPublish) {
    bookingCanPublish = canPublish;
    const enabled = document.getElementById('booking-enabled');
    const notice = document.getElementById('booking-premium-notice');
    enabled.disabled = !canPublish;
    notice.hidden = canPublish;
    document.querySelector('.availability-publish').classList.toggle('is-locked', !canPublish);
}

function setBookingSelectValue(select, value, suffix) {
    const stringValue = String(value);
    if (![...select.options].some((option) => option.value === stringValue)) {
        select.add(new Option(`${stringValue}${suffix || ''}`, stringValue));
    }
    select.value = stringValue;
}

function renderBookingTimezones(selected) {
    const select = document.getElementById('booking-timezone');
    let zones = [];
    try {
        zones = Intl.supportedValuesOf('timeZone');
    } catch (_) {
        zones = ['UTC', 'America/New_York', 'Europe/London', 'Europe/Rome', 'Asia/Tokyo'];
    }
    if (!zones.includes('UTC')) zones.unshift('UTC');
    select.innerHTML = zones.map((zone) => `<option value="${zone}">${zone.replaceAll('_', ' ')}</option>`).join('');
    select.value = selected;
}

function renderWeeklyHours(hours) {
    const values = new Map((hours || []).map((day) => [Number(day.dayOfWeek), day.intervals?.[0]]));
    document.getElementById('booking-weekly-hours').innerHTML = bookingDays
        .map((name, dayOfWeek) => {
            const interval = values.get(dayOfWeek);
            return `<div class="weekly-row ${interval ? '' : 'is-unavailable'}" data-day="${dayOfWeek}">
                <label class="weekly-day"><input type="checkbox" ${interval ? 'checked' : ''} /><span>${name}</span></label>
                <div class="weekly-times" ${interval ? '' : 'hidden'}>
                    <input type="time" value="${interval?.start || '09:00'}" aria-label="${name} start" />
                    <span>to</span>
                    <input type="time" value="${interval?.end || '17:00'}" aria-label="${name} end" />
                </div>
                <span class="weekly-unavailable" ${interval ? 'hidden' : ''}>Unavailable</span>
            </div>`;
        })
        .join('');

    document.querySelectorAll('.weekly-day input').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const row = checkbox.closest('.weekly-row');
            row.classList.toggle('is-unavailable', !checkbox.checked);
            row.querySelector('.weekly-times').hidden = !checkbox.checked;
            row.querySelector('.weekly-unavailable').hidden = checkbox.checked;
        });
    });
}

function publicBookingUrl() {
    return `${window.location.origin}/book/${encodeURIComponent(document.getElementById('booking-slug').value.trim())}`;
}

function populateBookingProfile(profile) {
    bookingProfile = profile;
    document.getElementById('booking-enabled').checked = profile.enabled;
    document.getElementById('booking-display-name').value = profile.displayName || '';
    document.getElementById('booking-title').value = profile.title || '';
    document.getElementById('booking-description').value = profile.description || '';
    document.getElementById('booking-url-prefix').textContent = `${window.location.origin}/book/`;
    document.getElementById('booking-slug').value = profile.slug || '';
    renderBookingTimezones(profile.timezone);
    document.getElementById('booking-room-type').value = profile.roomType;
    setBookingSelectValue(document.getElementById('booking-duration'), profile.durationMinutes, ' minutes');
    setBookingSelectValue(document.getElementById('booking-buffer-before'), profile.bufferBeforeMinutes, ' minutes');
    setBookingSelectValue(document.getElementById('booking-buffer-after'), profile.bufferAfterMinutes, ' minutes');
    setBookingSelectValue(document.getElementById('booking-minimum-notice'), profile.minimumNoticeMinutes, ' minutes');
    setBookingSelectValue(document.getElementById('booking-window'), profile.bookingWindowDays, ' days');
    renderWeeklyHours(profile.weeklyHours);
}

function collectWeeklyHours() {
    return [...document.querySelectorAll('.weekly-row')]
        .filter((row) => row.querySelector('input[type="checkbox"]').checked)
        .map((row) => {
            const times = row.querySelectorAll('input[type="time"]');
            return {
                dayOfWeek: Number(row.dataset.day),
                intervals: [{ start: times[0].value, end: times[1].value }],
            };
        });
}

function renderBookingList(bookings) {
    const list = document.getElementById('booking-list');
    const upcoming = bookings.filter(
        (booking) => booking.status === 'confirmed' && new Date(booking.endAt) > new Date()
    );
    if (!upcoming.length) {
        list.innerHTML =
            '<div class="booking-empty"><i class="uil uil-calendar-slash"></i><strong>No upcoming bookings</strong><span>Confirmed guest meetings will appear here.</span></div>';
        return;
    }
    list.innerHTML = upcoming
        .slice(0, 20)
        .map((booking) => {
            const date = new Intl.DateTimeFormat(undefined, {
                month: 'short',
                day: 'numeric',
                weekday: 'short',
            }).format(new Date(booking.startAt));
            const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
                new Date(booking.startAt)
            );
            const initials = booking.guestName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase();
            const safeName = document.createElement('span');
            safeName.textContent = booking.guestName;
            const safeEmail = document.createElement('span');
            safeEmail.textContent = booking.guestEmail;
            return `<article class="booking-item"><div class="booking-date"><strong>${date}</strong><span>${time}</span></div><div class="booking-guest"><span class="booking-avatar">${initials}</span><div><strong>${safeName.innerHTML}</strong><span>${safeEmail.innerHTML}</span></div></div><span class="booking-confirmed">Confirmed</span></article>`;
        })
        .join('');
}

async function loadManagedBookings() {
    try {
        renderBookingList(await bookingList());
    } catch (error) {
        console.error('[API] - BOOKING LIST ERROR', error);
    }
}

window.loadBookingAvailability = async function () {
    if (bookingProfileLoaded) return loadManagedBookings();
    document.getElementById('availability-loading').hidden = false;
    try {
        populateBookingProfile(await bookingGetProfile());
        applyBookingPlanAccess(await resolveBookingPlanAccess());
        bookingProfileLoaded = true;
        document.getElementById('availability-content').hidden = false;
        await loadManagedBookings();
    } catch (error) {
        popupMessage('error', error.response?.data?.message || 'Unable to load booking availability');
    } finally {
        document.getElementById('availability-loading').hidden = true;
    }
};

document.getElementById('availability-form').addEventListener('submit', async () => {
    if (!bookingCanPublish) {
        requirePaidPlan('Public booking, automatic room creation, and email calendar invitations require a paid plan.');
        return;
    }
    const saveButton = document.getElementById('booking-save');
    const weeklyHours = collectWeeklyHours();
    if (!weeklyHours.length) return popupMessage('warning', 'Select at least one available day');
    const data = {
        enabled: document.getElementById('booking-enabled').checked,
        displayName: document.getElementById('booking-display-name').value,
        title: document.getElementById('booking-title').value,
        description: document.getElementById('booking-description').value,
        slug: document.getElementById('booking-slug').value,
        timezone: document.getElementById('booking-timezone').value,
        roomType: document.getElementById('booking-room-type').value,
        durationMinutes: Number(document.getElementById('booking-duration').value),
        bufferBeforeMinutes: Number(document.getElementById('booking-buffer-before').value),
        bufferAfterMinutes: Number(document.getElementById('booking-buffer-after').value),
        minimumNoticeMinutes: Number(document.getElementById('booking-minimum-notice').value),
        bookingWindowDays: Number(document.getElementById('booking-window').value),
        weeklyHours,
    };
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="uil uil-spinner-alt booking-spin"></i> Saving';
    try {
        populateBookingProfile(await bookingUpdateProfile(data));
        popupMessage('toast', 'Availability saved');
    } catch (error) {
        popupMessage('error', error.response?.data?.message || 'Unable to save availability');
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="uil uil-check"></i> Save availability';
    }
});

document.getElementById('booking-preview').addEventListener('click', () => {
    if (!bookingCanPublish) {
        requirePaidPlan('Publishing and previewing a public booking page requires a paid plan.');
        return;
    }
    const enabled = document.getElementById('booking-enabled').checked;
    const slug = document.getElementById('booking-slug').value.trim();
    if (!enabled) {
        popupMessage('warning', 'Enable Accept bookings and save availability before opening the public page');
        return;
    }
    if (!bookingProfile?.enabled || slug !== bookingProfile.slug) {
        popupMessage('warning', 'Save your availability changes before opening the public page');
        return;
    }
    window.open(publicBookingUrl(), '_blank');
});
document.getElementById('booking-view-plans').addEventListener('click', () => openURL('/pricing'));
document.getElementById('booking-refresh').addEventListener('click', loadManagedBookings);
