'use strict';

/**
 * Recipient parsing & validation helpers for the server-side room invitation flow.
 *
 * Kept in a separate module to keep utils.js focused on auth/JWT/validation
 * helpers used elsewhere.
 */

const validEmailReg =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const SEPARATOR = /[,;\n\r\t]+/;

function parseDomainList(env) {
    return String(env || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

const BLOCKLIST = parseDomainList(process.env.EMAIL_INVITATION_DOMAIN_BLOCKLIST);
const ALLOWLIST = parseDomainList(process.env.EMAIL_INVITATION_DOMAIN_ALLOWLIST);

function normalizeEmail(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

/**
 * Accept either a string (comma/newline/semicolon-separated) or an array.
 * Returns a flat array of trimmed, lower-cased, non-empty strings.
 */
function parseRecipients(input) {
    if (input == null) return [];
    const tokens = Array.isArray(input)
        ? input.flatMap((s) => String(s).split(SEPARATOR))
        : String(input).split(SEPARATOR);
    return tokens.map(normalizeEmail).filter(Boolean);
}

function domainOf(email) {
    const at = email.lastIndexOf('@');
    return at >= 0 ? email.slice(at + 1) : '';
}

/**
 * Validate, dedupe and classify a list of recipient emails.
 *
 * @returns {{ valid: string[], invalid: string[], blocked: string[], duplicates: number, total: number }}
 */
function validateEmailList(list, { max } = {}) {
    const seen = new Set();
    const valid = [];
    const invalid = [];
    const blocked = [];
    let duplicates = 0;

    for (const raw of list) {
        const email = normalizeEmail(raw);
        if (!email) continue;
        if (seen.has(email)) {
            duplicates++;
            continue;
        }
        seen.add(email);

        if (!validEmailReg.test(email)) {
            invalid.push(email);
            continue;
        }
        const domain = domainOf(email);
        if (ALLOWLIST.length > 0 && !ALLOWLIST.includes(domain)) {
            blocked.push(email);
            continue;
        }
        if (BLOCKLIST.length > 0 && BLOCKLIST.includes(domain)) {
            blocked.push(email);
            continue;
        }
        valid.push(email);
    }

    const total = valid.length + invalid.length + blocked.length + duplicates;
    const result = { valid, invalid, blocked, duplicates, total };

    if (typeof max === 'number' && valid.length > max) {
        result.exceededMax = true;
    }
    return result;
}

module.exports = {
    parseRecipients,
    normalizeEmail,
    validateEmailList,
};
