'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const readFrontend = (file) => fs.readFileSync(path.resolve(__dirname, '../frontend', file), 'utf8');

test('shared dialog defaults preserve per-dialog options and toast behavior', () => {
    const calls = [];
    const mixins = [];
    const createSwal = (defaults = {}) => ({
        fire(options) {
            calls.push({ ...defaults, ...options });
            return Promise.resolve({ isConfirmed: false });
        },
        mixin(options) {
            mixins.push(options);
            return createSwal({ ...defaults, ...options });
        },
    });
    const context = { Swal: createSwal() };
    vm.createContext(context);
    vm.runInContext(readFrontend('js/swal.js'), context);

    context.popupMessage('success', 'Saved');
    assert.equal(calls[0].buttonsStyling, false);
    assert.equal(calls[0].reverseButtons, true);
    assert.equal(calls[0].showCancelButton, undefined);
    assert.equal(calls[0].html, 'Saved');

    context.Swal.fire({ reverseButtons: false, customClass: { confirmButton: 'swal-action-danger' } });
    assert.equal(calls[1].reverseButtons, false);
    assert.equal(calls[1].customClass.confirmButton, 'swal-action-danger');

    context.popupMessage('toast', 'Copied', 1000);
    assert.equal(mixins.length, 2);
    assert.equal(calls[2].toast, true);
    assert.equal(calls[2].showConfirmButton, false);
    assert.equal(calls[2].timer, 1000);
});

const clientSource = readFrontend('js/client.js');

function loadClientDialog(name, confirmed = false) {
    const options = [];
    const deletedIds = [];
    const redirects = [];
    const match = clientSource.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm'));
    assert.ok(match, `Missing dialog function: ${name}`);
    const context = {
        Swal: {
            fire: async (settings) => {
                options.push(settings);
                return { isConfirmed: confirmed };
            },
        },
        userId: 'current-user',
        userDelete: async (id) => {
            deletedIds.push(id);
            return {};
        },
        openURL: (url) => redirects.push(url),
        console: { log() {} },
        popupMessage() {},
        loadUsers() {},
        loadDashboardStats() {},
        dataTable: { rows: () => ({ count: () => 2 }) },
        getActiveFilter: () => 'all',
        getFilterLabel: () => 'all',
    };
    vm.createContext(context);
    vm.runInContext(match[0], context);
    return { context, options, deletedIds, redirects };
}

for (const name of [
    'deleteUser',
    'deleteRegularUsers',
    'confirmDeleteRoom',
    'delAllRows',
    'delMyAccount',
    'disableRoomReminder',
]) {
    test(`${name} focuses the safe action and dismisses without deleting data`, async () => {
        const { context, options, deletedIds, redirects } = loadClientDialog(name);
        context[name]('another-user');
        await Promise.resolve();
        assert.equal(options.length, 1);
        assert.equal(options[0].showCancelButton, true);
        assert.equal(options[0].showDenyButton, undefined);
        assert.equal(options[0].focusCancel, true);
        assert.equal(options[0].customClass.confirmButton, 'swal-action-danger');
        assert.ok(options[0].confirmButtonText);
        assert.ok(options[0].cancelButtonText);
        assert.deepEqual(deletedIds, []);
        assert.deepEqual(redirects, []);
    });
}

test('confirming user deletion still deletes the selected user', async () => {
    const { context, deletedIds } = loadClientDialog('deleteUser', true);
    context.deleteUser('another-user');
    await Promise.resolve();
    assert.deepEqual(deletedIds, ['another-user']);
});

test('confirming account deletion still deletes the current account and logs out', async () => {
    const { context, deletedIds, redirects } = loadClientDialog('delMyAccount', true);
    context.delMyAccount();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(deletedIds, ['current-user']);
    assert.deepEqual(redirects, ['/logout']);
});

for (const [file, title] of [
    ['js/client.js', 'Expired rooms found'],
    ['js/client.js', 'Recurring invitation active'],
    ['js/client.js', 'Disable recurring invitation?'],
    ['js/booking-manage.js', 'Cancel and delete booking'],
    ['js/events-manage.js', 'Delete event?'],
]) {
    test(`${title} uses a destructive confirmation and a safely focused secondary action`, () => {
        const calls = [...readFrontend(file).matchAll(/Swal\.fire\((\{[\s\S]*?\n\s*\})\)(?:\.then|;)/g)];
        const call = calls.find((match) => match[1].includes(`title: '${title}'`));
        assert.ok(call, `Missing dialog: ${title}`);
        const options = vm.runInNewContext(`(${call[1]})`, { pastRooms: [{}, {}] });
        assert.equal(options.showCancelButton, true);
        assert.equal(options.focusCancel, true);
        assert.equal(options.customClass.confirmButton, 'swal-action-danger');
        assert.ok(options.cancelButtonText);
        assert.equal(options.confirmButtonColor, undefined);
    });
}

function contrastWithWhite(hex) {
    const rgb = hex.match(/[a-f\d]{2}/gi).map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    return 1.05 / (luminance + 0.05);
}

test('dialog actions suppress ordinary focus decoration but retain a keyboard focus outline', () => {
    const styles = readFrontend('css/common.css');
    const focus = styles.match(/\.swal2-actions \.swal2-confirm:focus,[^{]+\{([^}]+)\}/);
    const focusVisible = styles.match(/\.swal2-actions \.swal2-confirm:focus-visible,[^{]+\{([^}]+)\}/);
    assert.ok(focus);
    assert.ok(focusVisible);
    for (const button of ['confirm', 'cancel', 'deny']) {
        assert.ok(focus[0].includes(`.swal2-${button}:focus`));
        assert.ok(focusVisible[0].includes(`.swal2-${button}:focus-visible`));
    }
    assert.match(focus[1], /outline: none;/);
    assert.match(focus[1], /box-shadow: none;/);
    assert.match(focusVisible[1], /outline: 2px solid var\(--accent-color\);/);
    assert.match(focusVisible[1], /outline-offset: 3px;/);
});

test('primary and destructive button backgrounds meet WCAG AA contrast for white text', () => {
    const styles = readFrontend('css/common.css');
    const backgrounds = [...styles.matchAll(/background-color: (#[a-f\d]{6});/gi)].map((match) => match[1]);
    assert.equal(backgrounds.length, 4);
    for (const color of backgrounds) {
        assert.ok(contrastWithWhite(color) >= 4.5, `${color} must have at least 4.5:1 contrast against white`);
    }
});
