'use strict';

const logs = require('../common/logs');
const nodemailer = require('nodemailer');
const { buildLegacyCalendarUid, icsUtcStamp } = require('../common/calendar');
const config = require('../config');

const log = new logs('NodeMailer');

const SERVER_URL = process.env.SERVER_URL;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USERNAME;
const EMAIL_VERIFICATION = process.env.EMAIL_VERIFICATION === 'true' || false;
const CONFIRMATION_LINK_EXPIRY = process.env.JWT_EXP || 'the configured security period';
const SUPPORT =
    'https://codecanyon.net/item/mirotalk-webrtc-ultimate-bundle-for-seamless-live-smart-communication/47976343'; // Thank you!

log.info('Email', {
    verification: EMAIL_VERIFICATION,
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    username: EMAIL_USERNAME,
    from: EMAIL_FROM,
});

// HTML-escape user-controlled values before interpolating into email markup.
// Escapes the 5 chars relevant for both element and attribute contexts.
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Encode a URL for safe use inside an HTML attribute (`href`).
// Strips any javascript: / data: / vbscript: schemes that could execute on click,
// then HTML-escapes the result for attribute context.
function safeUrlAttr(value) {
    const raw = String(value == null ? '' : value).trim();
    if (/^\s*(javascript|data|vbscript):/i.test(raw)) return '#';
    return escapeHtml(raw);
}

// Default meeting duration when the room record doesn't carry one (minutes).
const ICS_DEFAULT_DURATION_MIN = Number(process.env.EMAIL_INVITATION_ICS_DURATION_MIN) || 60;

// Human-readable duration string for the email body (e.g. "45 minutes", "1 hour 30 minutes").
function formatDurationLabel(minutes) {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return '';
    const hours = Math.floor(m / 60);
    const mins = Math.round(m % 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    if (mins > 0) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
    return parts.join(' ') || `${m} minutes`;
}

function formatMeetingSchedule(startAt, date, time, timezone) {
    const instant = startAt ? new Date(startAt) : null;
    if (instant && !Number.isNaN(instant.getTime()) && typeof timezone === 'string' && timezone) {
        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
                timeZone: timezone,
            }).format(instant);
        } catch (error) {
            log.warn('Unable to format meeting timezone', { timezone, error: error.message });
        }
    }

    const localSchedule = [date, time].filter(Boolean).join(' at ');
    return timezone && localSchedule ? `${localSchedule} (${timezone})` : localSchedule;
}

// Escape a text value for inclusion in an iCalendar TEXT property per RFC 5545 §3.3.11.
function icsEscapeText(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
}

// Fold a single iCalendar content line to <=75 octets per RFC 5545 §3.1 (line folding).
// Continuation lines start with a single space.
function icsFoldLine(line) {
    if (Buffer.byteLength(line, 'utf8') <= 75) return line;
    const out = [];
    let buf = '';
    let bufBytes = 0;
    for (const ch of line) {
        const chBytes = Buffer.byteLength(ch, 'utf8');
        const limit = out.length === 0 ? 75 : 74; // continuation lines reserve 1 byte for the leading space
        if (bufBytes + chBytes > limit) {
            out.push(buf);
            buf = ch;
            bufBytes = chBytes;
        } else {
            buf += ch;
            bufBytes += chBytes;
        }
    }
    if (buf) out.push(buf);
    return out.map((seg, i) => (i === 0 ? seg : ' ' + seg)).join('\r\n');
}

/**
 * Build a minimal VCALENDAR (METHOD:REQUEST) for a room invitation.
 *
 * New jobs carry the authoritative UTC start instant. The floating local-time
 * fallback is retained only for invitations queued before timezone support.
 */
function buildInvitationIcs({
    room,
    roomUrl,
    date,
    time,
    timezone,
    startAt,
    calendarUid,
    calendarSequence = 0,
    calendarMethod = 'REQUEST',
    durationMin,
    inviterName,
    message,
    roomType,
    recipient,
}) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(time || '').trim());
    if (!dateMatch || !timeMatch) return null;

    const [, y, mo, d] = dateMatch;
    const [, h, mi] = timeMatch;

    const persistedStart = startAt ? new Date(startAt) : null;
    const hasPersistedStart = persistedStart && !Number.isNaN(persistedStart.getTime());
    const dtStart = hasPersistedStart ? icsUtcStamp(persistedStart) : `${y}${mo}${d}T${h}${mi}00`;

    // Per-room duration (minutes) takes precedence over the env default.
    // Clamp to the same 5..1440 bounds the schema enforces to defend against bad inputs.
    const requestedDuration = Number(durationMin);
    const effectiveDuration =
        Number.isFinite(requestedDuration) && requestedDuration >= 5 && requestedDuration <= 1440
            ? Math.round(requestedDuration)
            : ICS_DEFAULT_DURATION_MIN;

    // Compute DTEND by adding the effective duration to the local wall-clock value.
    // Using Date.UTC keeps the math TZ-free; we then strip the Z to keep it floating.
    const endMs = hasPersistedStart
        ? persistedStart.getTime() + effectiveDuration * 60 * 1000
        : Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0) + effectiveDuration * 60 * 1000;
    const endDate = new Date(endMs);
    const pad = (n) => String(n).padStart(2, '0');
    const dtEnd = hasPersistedStart
        ? icsUtcStamp(endDate)
        : endDate.getUTCFullYear() +
          pad(endDate.getUTCMonth() + 1) +
          pad(endDate.getUTCDate()) +
          'T' +
          pad(endDate.getUTCHours()) +
          pad(endDate.getUTCMinutes()) +
          '00';

    const dtStamp = icsUtcStamp(new Date());

    const uid = calendarUid || buildLegacyCalendarUid(room, persistedStart, date, time);
    const sequence = Number.isInteger(Number(calendarSequence)) ? Math.max(0, Number(calendarSequence)) : 0;
    const method = String(calendarMethod).toUpperCase() === 'CANCEL' ? 'CANCEL' : 'REQUEST';
    const isCancellation = method === 'CANCEL';

    const summary = `MiroTalk ${roomType || ''} meeting: ${room || ''}`.trim();
    const descriptionParts = [];
    if (inviterName) descriptionParts.push(`Invited by: ${inviterName}`);
    if (message) descriptionParts.push(String(message));
    descriptionParts.push(`Join: ${roomUrl}`);
    const description = descriptionParts.join('\n');

    const organizerLine = EMAIL_FROM
        ? `ORGANIZER;CN=${icsEscapeText(inviterName || 'MiroTalk')}:mailto:${EMAIL_FROM}`
        : null;
    const attendeeLine = recipient
        ? isCancellation
            ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT:mailto:${recipient}`
            : `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${recipient}`
        : null;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MiroTalk//Invitation//EN',
        'CALSCALE:GREGORIAN',
        `METHOD:${method}`,
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `SEQUENCE:${sequence}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${icsEscapeText(summary)}`,
        `DESCRIPTION:${icsEscapeText(description)}`,
        `LOCATION:${icsEscapeText(roomUrl || '')}`,
        roomUrl ? `URL:${icsEscapeText(roomUrl)}` : null,
        organizerLine,
        attendeeLine,
        `STATUS:${isCancellation ? 'CANCELLED' : 'CONFIRMED'}`,
        'TRANSP:OPAQUE',
        !isCancellation ? 'BEGIN:VALARM' : null,
        !isCancellation ? 'ACTION:DISPLAY' : null,
        !isCancellation ? `DESCRIPTION:${icsEscapeText(summary)}` : null,
        !isCancellation ? 'TRIGGER:-PT15M' : null,
        !isCancellation ? 'END:VALARM' : null,
        'END:VEVENT',
        'END:VCALENDAR',
    ]
        .filter(Boolean)
        .map(icsFoldLine);

    return lines.join('\r\n') + '\r\n';
}

const IS_TLS_PORT = EMAIL_PORT === 465;
const transport = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: IS_TLS_PORT,
    auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD,
    },
});

function getUpgradeMessage(pricingUrl = `${SERVER_URL}/pricing`) {
    if (config.SAAS.enabled) {
        return `<p>Ready to unlock the full MiroTalk experience?</p>
            <p>Choose the plan that fits your needs from our pricing page.</p>
            <a href="${safeUrlAttr(pricingUrl)}" target="_blank">View pricing options</a>
            <br/>`;
    }

    return `<p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p>
        <p>Get <strong>License</strong>, <strong>Full Source Code</strong>, and <strong>Priority Support</strong>, plus access to all updates. Your purchase fuels future improvements!</p>
        <p>Ready to upgrade? Click below to choose your MiroTalk package.</p>
        <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a>
        <br/>`;
}

function buildEmailHtml({ preheader, title, greeting, content, action, footer }) {
    const actionUrl = action?.url ? safeUrlAttr(action.url) : '';
    const actionHtml = actionUrl
        ? `<div style="margin:28px 0 24px;">
                <a href="${actionUrl}" style="display:inline-block;background:#2457d6;color:#ffffff;padding:13px 22px;text-decoration:none;border-radius:6px;font-weight:700;">${escapeHtml(action.label)}</a>
            </div>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#5e6878;">If the button does not work, paste this link into your browser:<br/><a href="${actionUrl}" style="color:#2457d6;word-break:break-all;">${actionUrl}</a></p>`
        : '';

    return `<!doctype html>
        <html lang="en">
            <body style="margin:0;background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033;">
                <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe5ee;border-radius:8px;overflow:hidden;">
                                <tr><td style="padding:24px 32px;border-bottom:1px solid #e8ecf2;font-size:20px;font-weight:700;color:#2457d6;">MiroTalk</td></tr>
                                <tr>
                                    <td style="padding:32px;">
                                        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#172033;">${escapeHtml(title)}</h1>
                                        ${greeting ? `<p style="margin:0 0 12px;line-height:1.6;">${escapeHtml(greeting)}</p>` : ''}
                                        ${content}
                                        ${actionHtml}
                                    </td>
                                </tr>
                                <tr><td style="padding:20px 32px;background:#f8fafc;font-size:12px;line-height:1.6;color:#6b7280;">${escapeHtml(footer)}</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
        </html>`;
}

function sendConfirmationEmail(name, email, confirmationCode) {
    const confirmationUrl = `${SERVER_URL}/api/v1/user/confirmation/${confirmationCode}`;
    return transport.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Confirm your email | MiroTalk',
        text: `Hello ${name},\n\nConfirm your email to activate your MiroTalk account:\n${confirmationUrl}\n\nThis link expires after ${CONFIRMATION_LINK_EXPIRY}. If you did not create this account, you can ignore this email.`,
        html: buildEmailHtml({
            preheader: 'Confirm your email to activate your MiroTalk account.',
            title: 'Confirm your email',
            greeting: `Hello ${name},`,
            content: `<p style="margin:0;line-height:1.6;">Confirm your email address to activate your account and start using MiroTalk.</p>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5e6878;">This link expires after ${escapeHtml(CONFIRMATION_LINK_EXPIRY)}.</p>`,
            action: { label: 'Confirm email address', url: confirmationUrl },
            footer: 'If you did not create this account, you can safely ignore this email.',
        }),
    });
}

function sendConfirmationOkEmail(name, toEmail) {
    const signInUrl = `${SERVER_URL}/`;
    return transport
        .sendMail({
            from: EMAIL_FROM,
            to: toEmail,
            subject: 'Your MiroTalk account is ready',
            text: `Hello ${name},\n\nYour email is confirmed and your MiroTalk account is ready. Sign in to create or schedule your first meeting:\n${signInUrl}`,
            html: buildEmailHtml({
                preheader: 'Your MiroTalk account is active and ready.',
                title: 'Your account is ready',
                greeting: `Hello ${name},`,
                content:
                    '<p style="margin:0;line-height:1.6;">Your email is confirmed. Sign in to create a meeting room, schedule a call, or invite your team.</p>',
                action: { label: 'Sign in to MiroTalk', url: signInUrl },
                footer: 'You received this message because your MiroTalk email address was confirmed.',
            }),
        })
        .catch((err) => log.error(err));
}

function sendPasswordResetEmail(name, email, resetUrl) {
    return transport.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Reset your password | MiroTalk',
        text: `Hello ${name},\n\nUse this link to reset your MiroTalk password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
        html: buildEmailHtml({
            preheader: 'Use this secure link to reset your MiroTalk password.',
            title: 'Reset your password',
            greeting: `Hello ${name},`,
            content:
                '<p style="margin:0;line-height:1.6;">We received a request to reset your password. Use the secure link below to choose a new one.</p><p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5e6878;">This link expires in 1 hour and can only be used once.</p>',
            action: { label: 'Reset password', url: resetUrl },
            footer: 'If you did not request a password reset, you can safely ignore this email.',
        }),
    });
}

function sendPasswordChangeConfirmation(name, email) {
    const resetUrl = `${SERVER_URL}/password-forgot`;
    return transport.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Your MiroTalk password was changed',
        text: `Hello ${name},\n\nYour MiroTalk password was changed successfully. If you did not make this change, reset your password immediately:\n${resetUrl}`,
        html: buildEmailHtml({
            preheader: 'Your MiroTalk password was changed.',
            title: 'Password changed',
            greeting: `Hello ${name},`,
            content:
                '<p style="margin:0;line-height:1.6;">Your password was changed successfully.</p><p style="margin:20px 0 0;padding:14px 16px;background:#fff7ed;border-left:4px solid #f97316;line-height:1.6;color:#9a3412;">If you did not make this change, reset your password immediately.</p>',
            action: { label: 'Secure my account', url: resetUrl },
            footer: 'This is an automated security notification from MiroTalk.',
        }),
    });
}

function sendInvitationEmail(name, email, setupUrl) {
    return transport.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Set up your MiroTalk account',
        text: `Hello ${name},\n\nAn account has been created for you. Choose your password using this secure, single-use link:\n${setupUrl}\n\nThis link expires in 1 hour.`,
        html: buildEmailHtml({
            preheader: 'Finish setting up your new MiroTalk account.',
            title: 'You have been invited',
            greeting: `Hello ${name},`,
            content: `<p style="margin:0;line-height:1.6;">An account has been created for <strong>${escapeHtml(email)}</strong>. Choose a password to finish setting it up.</p><p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5e6878;">This secure link expires in 1 hour and can only be used once.</p>`,
            action: { label: 'Set my password', url: setupUrl },
            footer: 'If you were not expecting this invitation, you can safely ignore this email.',
        }),
    });
}

/**
 * Send a room invitation email (server-side flow).
 *
 * Returns the nodemailer info object on success, throws on failure so the
 * caller (email queue worker) can record the error and schedule a retry.
 */
function sendRoomInvitationEmail({
    kind = 'invitation',
    to,
    subject,
    roomUrl,
    roomType,
    room,
    date,
    time,
    timezone,
    startAt,
    calendarUid,
    calendarSequence,
    durationMin,
    inviterName,
    message,
}) {
    // Defense-in-depth: every interpolated field is HTML-escaped (or URL-sanitized) at render time,
    // even though upstream callers also validate/limit them. Schema-level validators for room/date/time
    // are intentionally permissive, so this is the authoritative XSS boundary for outbound mail.
    const safeRoomUrlAttr = safeUrlAttr(roomUrl);
    const safeInviter = escapeHtml(inviterName);

    // Resolve the duration shown in the email body (mirrors the ICS DTEND computation).
    const requestedDuration = Number(durationMin);
    const effectiveDuration =
        Number.isFinite(requestedDuration) && requestedDuration >= 5 && requestedDuration <= 1440
            ? Math.round(requestedDuration)
            : ICS_DEFAULT_DURATION_MIN;
    const isReminder = kind === 'reminder';
    const isUpdate = kind === 'update';
    const isCancellation = kind === 'cancellation';
    const calendarMethod = isCancellation ? 'CANCEL' : 'REQUEST';
    const title = isCancellation
        ? 'Meeting canceled'
        : isUpdate
          ? 'Meeting details changed'
          : isReminder
            ? 'Your meeting starts soon'
            : 'You are invited to a meeting';
    const rawSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : '';
    const defaultSubject = `${title}: ${room || `MiroTalk ${roomType || ''} meeting`}`.trim();
    const safeSubject = (rawSubject || defaultSubject).slice(0, 200);
    const summary = isCancellation
        ? `The meeting${inviterName ? ` with ${inviterName}` : ''} has been canceled.`
        : isUpdate
          ? `The meeting${inviterName ? ` with ${inviterName}` : ''} has been updated.`
          : isReminder
            ? `Your meeting${inviterName ? ` with ${inviterName}` : ''} starts soon.`
            : inviterName
              ? `${inviterName} has invited you to a meeting.`
              : 'You have been invited to a meeting.';
    const customMessage = message
        ? `<div style="margin:20px 0;padding:14px 16px;background:#f4f7fb;border-left:4px solid #2457d6;border-radius:4px;">
                                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#5e6878;">MESSAGE${safeInviter ? ` FROM ${safeInviter.toUpperCase()}` : ''}</p>
                                <p style="margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
                                    String(message)
                                )}</p>
                        </div>`
        : '';
    const details = [
        ['Service', `MiroTalk ${roomType || ''}`.trim()],
        ['Room', room],
        ['When', formatMeetingSchedule(startAt, date, time, timezone)],
        ['Duration', formatDurationLabel(effectiveDuration)],
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
    const detailsHtml = details
        .map(
            ([label, value], index) => `<tr>
                                <td style="padding:11px 12px;border-bottom:${index === details.length - 1 ? '0' : '1px solid #e8ecf2'};color:#5e6878;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
                                <td style="padding:11px 12px;border-bottom:${index === details.length - 1 ? '0' : '1px solid #e8ecf2'};font-weight:600;text-align:right;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
                        </tr>`
        )
        .join('');
    const plainDetails = details.map(([label, value]) => `${label}: ${value}`).join('\n');
    const actionLabel = isReminder ? 'Join meeting' : isUpdate ? 'View updated meeting' : 'View meeting';
    const footer = isCancellation
        ? 'A calendar cancellation is attached so your calendar can stay up to date.'
        : 'A calendar invitation is attached for easy scheduling.';

    // Attach a calendar invite (.ics) when the room has a valid schedule.
    const icsContent = buildInvitationIcs({
        room,
        roomUrl,
        date,
        time,
        timezone,
        startAt,
        calendarUid,
        calendarSequence,
        calendarMethod,
        durationMin,
        inviterName,
        message,
        roomType,
        recipient: to,
    });
    const icalEvent = icsContent
        ? { filename: 'invitation.ics', method: calendarMethod, content: icsContent }
        : undefined;

    return transport.sendMail({
        from: EMAIL_FROM,
        to,
        subject: safeSubject,
        icalEvent,
        text: `${title}\n\n${summary}${message ? `\n\nMessage${inviterName ? ` from ${inviterName}` : ''}:\n${message}` : ''}\n\n${plainDetails}${!isCancellation && roomUrl ? `\n\n${actionLabel}: ${roomUrl}` : ''}\n\n${footer}`,
        html: buildEmailHtml({
            preheader: summary,
            title,
            content: `
                <p style="margin:0;line-height:1.6;">${escapeHtml(summary)}</p>
                ${customMessage}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0;background:#f8fafc;border:1px solid #e8ecf2;border-radius:6px;border-collapse:separate;border-spacing:0;">${detailsHtml}</table>`,
            action: !isCancellation && safeRoomUrlAttr ? { label: actionLabel, url: roomUrl } : null,
            footer,
        }),
    });
}

module.exports = {
    sendConfirmationEmail,
    sendConfirmationOkEmail,
    sendPasswordResetEmail,
    sendPasswordChangeConfirmation,
    sendInvitationEmail,
    sendRoomInvitationEmail,
    buildInvitationIcs,
    getUpgradeMessage,
    EMAIL_VERIFICATION,
};
