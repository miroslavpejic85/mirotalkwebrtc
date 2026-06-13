'use strict';

const logs = require('../common/logs');
const nodemailer = require('nodemailer');

const log = new logs('NodeMailer');

const SERVER_URL = process.env.SERVER_URL;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USERNAME;
const EMAIL_VERIFICATION = process.env.EMAIL_VERIFICATION === 'true' || false;
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

// Format a Date as a UTC iCalendar timestamp: 20260520T101500Z
function icsUtcStamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
        date.getUTCFullYear() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) +
        'T' +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) +
        'Z'
    );
}

/**
 * Build a minimal VCALENDAR (METHOD:REQUEST) for a room invitation.
 *
 * The room date/time are persisted as plain strings (YYYY-MM-DD and HH:mm,
 * no timezone), so we emit them as RFC 5545 "floating" local times — every
 * calendar client interprets them in the recipient's own timezone, which
 * matches how the inviter entered them. Returns null if date/time are
 * missing or malformed (caller will simply skip the attachment).
 */
function buildInvitationIcs({ room, roomUrl, date, time, durationMin, inviterName, message, roomType, recipient }) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(time || '').trim());
    if (!dateMatch || !timeMatch) return null;

    const [, y, mo, d] = dateMatch;
    const [, h, mi] = timeMatch;

    // Floating local-time DTSTART (no TZID, no Z): clients render in viewer's local TZ.
    const dtStart = `${y}${mo}${d}T${h}${mi}00`;

    // Per-room duration (minutes) takes precedence over the env default.
    // Clamp to the same 5..1440 bounds the schema enforces to defend against bad inputs.
    const requestedDuration = Number(durationMin);
    const effectiveDuration =
        Number.isFinite(requestedDuration) && requestedDuration >= 5 && requestedDuration <= 1440
            ? Math.round(requestedDuration)
            : ICS_DEFAULT_DURATION_MIN;

    // Compute DTEND by adding the effective duration to the local wall-clock value.
    // Using Date.UTC keeps the math TZ-free; we then strip the Z to keep it floating.
    const endMs =
        Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0) + effectiveDuration * 60 * 1000;
    const endDate = new Date(endMs);
    const pad = (n) => String(n).padStart(2, '0');
    const dtEnd =
        endDate.getUTCFullYear() +
        pad(endDate.getUTCMonth() + 1) +
        pad(endDate.getUTCDate()) +
        'T' +
        pad(endDate.getUTCHours()) +
        pad(endDate.getUTCMinutes()) +
        '00';

    const dtStamp = icsUtcStamp(new Date());

    // Stable UID per (room + start) so calendar updates replace the prior event.
    const uidBase = `${room || 'mirotalk'}-${dtStart}`.replace(/[^A-Za-z0-9._-]/g, '-');
    const uidHost = (EMAIL_FROM && EMAIL_FROM.split('@')[1]) || 'mirotalk.local';
    const uid = `${uidBase}@${uidHost}`;

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
        ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${recipient}`
        : null;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MiroTalk//Invitation//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${icsEscapeText(summary)}`,
        `DESCRIPTION:${icsEscapeText(description)}`,
        `LOCATION:${icsEscapeText(roomUrl || '')}`,
        roomUrl ? `URL:${icsEscapeText(roomUrl)}` : null,
        organizerLine,
        attendeeLine,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscapeText(summary)}`,
        'TRIGGER:-PT15M',
        'END:VALARM',
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

function sendConfirmationEmail(name, email, confirmationCode) {
    transport
        .sendMail({
            from: EMAIL_USERNAME,
            to: email,
            subject: 'MiroTalk WEB - Please confirm your email',
            html: `
                <h1>Email Confirmation</h1>
                <h2>Hello ${name}</h2>
                <p>Thank you for subscribing. Please confirm your email by clicking on the following link</p>
                <a href=${SERVER_URL}/api/v1/user/confirmation/${confirmationCode}> Click here to confirm</a>
                <p>If it wasn't you, please ignore this email.</p>
            `,
        })
        .catch((err) => log.error(err));
}

function sendConfirmationOkEmail(name, toEmail, credential) {
    const credentialObj = JSON.parse(credential);
    const { role, email, username, active, allow, allowedRooms, createdAt, updatedAt } = credentialObj;
    log.debug('sendConfirmationOkEmail', credentialObj);
    transport
        .sendMail({
            from: EMAIL_FROM,
            to: toEmail,
            subject: 'MiroTalk WEB - Email confirmed',
            html: `
                <h1>Email Confirmed</h1>
                <h2>Hello ${name}</h2>
                <p>Thank you for confirmation. Here your account info</p>
                <style>
                    table {
                        font-family: arial, sans-serif;
                        border-collapse: collapse;
                        width: 100%;
                    }
                    td {
                        border: 1px solid #dddddd;
                        text-align: left;
                        padding: 8px;
                    }
                    tr:nth-child(even) {
                        background-color: #dddddd;
                    }
                </style>
                <table>
                    <tr>
                        <td>Role</td>
                        <td>${role}</td>
                    </tr>
                    <tr>
                        <td>Email</td>
                        <td>${email}</td>
                    </tr>
                    <tr>
                        <td>Username</td>
                        <td>${username}</td>
                    </tr>
                    <tr>
                        <td>Active</td>
                        <td>${active}</td>
                    </tr>
                    <tr>
                        <td>Allowed services</td>
                        <td>${allow}</td>
                    </tr>
                    <tr>
                        <td>Allowed rooms</td>
                        <td>${allowedRooms}</td>
                    </tr>
                    <tr>
                        <td>Created at</td>
                        <td>${createdAt}</td>
                    </tr>
                    <tr>
                        <td>Updated at</td>
                        <td>${updatedAt}</td>
                    </tr>
                </table>
                <br/>
                <p>Home page</p>
                <a href="${SERVER_URL}" target="_blank">${SERVER_URL}</a>
                <br/> 
                <p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p> 
                <p>Get <strong>License</strong>, <strong>Full Source Code</strong>, and <strong>Priority Support</strong>, plus access to all updates. Your purchase fuels future improvements!</p> 
                <p>Ready to upgrade? Click below to choose your MiroTalk package.</p> 
                <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a> 
                <br/> 
                <p>Thank you for your support!</p> 
                <p>MiroTalk Team</p>
            `,
        })
        .catch((err) => log.error(err));
}

function sendPasswordResetEmail(name, email, resetUrl) {
    transport
        .sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'MiroTalk WEB - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #316fb2;">Password Reset Request</h1>
                    <h2>Hello ${name}</h2>
                    <p>You recently requested to reset your password. Click the button below to reset it:</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #316fb2; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        This link will expire in 1 hour.<br>
                        If you didn't request this, please ignore this email.
                    </p>
                    <br/>
                    <p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p>
                    <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a>
                    <br/>
                    <p>Thank you for your support!</p>
                    <p>MiroTalk Team</p>
                </div>
            `,
        })
        .catch((err) => log.error(err));
}

function sendPasswordChangeConfirmation(name, email) {
    transport
        .sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'MiroTalk WEB - Password Changed Successfully',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #10b981;">Password Changed Successfully</h1>
                    <h2>Hello ${name}</h2>
                    <p>Your password has been successfully changed.</p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        If you didn't make this change, please contact support immediately.
                    </p>
                    <br/>
                    <p>Home page</p>
                    <a href="${SERVER_URL}" target="_blank">${SERVER_URL}</a>
                    <br/>
                    <p>Thank you for your support!</p>
                    <p>MiroTalk Team</p>
                </div>
            `,
        })
        .catch((err) => log.error(err));
}

function sendInvitationEmail(name, email, password) {
    transport
        .sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'MiroTalk WEB - You are invited!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #376df9;">Welcome to MiroTalk!</h1>
                    <h2>Hello ${name}</h2>
                    <p>An account has been created for you. Here are your login credentials:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Username</td>
                            <td style="border: 1px solid #ddd; padding: 10px;">${name}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Email</td>
                            <td style="border: 1px solid #ddd; padding: 10px;">${email}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Password</td>
                            <td style="border: 1px solid #ddd; padding: 10px;">${password}</td>
                        </tr>
                    </table>
                    <div style="margin: 30px 0;">
                        <a href="${SERVER_URL}" 
                           style="background-color: #376df9; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Sign in Now
                        </a>
                    </div>
                    <div style="margin-top: 30px; padding: 14px 18px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; font-weight: bold;">
                            ⚠️ Security Notice
                        </p>
                        <p style="margin: 6px 0 0; color: #856404; font-size: 14px;">
                            After signing in, please change your password from your Account settings for security reasons.
                        </p>
                    </div>
                    <br/>
                    <p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p>
                    <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a>
                    <br/>
                    <p>Thank you for your support!</p>
                    <p>MiroTalk Team</p>
                </div>
            `,
        })
        .catch((err) => log.error(err));
}

/**
 * Send a room invitation email (server-side flow).
 *
 * Returns the nodemailer info object on success, throws on failure so the
 * caller (email queue worker) can record the error and schedule a retry.
 */
function sendRoomInvitationEmail({
    to,
    subject,
    roomUrl,
    roomType,
    room,
    date,
    time,
    durationMin,
    inviterName,
    message,
}) {
    // Defense-in-depth: every interpolated field is HTML-escaped (or URL-sanitized) at render time,
    // even though upstream callers also validate/limit them. Schema-level validators for room/date/time
    // are intentionally permissive, so this is the authoritative XSS boundary for outbound mail.
    const safeRoomType = escapeHtml(roomType);
    const safeRoom = escapeHtml(room);
    const safeDate = escapeHtml(date);
    const safeTime = escapeHtml(time);
    const safeRoomUrlAttr = safeUrlAttr(roomUrl);
    const safeRoomUrlText = escapeHtml(roomUrl);
    const safeInviter = escapeHtml(inviterName);

    // Resolve the duration shown in the email body (mirrors the ICS DTEND computation).
    const requestedDuration = Number(durationMin);
    const effectiveDuration =
        Number.isFinite(requestedDuration) && requestedDuration >= 5 && requestedDuration <= 1440
            ? Math.round(requestedDuration)
            : ICS_DEFAULT_DURATION_MIN;
    const safeDuration = escapeHtml(formatDurationLabel(effectiveDuration));

    const rawSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : '';
    // Cap subject to avoid oversized SMTP headers / DB bloat; nodemailer encodes headers itself.
    const safeSubject = (rawSubject || `You are invited to a MiroTalk ${roomType || ''} meeting`.trim()).slice(0, 200);

    const greeting = safeInviter
        ? `${safeInviter} has invited you to a meeting.`
        : 'You have been invited to a meeting.';
    const customMessage = message
        ? `<p style="margin: 16px 0; padding: 12px 16px; background-color: #f4f7fb; border-left: 4px solid #376df9; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(
              String(message)
          )}</p>`
        : '';

    // Attach a calendar invite (.ics) when the room has a date+time, so recipients
    // can add the meeting to their calendar in one click. Built as RFC 5545
    // floating local time to match how the inviter entered it.
    const icsContent = buildInvitationIcs({
        room,
        roomUrl,
        date,
        time,
        durationMin,
        inviterName,
        message,
        roomType,
        recipient: to,
    });
    const attachments = icsContent
        ? [
              {
                  filename: 'invitation.ics',
                  content: icsContent,
                  contentType: 'text/calendar; charset=utf-8; method=REQUEST',
              },
          ]
        : undefined;

    return transport.sendMail({
        from: EMAIL_FROM,
        to,
        subject: safeSubject,
        attachments,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #376df9;">MiroTalk Meeting Invitation</h1>
                <p>${greeting}</p>
                ${customMessage}
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Service</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">MiroTalk ${safeRoomType}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Room</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${safeRoom}</td>
                    </tr>
                    ${
                        safeDate
                            ? `<tr>
                        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Date</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${safeDate}</td>
                    </tr>`
                            : ''
                    }
                    ${
                        safeTime
                            ? `<tr>
                        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Time</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${safeTime}</td>
                    </tr>`
                            : ''
                    }
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">Duration</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${safeDuration}</td>
                    </tr>
                </table>
                <div style="margin: 30px 0;">
                    <a href="${safeRoomUrlAttr}"
                       style="background-color: #376df9; color: white; padding: 12px 24px;
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Join Meeting
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${safeRoomUrlText}</p>
                <br/>
                <p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p>
                <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a>
                <br/>
                <p>Thank you for your support!</p>
                <p>MiroTalk Team</p>
            </div>
        `,
    });
}

module.exports = {
    sendConfirmationEmail,
    sendConfirmationOkEmail,
    sendPasswordResetEmail,
    sendPasswordChangeConfirmation,
    sendInvitationEmail,
    sendRoomInvitationEmail,
    EMAIL_VERIFICATION,
    SUPPORT,
};
