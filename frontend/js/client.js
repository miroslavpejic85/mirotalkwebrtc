'use strict';

/**
 * MiroTalk WebRTC - Client component
 *
 * @link    GitHub: https://github.com/miroslavpejic85/mirotalkwebrtc
 * @link    Live demo: https://webrtc.mirotalk.com
 * @license For open source under AGPL-3.0
 * @license For private project or commercial purposes contact us at: license.mirotalk@gmail.com or purchase it directly via Code Canyon:
 * @license https://codecanyon.net/item/a-selfhosted-mirotalks-webrtc-rooms-scheduler-server/42643313
 * @author  Miroslav Pejic - miroslav.pejic.85@gmail.com
 * @version 1.3.31
 */

const userAgent = navigator.userAgent;
const parser = new UAParser(userAgent);
const result = parser.getResult();
const deviceType = result.device.type || 'desktop';
const isMobile = deviceType === 'mobile';

console.log('INFO', result);

const body = document.querySelector('body');
const modeToggle = body.querySelector('.mode-toggle');
const topModeToggle = document.getElementById('topModeToggle');
const sidebar = body.querySelector('nav');
const sidebarToggle = body.querySelector('.sidebar-toggle');

const navOverview = document.getElementById('navOverview');
const navDash = document.getElementById('navDash');
const navUsers = document.getElementById('navUsers');
const navC2C = document.getElementById('navC2C');
const navP2P = document.getElementById('navP2P');
const navSFU = document.getElementById('navSFU');
const navBRO = document.getElementById('navBRO');
const navSup = document.getElementById('navSup');
const navAcc = document.getElementById('navAcc');
const navSet = document.getElementById('navSet');

const navLogoImage = document.getElementById('navLogoImage');
const navLogoLabel = document.getElementById('navLogoLabel');

const navP2PLabel = document.getElementById('navP2PLabel');
const navSFULabel = document.getElementById('navSFULabel');
const navC2CLabel = document.getElementById('navC2CLabel');
const navBROLabel = document.getElementById('navBROLabel');

const tableAppName = document.getElementById('tableAppName');
const rowAppName = document.getElementById('rowAppName');

const myProfile = document.getElementById('myProfile');

const dsOverview = document.getElementById('dsOverview');
const dsRooms = document.getElementById('dsRooms');
const dsUsers = document.getElementById('dsUsers');

const dsDashStats = document.getElementById('dsDashStats');
const statsUsersSection = document.getElementById('statsUsersSection');
const statsRoomsSectionTitle = document.getElementById('statsRoomsSectionTitle');
const statsTypesSectionTitle = document.getElementById('statsTypesSectionTitle');
const statTotalUsers = document.getElementById('statTotalUsers');
const statActiveUsers = document.getElementById('statActiveUsers');
const statInactiveUsers = document.getElementById('statInactiveUsers');
const statAdmins = document.getElementById('statAdmins');
const statGuests = document.getElementById('statGuests');
const statLatestUser = document.getElementById('statLatestUser');
const statTotalRoomsVal = document.getElementById('statTotalRoomsVal');
const statTotalRoomsLabel = document.getElementById('statTotalRoomsLabel');
const statTodayVal = document.getElementById('statTodayVal');
const statTodayLabel = document.getElementById('statTodayLabel');
const statUpcomingVal = document.getElementById('statUpcomingVal');
const statUpcomingLabel = document.getElementById('statUpcomingLabel');
const statMemberSince = document.getElementById('statMemberSince');
const statMemberSinceVal = document.getElementById('statMemberSinceVal');
const statTotalUsersVal = document.getElementById('statTotalUsersVal');
const statActiveUsersVal = document.getElementById('statActiveUsersVal');
const statInactiveUsersVal = document.getElementById('statInactiveUsersVal');
const statAdminsVal = document.getElementById('statAdminsVal');
const statGuestsVal = document.getElementById('statGuestsVal');
const statLatestUserVal = document.getElementById('statLatestUserVal');
const statP2PVal = document.getElementById('statP2PVal');
const statSFUVal = document.getElementById('statSFUVal');
const statC2CVal = document.getElementById('statC2CVal');
const statBROVal = document.getElementById('statBROVal');

const boxesDS = document.getElementById('boxesDS');
const statsProjectsSection = document.getElementById('statsProjectsSection');

const boxP2P = document.getElementById('boxP2P');
const repoP2P = document.getElementById('repoP2P');
const starP2P = document.getElementById('starP2P');
const shieldsP2P = document.getElementById('shieldsP2P');

const boxSFU = document.getElementById('boxSFU');
const repoSFU = document.getElementById('repoSFU');
const starSFU = document.getElementById('starSFU');
const shieldsSFU = document.getElementById('shieldsSFU');

const boxC2C = document.getElementById('boxC2C');
const repoC2C = document.getElementById('repoC2C');
const starC2C = document.getElementById('starC2C');
const shieldsC2C = document.getElementById('shieldsC2C');

const boxBRO = document.getElementById('boxBRO');
const repoBRO = document.getElementById('repoBRO');
const starBRO = document.getElementById('starBRO');
const shieldsBRO = document.getElementById('shieldsBRO');

const p2p = document.getElementById('p2p');
const sfu = document.getElementById('sfu');
const c2c = document.getElementById('c2c');
const bro = document.getElementById('bro');

const p2pIframe = document.getElementById('p2p-iframe');
const sfuIframe = document.getElementById('sfu-iframe');
const c2cIframe = document.getElementById('c2c-iframe');
const broIframe = document.getElementById('bro-iframe');

const accountDiv = document.getElementById('accountDiv');
const accountClose = document.getElementById('account-close-btn');
const accountID = document.getElementById('account-id');
const accountEmail = document.getElementById('account-email');
const accountUsername = document.getElementById('account-username');
const accountCreatedAt = document.getElementById('account-created-at');
const accountUpdatedAt = document.getElementById('account-updated-at');
const accountServicesAllowed = document.getElementById('account-services-allowed');
const accountRoomsAllowed = document.getElementById('account-rooms-allowed');
const accountRole = document.getElementById('account-role');
const accountRoleIcon = document.getElementById('account-role-icon');
const accountDelete = document.getElementById('account-delete');

const settingsDiv = document.getElementById('settingsDiv');
const settingsClose = document.getElementById('settings-close-btn');

const addRowDiv = document.getElementById('addRowDiv');
const openAddBtn = document.getElementById('open-add-btn');
const closeAddBtn = document.getElementById('add-close-btn');
const panelBackdrop = document.getElementById('panelBackdrop');

const addType = document.getElementById('add-type');
const addTypeDropdown = document.getElementById('add-type-dropdown');
const addTag = document.getElementById('add-tag');
const addEmail = document.getElementById('add-email');
const addPhone = document.getElementById('add-phone');
const addDate = document.getElementById('add-date');
const addTime = document.getElementById('add-time');
const addRoom = document.getElementById('add-room');
const genRoom = document.getElementById('gen-room');
const selRoom = document.getElementById('sel-room');
const selRoomDropdown = document.getElementById('sel-room-dropdown');
const addRowBtn = document.getElementById('add-row-btn');

const refreshBtn = document.getElementById('refresh-page-btn');
const delAllBtn = document.getElementById('del-all-btn');
const btnRefreshStats = document.getElementById('btnRefreshStats');

const addUserDiv = document.getElementById('addUserDiv');
const openAddUserBtn = document.getElementById('open-add-user-btn');
const closeAddUserBtn = document.getElementById('add-user-close-btn');
const addUserUsername = document.getElementById('add-user-username');
const addUserEmail = document.getElementById('add-user-email');
const addUserPassword = document.getElementById('add-user-password');
const addUserRooms = document.getElementById('add-user-rooms');
const addUserBtn = document.getElementById('add-user-btn');
const refreshUsersBtn = document.getElementById('refresh-users-btn');

const myTable = document.getElementById('myTable');
const myTableBody = document.getElementById('myTableBody');

function dropdownSearchRender(data, type) {
    if (type === 'filter' || type === 'search') {
        const match = data.match(/data-search="([^"]*)"/);
        if (match) return match[1];
    }
    return data;
}

const dataTable = $('#myTable').DataTable({
    searching: true,
    paging: true,
    pageLength: 10,
    lengthChange: false,
    pagingType: 'simple_numbers',
    info: false,
    responsive: true,
    scrollX: true,
    order: [[4, 'asc']],
    columnDefs: [
        { width: '10%', targets: 0 },
        { width: '10%', targets: 1 },
        { width: '20%', targets: 2 },
        { width: '10%', targets: 3 },
        { width: '10%', targets: 4 },
        { width: '10%', targets: 5 },
        { width: '20%', targets: 6 },
        { width: '10%', targets: 7 },
        {
            targets: [0, 6],
            render: dropdownSearchRender,
        },
        {
            targets: [0, 1, 2, 3, 4, 6],
            type: 'string',
            searchable: true,
        },
        {
            targets: [5, 7],
            orderable: false,
            searchable: false,
        },
        {
            targets: [0, 1, 2, 3, 4, 5, 6, 7],
            className: 'dt-body-justify',
        },
    ], // [MiroTalk, Tag, Email, Phone, Date, Time, Room, Actions]
});
$('#myTable').css('width', '100%');

dataTable.on('draw', function () {
    initVisibleRowsFlatpickr();
    initVisibleRowsToolTips();
    initCustomDropdowns(myTable);
});

const usersDataTable = $('#usersTable').DataTable({
    searching: true,
    paging: true,
    pageLength: 10,
    lengthChange: false,
    pagingType: 'simple_numbers',
    info: false,
    responsive: true,
    scrollX: true,
    order: [[6, 'desc']],
    columnDefs: [
        { width: '12%', targets: 0 },
        { width: '16%', targets: 1 },
        { width: '10%', targets: 2 },
        { width: '10%', targets: 3 },
        { width: '20%', targets: 4 },
        { width: '8%', targets: 5 },
        { width: '12%', targets: 6 },
        { width: '12%', targets: 7 },
        {
            targets: [2, 3],
            render: dropdownSearchRender,
        },
        {
            targets: [0, 1, 2, 3, 4, 6],
            type: 'string',
            searchable: true,
        },
        {
            targets: [5, 7],
            orderable: false,
            searchable: false,
        },
        {
            targets: [0, 1, 2, 3, 4, 5, 6, 7],
            className: 'dt-body-justify',
        },
    ],
});
$('#usersTable').css('width', '100%');

usersDataTable.on('draw', function () {
    initCustomDropdowns(document.getElementById('usersTable'));
});

const getMode = window.localStorage.mode || 'dark';
const getStatus = window.localStorage.status;

if (getMode && getMode === 'dark') {
    body.classList.toggle('dark');
    topModeToggle.querySelector('i').className = 'uil uil-sun';
}
if (getStatus && getStatus === 'close') sidebar.classList.toggle('close');

const toolTips = [
    { element: delAllBtn, text: 'Delete rooms', position: 'top' },
    { element: refreshBtn, text: 'Refresh rooms', position: 'top' },
];

let html = {
    support: true,
    profile: true,
    projects: true,
    //...
};

const tokens = {
    sfu: '',
    p2p: '',
    //...
};

let config = {};

let user = {
    allowedRooms: ['*'],
    allowedRoomsALL: true,
};

$(document).ready(async function () {
    // Strip token from URL to prevent leakage via browser history/referrer
    if (window.location.search.includes('token=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if OIDC is enabled and initialize accordingly
    try {
        const oidcStatus = await getOidcStatus();
        if (oidcStatus && oidcStatus.enabled) {
            isOidcMode = true;
            // In OIDC mode, fetch current user via /user/me to set userId
            const me = await userGetMe();
            if (me && me._id) {
                userId = me._id;
                window.sessionStorage.userId = me._id;
                window.sessionStorage.userToken = me.token || '';
            }
            // Update logout link for OIDC
            const topLogout = document.getElementById('topLogout');
            if (topLogout) topLogout.setAttribute('href', '/logout');

            // Replace account icon with OIDC profile picture
            if (oidcStatus.picture) {
                const navAccLink = document.getElementById('navAcc');
                if (navAccLink) {
                    const icon = navAccLink.querySelector('i');
                    if (icon) {
                        icon.className = '';
                        icon.style.fontSize = '0';
                        const img = document.createElement('img');
                        img.src = oidcStatus.picture;
                        img.alt = oidcStatus.name || 'Profile';
                        img.className = 'oidc-profile-img';
                        icon.appendChild(img);
                    }
                }
                const profileImg = myProfile?.querySelector('img');
                if (profileImg) {
                    profileImg.src = oidcStatus.picture;
                    profileImg.alt = oidcStatus.name || 'Profile';
                }
                // Show profile image in Account panel
                const avatarSection = document.getElementById('accountAvatarSection');
                const avatarImg = document.getElementById('accountAvatarImg');
                const avatarName = document.getElementById('accountAvatarName');
                if (avatarSection && avatarImg) {
                    avatarImg.src = oidcStatus.picture;
                    avatarImg.alt = oidcStatus.name || 'Profile';
                    if (avatarName && oidcStatus.name) avatarName.textContent = oidcStatus.name;
                    avatarSection.classList.remove('hidden');
                }
            }
        }
    } catch (err) {
        console.warn('OIDC status check:', err.message);
    }

    getConfig()
        .then((cfg) => {
            loadConfig(cfg);
            loadToolTip(toolTips);
            handleTokens(cfg);
            handleUserRoles();
            loadDashboardStats();
            initFlatpickr();
        })
        .catch((err) => {
            openURL('/');
        });
});

function loadConfig(cfg) {
    config = cfg;
    html = cfg.HTML ? cfg.HTML : html;
    console.log('Config', config);
    const appName = config?.App?.Name || 'MiroTalk';
    const appLogo = config?.App?.Logo || '../Images/logo.png';
    myProfile.setAttribute('href', config.Author.Profile);
    repoP2P.setAttribute('href', config.MiroTalk.P2P.GitHub.Repo);
    starP2P.setAttribute('href', config.MiroTalk.P2P.GitHub.Star);
    shieldsP2P.setAttribute('src', config.MiroTalk.P2P.GitHub.Shields);
    repoSFU.setAttribute('href', config.MiroTalk.SFU.GitHub.Repo);
    starSFU.setAttribute('href', config.MiroTalk.SFU.GitHub.Star);
    shieldsSFU.setAttribute('src', config.MiroTalk.SFU.GitHub.Shields);
    repoC2C.setAttribute('href', config.MiroTalk.C2C.GitHub.Repo);
    starC2C.setAttribute('href', config.MiroTalk.C2C.GitHub.Star);
    shieldsC2C.setAttribute('src', config.MiroTalk.C2C.GitHub.Shields);
    repoBRO.setAttribute('href', config.MiroTalk.BRO.GitHub.Repo);
    starBRO.setAttribute('href', config.MiroTalk.BRO.GitHub.Star);
    shieldsBRO.setAttribute('src', config.MiroTalk.BRO.GitHub.Shields);
    p2pIframe.setAttribute('src', config.MiroTalk.P2P.Room);
    sfuIframe.setAttribute('src', config.MiroTalk.SFU.Room);
    c2cIframe.setAttribute('src', config.MiroTalk.C2C.Home);
    broIframe.setAttribute('src', config.MiroTalk.BRO.Home);
    navLogoImage.setAttribute('src', appLogo);
    navLogoLabel.textContent = appName;
    navP2PLabel.textContent = config.MiroTalk.P2P.Label || 'MiroTalk P2P';
    navSFULabel.textContent = config.MiroTalk.SFU.Label || 'MiroTalk SFU';
    navC2CLabel.textContent = config.MiroTalk.C2C.Label || 'MiroTalk C2C';
    navBROLabel.textContent = config.MiroTalk.BRO.Label || 'MiroTalk BRO';
    tableAppName.textContent = appName;
    rowAppName.textContent = appName;
}

function handleTokens(cfg) {
    if (cfg.MiroTalk.SFU.Protected) {
        getTokenSFU()
            .then((token) => {
                tokens.sfu = token;
            })
            .catch((err) => {
                console.error('Token SFU error', err.message);
            });
    }
    //...
}

function handleUserRoles() {
    const userPromise = isOidcMode ? userGetMe() : userGet(userId);
    userPromise
        .then((res) => {
            console.log('[API] - USER ROLES GET RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
            } else {
                const { role, allow, allowedRooms } = res;
                user.allowedRooms = allowedRooms;
                user.allowedRoomsALL = allowedRooms.includes('*');
                elemDisplay(addRoom, user.allowedRoomsALL);
                elemDisplay(genRoom, user.allowedRoomsALL);
                elemDisplay(selRoomDropdown, !user.allowedRoomsALL);
                if (!user.allowedRoomsALL) {
                    const optionsContainer = selRoomDropdown.querySelector('.custom-dropdown-options');
                    optionsContainer.innerHTML = '';
                    user.allowedRooms.forEach((room, i) => {
                        const div = document.createElement('div');
                        div.className = 'custom-dropdown-option' + (i === 0 ? ' selected' : '');
                        div.dataset.value = room;
                        div.textContent = room;
                        optionsContainer.appendChild(div);
                    });
                    if (user.allowedRooms.length > 0) {
                        selRoom.value = user.allowedRooms[0];
                        selRoomDropdown.querySelector('.custom-dropdown-value').textContent = user.allowedRooms[0];
                    }
                    selRoomDropdown.classList.remove('cd-ready');
                    initCustomDropdowns(selRoomDropdown.parentElement);
                }
                if (role == 'admin') {
                    elemDisplay(navUsers, true);
                    elemDisplay(navP2P, true);
                    elemDisplay(navSFU, true);
                    elemDisplay(navC2C, true);
                    elemDisplay(navBRO, true);

                    config.MiroTalk.P2P.Visible = true;
                    config.MiroTalk.SFU.Visible = true;
                    config.MiroTalk.C2C.Visible = true;
                    config.MiroTalk.BRO.Visible = true;
                } else {
                    const allowP2P = config.MiroTalk.P2P.Visible && (allow.includes('P2P') || allow.includes('ALL'));
                    const allowSFU = config.MiroTalk.SFU.Visible && (allow.includes('SFU') || allow.includes('ALL'));
                    const allowC2C = config.MiroTalk.C2C.Visible && (allow.includes('C2C') || allow.includes('ALL'));
                    const allowBRO = config.MiroTalk.BRO.Visible && (allow.includes('BRO') || allow.includes('ALL'));

                    elemDisplay(navP2P, allowP2P);
                    elemDisplay(navSFU, allowSFU);
                    elemDisplay(navC2C, allowC2C);
                    elemDisplay(navBRO, allowBRO);
                }
            }
            toggleElements();
            hideElements();
            showDataTable();
        })
        .catch((err) => {
            console.error('[API] - USER ROLES GET ERROR', err);
            popupMessage('error', `USER ROLES GET error: ${err.message}`);
        });
}

function toggleElements() {
    elemDisplay(navP2P, config.MiroTalk.P2P.Visible);
    elemDisplay(navSFU, config.MiroTalk.SFU.Visible);
    elemDisplay(navC2C, config.MiroTalk.C2C.Visible);
    elemDisplay(navBRO, config.MiroTalk.BRO.Visible);
    elemDisplay(boxP2P, config.MiroTalk.P2P.GitHub.Visible);
    elemDisplay(boxSFU, config.MiroTalk.SFU.GitHub.Visible);
    elemDisplay(boxC2C, config.MiroTalk.C2C.GitHub.Visible);
    elemDisplay(boxBRO, config.MiroTalk.BRO.GitHub.Visible);
    if (
        !config.MiroTalk.P2P.Visible &&
        !config.MiroTalk.SFU.Visible &&
        !config.MiroTalk.C2C.Visible &&
        !config.MiroTalk.BRO.Visible
    ) {
        elemDisplay(openAddBtn, false);
        elemDisplay(delAllBtn, false);
        elemDisplay(refreshBtn, false);
    }
    if (
        !config.MiroTalk.P2P.GitHub.Visible &&
        !config.MiroTalk.SFU.GitHub.Visible &&
        !config.MiroTalk.C2C.GitHub.Visible &&
        !config.MiroTalk.BRO.GitHub.Visible
    ) {
        elemDisplay(boxesDS, false);
        elemDisplay(statsProjectsSection, false);
    }
    const dropdownOptions = addTypeDropdown.querySelectorAll('.custom-dropdown-option');
    dropdownOptions.forEach((opt) => {
        const val = opt.dataset.value;
        if (val === 'P2P' && !config.MiroTalk.P2P.Visible) opt.remove();
        else if (val === 'SFU' && !config.MiroTalk.SFU.Visible) opt.remove();
        else if (val === 'C2C' && !config.MiroTalk.C2C.Visible) opt.remove();
        else if (val === 'BRO' && !config.MiroTalk.BRO.Visible) opt.remove();
    });
    const firstOpt = addTypeDropdown.querySelector('.custom-dropdown-option');
    if (firstOpt) {
        firstOpt.classList.add('selected');
        addType.value = firstOpt.dataset.value;
        addTypeDropdown.querySelector('.custom-dropdown-value').textContent = firstOpt.textContent;
    }
}

function hideElements() {
    if (!html.projects) {
        elemDisplay(boxesDS, false);
        elemDisplay(statsProjectsSection, false);
    }
    !html.profile && elemDisplay(myProfile, false);
    !html.support && elemDisplay(navSup, false);
    //...
}

const toggleCheckbox = modeToggle.querySelector('.toggle-checkbox');
if (body.classList.contains('dark')) toggleCheckbox.checked = true;

toggleCheckbox.addEventListener('change', () => {
    body.classList.toggle('dark');
    const isDark = body.classList.contains('dark');
    window.localStorage.mode = isDark ? 'dark' : 'light';
    topModeToggle.querySelector('i').className = isDark ? 'uil uil-sun' : 'uil uil-moon';
    updateFlatpickrTheme();
});

topModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark');
    const isDark = body.classList.contains('dark');
    window.localStorage.mode = isDark ? 'dark' : 'light';
    toggleCheckbox.checked = isDark;
    topModeToggle.querySelector('i').className = isDark ? 'uil uil-sun' : 'uil uil-moon';
    updateFlatpickrTheme();
});

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('close');
    window.localStorage.status = sidebar.classList.contains('close') ? 'close' : 'open';
});

// Custom dropdown helpers
function buildCustomDropdownHTML(id, options, selectedValue, translate, disabled) {
    const noTranslate = translate === false ? ' translate="no"' : '';
    const disabledClass = disabled ? ' cd-disabled' : '';
    const selectedLabel = (options.find((o) => o.value === selectedValue) || options[0] || { label: '' }).label;
    let optionsHTML = '';
    options.forEach((o) => {
        const sel = o.value === selectedValue ? ' selected' : '';
        optionsHTML += `<div class="custom-dropdown-option${sel}" data-value="${o.value}"${noTranslate}>${o.label}</div>`;
    });
    return (
        `<span data-search="${selectedLabel}">` +
        `<div class="custom-dropdown${disabledClass}" data-dropdown-id="${id}">` +
        `<div class="custom-dropdown-trigger" tabindex="0">` +
        `<span class="custom-dropdown-value"${noTranslate}>${selectedLabel}</span>` +
        `<i class="uil uil-angle-down custom-dropdown-arrow"></i>` +
        `</div>` +
        `<div class="custom-dropdown-options">${optionsHTML}</div>` +
        `<input type="hidden" id="${id}" value="${selectedValue}" />` +
        `</div>` +
        `</span>`
    );
}

function positionDropdownOptions(dd) {
    const trigger = dd.querySelector('.custom-dropdown-trigger');
    const opts = dd.querySelector('.custom-dropdown-options');
    const rect = trigger.getBoundingClientRect();
    opts.style.left = rect.left + 'px';
    opts.style.width = rect.width + 'px';
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 210) {
        opts.style.top = '';
        opts.style.bottom = window.innerHeight - rect.top + 4 + 'px';
    } else {
        opts.style.top = rect.bottom + 4 + 'px';
        opts.style.bottom = '';
    }
}

function initCustomDropdowns(container) {
    const root = container || document;
    root.querySelectorAll('.custom-dropdown:not(.cd-ready)').forEach((dd) => {
        dd.classList.add('cd-ready');
        if (dd.classList.contains('cd-disabled')) return;
        const trigger = dd.querySelector('.custom-dropdown-trigger');
        const selectOption = (opt) => {
            dd.querySelectorAll('.custom-dropdown-option').forEach((o) => o.classList.remove('selected'));
            opt.classList.add('selected');
            const hidden = dd.querySelector('input[type="hidden"]');
            if (hidden) hidden.value = opt.dataset.value;
            dd.querySelector('.custom-dropdown-value').textContent = opt.textContent;
            const searchWrapper = dd.closest('[data-search]');
            if (searchWrapper) searchWrapper.dataset.search = opt.textContent;
            dd.classList.remove('open');
            trigger.focus();
        };
        trigger.addEventListener('click', () => {
            dd.classList.toggle('open');
            if (dd.classList.contains('open')) positionDropdownOptions(dd);
        });
        trigger.addEventListener('keydown', (e) => {
            const opts = [...dd.querySelectorAll('.custom-dropdown-option')];
            if (!opts.length) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!dd.classList.contains('open')) {
                    dd.classList.add('open');
                    positionDropdownOptions(dd);
                    const cur = dd.querySelector('.custom-dropdown-option.selected') || opts[0];
                    cur.classList.add('focused');
                } else {
                    const focused = dd.querySelector('.custom-dropdown-option.focused');
                    if (focused) selectOption(focused);
                }
            } else if (e.key === 'Escape') {
                dd.classList.remove('open');
                opts.forEach((o) => o.classList.remove('focused'));
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!dd.classList.contains('open')) {
                    dd.classList.add('open');
                    positionDropdownOptions(dd);
                }
                const focused = dd.querySelector('.custom-dropdown-option.focused');
                let idx = focused ? opts.indexOf(focused) : -1;
                opts.forEach((o) => o.classList.remove('focused'));
                idx = e.key === 'ArrowDown' ? Math.min(idx + 1, opts.length - 1) : Math.max(idx - 1, 0);
                opts[idx].classList.add('focused');
                opts[idx].scrollIntoView({ block: 'nearest' });
            }
        });
        dd.querySelectorAll('.custom-dropdown-option').forEach((opt) => {
            opt.addEventListener('click', () => selectOption(opt));
        });
    });
}

document.addEventListener('click', (e) => {
    document.querySelectorAll('.custom-dropdown.open').forEach((dd) => {
        if (!dd.contains(e.target)) {
            dd.classList.remove('open');
            dd.querySelectorAll('.custom-dropdown-option.focused').forEach((o) => o.classList.remove('focused'));
        }
    });
});

// Button loading state helpers
function btnLoading(btn, label) {
    btn._origHTML = btn.innerHTML;
    btn._origOnclick = btn.getAttribute('onclick');
    btn.disabled = true;
    if (btn.classList.contains('action-icon')) {
        // Store original classes and swap icon class for spinner
        btn._origClass = btn.className;
        btn.className = 'action-icon loading';
        btn.removeAttribute('onclick');
        btn.style.pointerEvents = 'none';
        btn.innerHTML = '<span class="btn-spinner"></span>';
    } else {
        btn.innerHTML = `<span class="btn-spinner"></span> ${label || 'Loading...'}`;
    }
}

function btnReset(btn) {
    btn.disabled = false;
    if (btn._origClass) {
        btn.className = btn._origClass;
        btn._origClass = null;
    }
    if (btn._origOnclick) {
        btn.setAttribute('onclick', btn._origOnclick);
        btn._origOnclick = null;
    }
    btn.style.pointerEvents = '';
    if (btn._origHTML != null) btn.innerHTML = btn._origHTML;
}

// Row flash feedback
function flashRow(row, color = 'rgba(76, 175, 80, 0.15)') {
    if (!row) return;
    row.style.transition = 'background-color 0.3s';
    row.style.backgroundColor = color;
    setTimeout(() => {
        row.style.backgroundColor = '';
    }, 1500);
}

initCustomDropdowns();

navOverview.addEventListener('click', () => {
    navShow([dsOverview], navOverview);
});

navDash.addEventListener('click', () => {
    navShow([dsRooms], navDash);
});

navUsers.addEventListener('click', () => {
    navShow([dsUsers], navUsers);
    loadUsers();
});

navP2P.addEventListener('click', () => {
    navShow([p2p], navP2P);
    //p2pIframe.setAttribute('src', config.MiroTalk.P2P.Room);
});

navSFU.addEventListener('click', () => {
    navShow([sfu], navSFU);
    //sfuIframe.setAttribute('src', config.MiroTalk.SFU.Room);
});

navC2C.addEventListener('click', () => {
    navShow([c2c], navC2C);
    //c2cIframe.setAttribute('src', config.MiroTalk.C2C.Home);
});

navBRO.addEventListener('click', () => {
    navShow([bro], navBRO);
    //broIframe.setAttribute('src', config.MiroTalk.BRO.Home);
});

navSup.addEventListener('click', () => {
    openURL(config.Author.Support, true);
});

navAcc.addEventListener('click', () => {
    getMyAccount();
});

navSet.addEventListener('click', () => {
    toggleSettings();
});

openAddBtn.addEventListener('click', () => {
    resetFormValues();
    toggleAddRows();
});
closeAddBtn.addEventListener('click', () => {
    toggleAddRows();
});
addRowBtn.addEventListener('click', () => {
    addRow();
});
genRoom.addEventListener('click', (e) => {
    e.preventDefault();
    addRoom.value = getUUID4();
});

refreshBtn.addEventListener('click', () => {
    refreshPage();
});

btnRefreshStats.addEventListener('click', () => {
    btnRefreshStats.classList.add('spinning');
    loadDashboardStats();
    setTimeout(() => btnRefreshStats.classList.remove('spinning'), 600);
});

delAllBtn.addEventListener('click', () => {
    delAllRows();
});

accountClose.addEventListener('click', () => {
    toggleAccount();
});
accountDelete.addEventListener('click', () => {
    delMyAccount();
});

settingsClose.addEventListener('click', () => {
    toggleSettings();
});

openAddUserBtn.addEventListener('click', () => {
    resetAddUserForm();
    toggleAddUserPanel();
});
closeAddUserBtn.addEventListener('click', () => {
    toggleAddUserPanel();
});
addUserBtn.addEventListener('click', () => {
    createUser();
});
refreshUsersBtn.addEventListener('click', () => {
    loadUsers();
    popupMessage('toast', 'Users refreshed');
});

document.getElementById('usersSearchInput').addEventListener('keyup', function () {
    usersDataTable.search(this.value).draw();
});

const svcAllCheckbox = document.getElementById('add-user-svc-all');
const svcIndividual = ['add-user-svc-p2p', 'add-user-svc-sfu', 'add-user-svc-c2c', 'add-user-svc-bro'].map((id) =>
    document.getElementById(id)
);

svcAllCheckbox.addEventListener('change', () => {
    if (svcAllCheckbox.checked) {
        svcIndividual.forEach((cb) => (cb.checked = false));
    }
});

svcIndividual.forEach((cb) => {
    cb.addEventListener('change', () => {
        if (cb.checked) {
            svcAllCheckbox.checked = false;
        }
        if (!svcIndividual.some((c) => c.checked)) {
            svcAllCheckbox.checked = true;
        }
    });
});

function navShow(elements = [], activeNav = null) {
    elemDisplay(dsOverview, false);
    elemDisplay(dsRooms, false);
    elemDisplay(dsUsers, false);
    elemDisplay(p2p, false);
    elemDisplay(sfu, false);
    elemDisplay(c2c, false);
    elemDisplay(bro, false);
    elements.forEach((element, i) => {
        element.style.display = 'block';
    });
    document.querySelectorAll('.nav-links li a').forEach((a) => a.classList.remove('active'));
    if (activeNav) activeNav.classList.add('active');
}

document.getElementById('myInput').addEventListener('keyup', function () {
    dataTable.search(this.value).draw();
});

function toggleAddRows() {
    if (addRowDiv.classList.contains('show')) {
        animateCSS(addRowDiv, 'fadeOutRight').then((ok) => {
            addRowDiv.classList.toggle('show');
            hideBackdrop();
        });
    } else {
        addRowDiv.classList.toggle('show');
        showBackdrop();
        animateCSS(addRowDiv, 'fadeInRight');
    }
}

function toggleAccount() {
    if (accountDiv.classList.contains('show')) {
        animateCSS(accountDiv, 'fadeOutRight').then((ok) => {
            accountDiv.classList.toggle('show');
            hideBackdrop();
        });
    } else {
        accountDiv.classList.toggle('show');
        showBackdrop();
        animateCSS(accountDiv, 'fadeInRight');
    }
}

function toggleSettings() {
    if (settingsDiv.classList.contains('show')) {
        animateCSS(settingsDiv, 'fadeOutRight').then((ok) => {
            settingsDiv.classList.toggle('show');
            hideBackdrop();
        });
    } else {
        settingsDiv.classList.toggle('show');
        showBackdrop();
        animateCSS(settingsDiv, 'fadeInRight');
    }
}

function toggleAddUserPanel() {
    if (addUserDiv.classList.contains('show')) {
        animateCSS(addUserDiv, 'fadeOutRight').then((ok) => {
            addUserDiv.classList.toggle('show');
            hideBackdrop();
        });
    } else {
        addUserDiv.classList.toggle('show');
        showBackdrop();
        animateCSS(addUserDiv, 'fadeInRight');
    }
}

function showBackdrop() {
    panelBackdrop.classList.remove('hidden');
    requestAnimationFrame(() => panelBackdrop.classList.add('show'));
}

function hideBackdrop() {
    panelBackdrop.classList.remove('show');
    panelBackdrop.addEventListener('transitionend', () => panelBackdrop.classList.add('hidden'), { once: true });
}

panelBackdrop.addEventListener('click', () => {
    if (addRowDiv.classList.contains('show')) toggleAddRows();
    if (accountDiv.classList.contains('show')) toggleAccount();
    if (settingsDiv.classList.contains('show')) toggleSettings();
    if (addUserDiv.classList.contains('show')) toggleAddUserPanel();
});

function resetAddUserForm() {
    addUserUsername.value = '';
    addUserEmail.value = '';
    addUserPassword.value = '';
    addUserRooms.value = '*';
    document.getElementById('add-user-svc-all').checked = true;
    document.getElementById('add-user-svc-p2p').checked = false;
    document.getElementById('add-user-svc-sfu').checked = false;
    document.getElementById('add-user-svc-c2c').checked = false;
    document.getElementById('add-user-svc-bro').checked = false;
}

function loadUsers() {
    userGetAll()
        .then((users) => {
            console.log('[API] - USER GET ALL RESPONSE', users);
            usersDataTable.clear();

            // Reset users filter to All
            $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter((fn) => !fn._isUserFilter);
            document.querySelectorAll('.users-filter-chip').forEach((c) => c.classList.remove('active'));
            const allChip = document.querySelector('.users-filter-chip[data-filter="all"]');
            if (allChip) allChip.classList.add('active');

            if (users && users.length > 0) {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const d7 = new Date(now);
                d7.setDate(d7.getDate() - 7);
                const d30 = new Date(now);
                d30.setDate(d30.getDate() - 30);
                let todayCount = 0,
                    days7Count = 0,
                    days30Count = 0;
                users.forEach((u) => {
                    const row = getUserRow(u);
                    const rowNode = usersDataTable.row.add(row).node();
                    rowNode.id = 'user_' + u._id;
                    if (u.createdAt) {
                        const created = new Date(u.createdAt);
                        if (created.toISOString().split('T')[0] === today) todayCount++;
                        if (created >= d7) days7Count++;
                        if (created >= d30) days30Count++;
                    }
                });
                document.getElementById('usersCountAll').textContent = `(${users.length})`;
                document.getElementById('usersCountToday').textContent = `(${todayCount})`;
                document.getElementById('usersCount7Days').textContent = `(${days7Count})`;
                document.getElementById('usersCount30Days').textContent = `(${days30Count})`;
                usersDataTable.columns.adjust().draw();
                toggleUsersList(true);
                initUsersToolTips(users);
                initCustomDropdowns(document.getElementById('usersTable'));
            } else {
                document.getElementById('usersCountAll').textContent = '(0)';
                document.getElementById('usersCountToday').textContent = '(0)';
                document.getElementById('usersCount7Days').textContent = '(0)';
                document.getElementById('usersCount30Days').textContent = '(0)';
                usersDataTable.columns.adjust().draw();
                toggleUsersList(false);
            }
        })
        .catch((err) => {
            console.error('[API] - USER GET ALL ERROR', err);
            popupMessage('error', `Failed to load users: ${err.message}`);
        });
}

function toggleUsersList(hasData) {
    const emptyState = document.getElementById('usersEmptyState');
    const tableWrapper = document.getElementById('usersTable_wrapper');
    elemDisplay(emptyState, !hasData);
    if (tableWrapper) tableWrapper.style.display = hasData ? '' : 'none';
}

function getUserRow(u) {
    const isSelf = u._id === userId;
    const activeChecked = u.active ? 'checked' : '';
    const selfDisabled = isSelf ? 'disabled' : '';
    const userAllow = Array.isArray(u.allow) ? u.allow : ['ALL'];
    const roomsStr = Array.isArray(u.allowedRooms) ? u.allowedRooms.join(', ') : '*';
    const createdDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-';
    const createdISO = u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '';

    const services = ['ALL', 'P2P', 'SFU', 'C2C', 'BRO'];

    const roleOptions = [
        { value: 'admin', label: 'admin' },
        { value: 'guest', label: 'guest' },
    ];
    const allowDropdownOptions = services.map((s) => ({ value: s, label: s }));
    const selectedAllow = userAllow[0] || 'ALL';

    const userInlineIcons = [];
    userInlineIcons.push(
        `<i id="usave_${u._id}" onclick="saveUser('${u._id}')" class="uil uil-save action-icon" title="Save"></i>`
    );
    if (!isSelf) {
        userInlineIcons.push(
            `<i id="udel_${u._id}" onclick="deleteUser('${u._id}')" class="uil uil-trash-alt action-icon danger" title="Delete"></i>`
        );
    }

    const actionsHtml = `<span class="action-group">${userInlineIcons.join('')}</span>`;

    return [
        `<input id="uname_${u._id}" type="text" value="${escapeHtml(u.username)}" readonly />`,
        `<input id="uemail_${u._id}" type="email" value="${escapeHtml(u.email)}" readonly />`,
        buildCustomDropdownHTML('urole_' + u._id, roleOptions, u.role, true, isSelf),
        buildCustomDropdownHTML('uallow_' + u._id, allowDropdownOptions, selectedAllow),
        `<input id="urooms_${u._id}" type="text" value="${escapeHtml(roomsStr)}" />`,
        `<label class="user-active-badge ${u.active ? 'active' : 'inactive'}">
            <input id="uactive_${u._id}" type="checkbox" ${activeChecked} ${selfDisabled} onchange="this.parentElement.className='user-active-badge '+(this.checked?'active':'inactive');this.parentElement.querySelector('span').textContent=this.checked?'Active':'Inactive'" />
            <span>${u.active ? 'Active' : 'Inactive'}</span>
        </label>`,
        `<span data-date="${createdISO}">${createdDate}</span>`,
        actionsHtml,
    ];
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initUsersToolTips(users) {
    // Tooltips not needed — dropdown action items are labeled
}

function saveUser(id) {
    const role = document.getElementById(`urole_${id}`).value;
    const roomsRaw = document.getElementById(`urooms_${id}`).value.trim();
    const active = document.getElementById(`uactive_${id}`).checked;

    const allow = [document.getElementById(`uallow_${id}`).value];
    const allowedRooms = roomsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const data = { role, allow, allowedRooms, active };

    function doSave() {
        const saveBtn = document.getElementById(`usave_${id}`);
        if (saveBtn) btnLoading(saveBtn);

        userUpdate(id, data)
            .then((res) => {
                console.log('[API] - USER UPDATE RESPONSE', res);
                if (res && res.message) {
                    popupMessage('warning', res.message);
                } else {
                    popupMessage('toast', 'User updated successfully');
                    loadUsers();
                    loadDashboardStats();
                    setTimeout(() => {
                        flashRow(document.getElementById('user_' + id));
                    }, 300);
                }
            })
            .catch((err) => {
                console.error('[API] - USER UPDATE ERROR', err);
                popupMessage('error', `Failed to update user: ${err.message}`);
            })
            .finally(() => {
                if (saveBtn) btnReset(saveBtn);
            });
    }

    if (role === 'admin' && id !== userId) {
        Swal.fire({
            allowOutsideClick: false,
            allowEscapeKey: false,
            position: 'top',
            icon: 'warning',
            title: 'Assign admin role',
            text: 'Are you sure you want to assign the admin role to this user?',
            showDenyButton: true,
            confirmButtonText: 'Yes',
            denyButtonText: 'No',
            showClass: { popup: 'animate__animated animate__fadeInDown' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        }).then((result) => {
            if (result.isConfirmed) doSave();
        });
    } else {
        doSave();
    }
}

function deleteUser(id) {
    if (id === userId) {
        popupMessage('warning', 'You cannot delete your own account from here. Use Account settings.');
        return;
    }
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'top',
        icon: 'warning',
        title: 'Delete user',
        text: 'Are you sure you want to delete this user and all their associated data?',
        showDenyButton: true,
        confirmButtonText: 'Yes',
        denyButtonText: 'No',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            userDelete(id)
                .then((res) => {
                    console.log('[API] - USER DELETE RESPONSE', res);
                    popupMessage('toast', 'User deleted successfully');
                    loadUsers();
                    loadDashboardStats();
                })
                .catch((err) => {
                    console.error('[API] - USER DELETE ERROR', err);
                    popupMessage('error', `Failed to delete user: ${err.message}`);
                });
        }
    });
}

function createUser() {
    const username = addUserUsername.value.trim();
    const email = addUserEmail.value.trim().toLowerCase();
    const password = addUserPassword.value;
    const roomsRaw = addUserRooms.value.trim();

    if (!username || !email || !password) {
        popupMessage('warning', 'Username, email, and password are required');
        return;
    }

    const allow = [];
    if (document.getElementById('add-user-svc-all').checked) allow.push('ALL');
    if (document.getElementById('add-user-svc-p2p').checked) allow.push('P2P');
    if (document.getElementById('add-user-svc-sfu').checked) allow.push('SFU');
    if (document.getElementById('add-user-svc-c2c').checked) allow.push('C2C');
    if (document.getElementById('add-user-svc-bro').checked) allow.push('BRO');
    if (allow.length === 0) allow.push('ALL');

    const allowedRooms = roomsRaw
        ? roomsRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : ['*'];

    const data = { username, email, password };

    btnLoading(addUserBtn, 'Creating...');

    userCreate(data)
        .then((res) => {
            console.log('[API] - USER CREATE RESPONSE', res);
            if (res && res.message && !res._id) {
                popupMessage('info', res.message);
            } else if (res && res._id) {
                // Update the user with allow and allowedRooms
                userUpdate(res._id, { username, allow, allowedRooms })
                    .then(() => {
                        popupMessage('toast', 'User created successfully');
                        toggleAddUserPanel();
                        loadUsers();
                        loadDashboardStats();
                    })
                    .catch((err) => {
                        console.error('[API] - USER UPDATE AFTER CREATE ERROR', err);
                        popupMessage('warning', 'User created but permissions update failed');
                        toggleAddUserPanel();
                        loadUsers();
                    });
            }
        })
        .catch((err) => {
            console.error('[API] - USER CREATE ERROR', err);
            const msg = err.response?.data?.message || err.message;
            popupMessage('error', `Failed to create user: ${msg}`);
        })
        .finally(() => {
            btnReset(addUserBtn);
        });
}

async function showDataTable() {
    navDash.click();

    roomFindBy(userId)
        .then((res) => {
            console.log('[API] - GET ALL ROOMS RESPONSE', res);
            if (res && res.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                res.forEach((obj) => {
                    const tableRow = getRow(obj);
                    if (tableRow) {
                        const rowNode = dataTable.row.add(tableRow).node();
                        rowNode.id = obj._id;
                        if (obj.date < today) rowNode.classList.add('room-past');
                        else if (obj.date === today) rowNode.classList.add('room-today');
                    }
                });
                dataTable.draw();
                initVisibleRowsFlatpickr();
                toggleRoomsList(true);

                const pastRooms = res.filter((obj) => obj.date < today);
                if (pastRooms.length > 0) {
                    Swal.fire({
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        position: 'top',
                        icon: 'warning',
                        title: 'Expired rooms found',
                        text: `You have ${pastRooms.length} expired room${pastRooms.length > 1 ? 's' : ''}. Would you like to delete them?`,
                        showDenyButton: true,
                        confirmButtonText: 'Yes, delete',
                        denyButtonText: 'No, keep',
                        showClass: { popup: 'animate__animated animate__fadeInDown' },
                        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
                    }).then((result) => {
                        if (result.isConfirmed) {
                            const pastIds = pastRooms.map((r) => r._id);
                            Promise.all(pastIds.map((id) => roomDelete(id)))
                                .then(() => {
                                    console.log('[API] - DELETE PAST ROOMS RESPONSE', pastIds);
                                    pastIds.forEach((id) => dataTable.row(`#${id}`).remove());
                                    dataTable.draw();
                                    toggleRoomsList(dataTable.rows().count() > 0);
                                    debouncedLoadStats();
                                    popupMessage(
                                        'toast',
                                        `${pastIds.length} expired room${pastIds.length > 1 ? 's' : ''} deleted`
                                    );
                                })
                                .catch((err) => {
                                    console.log('[API] - DELETE PAST ROOMS ERROR', err);
                                    popupMessage('error', `Failed to delete expired rooms: ${err.message}`);
                                });
                        }
                    });
                }
            } else {
                toggleRoomsList(false);
            }
        })
        .catch((err) => {
            console.error('[API] - GET ALL ROOMS ERROR', err);
            popupMessage('error', `API GET ALL ROOMS error: ${err.message}`);
        });
}

function addRow() {
    const data = getFormValues();

    if (!data.tag || !data.email || !data.date || !data.time || !data.room) {
        return false;
    }

    btnLoading(addRowBtn, 'Creating...');

    roomCreate(data)
        .then((res) => {
            console.log('[API] - ROOM CREATE RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
                removeLastRow();
            } else {
                const tableRow = getRow(res);
                if (tableRow) {
                    dataTable.row.add(tableRow).node().id = res._id;
                    dataTable.draw();
                    addRowToolTips(res._id);
                    initVisibleRowsFlatpickr();
                    toggleAddRows();
                    toggleRoomsList(true);
                    debouncedLoadStats();
                }
            }
        })
        .catch((err) => {
            console.error('[API] - ROOM CREATE ERROR', err);
            popupMessage('error', `API ROOM CREATE error: ${err.message}`);
        })
        .finally(() => {
            btnReset(addRowBtn);
        });
}

function getRow(obj) {
    if (
        !config.MiroTalk.P2P.Visible &&
        !config.MiroTalk.SFU.Visible &&
        !config.MiroTalk.C2C.Visible &&
        !config.MiroTalk.BRO.Visible
    )
        return;

    const today = new Date().toISOString().split('T')[0];
    const isPast = obj.date < today;

    // Inline primary actions (1-click)
    const inlineIcons = [];
    if (config.BUTTONS.updateRow && !isPast) {
        inlineIcons.push(
            `<i id="${obj._id}_save" onclick="updateRow('${obj._id}')" class="uil uil-save action-icon" title="Save"></i>`
        );
    }
    if (config.BUTTONS.delRow) {
        inlineIcons.push(
            `<i id="${obj._id}_delete" onclick="delRow('${obj._id}')" class="uil uil-trash-alt action-icon danger" title="Delete"></i>`
        );
    }

    // Dropdown secondary actions (skip entirely for past rooms)
    const actionItems = [];

    if (!isPast) {
        if (config.BUTTONS.copyRoom) {
            actionItems.push(
                `<button id="${obj._id}_copy" class="action-dropdown-item" onclick="copyRoom('${obj._id}'); closeActionDropdown(this);"><i class="uil uil-copy"></i> Copy Room</button>`
            );
        }
        if (config.BUTTONS.shareRoom && isMobile) {
            actionItems.push(
                `<button id="${obj._id}_share" class="action-dropdown-item" onclick="shareRoom('${obj._id}'); closeActionDropdown(this);"><i class="uil uil-share-alt"></i> Share Room</button>`
            );
        }
        if (config.BUTTONS.setRandomRoom && user.allowedRoomsALL) {
            actionItems.push(
                `<button id="${obj._id}_randomRoom" class="action-dropdown-item" onclick="setRandomRoom('${obj._id}'); closeActionDropdown(this);"><i class="uil uil-redo"></i> Random Room</button>`
            );
        }

        if (actionItems.length > 0 && (config.BUTTONS.sendEmail || config.BUTTONS.sendSmSInvitation)) {
            actionItems.push(`<div class="action-dropdown-divider"></div>`);
        }

        if (config.BUTTONS.sendEmail) {
            actionItems.push(
                `<button id="${obj._id}_send_email" class="action-dropdown-item" onclick="sendEmail('${obj._id}'); closeActionDropdown(this);"><i class="uil uil-envelope-open"></i> Send Email</button>`
            );
        }
        if (config.BUTTONS.sendSmSInvitation) {
            actionItems.push(
                `<button id="${obj._id}_send_sms" class="action-dropdown-item" onclick="sendSmSInvitation('${obj._id}'); closeActionDropdown(this);"><i class="uil uil-comment-alt-message"></i> Send SMS</button>`
            );
        }

        if (config.BUTTONS.joinInternal || config.BUTTONS.joinExternal) {
            if (actionItems.length > 0) actionItems.push(`<div class="action-dropdown-divider"></div>`);
        }

        if (config.BUTTONS.joinInternal) {
            actionItems.push(
                `<button id="${obj._id}_joinInternal" class="action-dropdown-item" onclick="joinRoom('${obj._id}'); closeActionDropdown(this);"><i class="uil uil-estate"></i> Join Internal</button>`
            );
        }
        if (config.BUTTONS.joinExternal) {
            actionItems.push(
                `<button id="${obj._id}_joinExternal" class="action-dropdown-item" onclick="joinRoom('${obj._id}', true); closeActionDropdown(this);"><i class="uil uil-external-link-alt"></i> Join External</button>`
            );
        }
    }

    let rooms = `<input id="${obj._id}_room" type="text" placeholder="Room name" name="room" value="${obj.room}"${isPast ? ' readonly' : ''}/>`;

    if (!user.allowedRoomsALL) {
        const roomOptions = user.allowedRooms.map((room) => ({ value: room, label: room }));
        rooms = buildCustomDropdownHTML(obj._id + '_room', roomOptions, obj.room, false, isPast);
    }

    const typeOptions = [
        config.MiroTalk.P2P.Visible && { value: 'P2P', label: 'P2P' },
        config.MiroTalk.SFU.Visible && { value: 'SFU', label: 'SFU' },
        config.MiroTalk.C2C.Visible && { value: 'C2C', label: 'C2C' },
        config.MiroTalk.BRO.Visible && { value: 'BRO', label: 'BRO' },
    ].filter(Boolean);

    const ro = isPast ? ' readonly' : '';

    return [
        `<td>${buildCustomDropdownHTML(obj._id + '_type', typeOptions, obj.type, false, isPast)}</td>`,
        `<td><input id="${obj._id}_tag" type="text" name="tag" placeholder="Tag" value="${obj.tag}"${ro}/></td>`,
        `<td><input id="${obj._id}_email" type="email" name="email" placeholder="Email address" value="${obj.email}"${ro}/></td>`,
        `<td><input id="${obj._id}_phone" type="text" name="text" placeholder="Phone number" value="${obj.phone}"${ro}/></td>`,
        `<td><input id="${obj._id}_date" type="text" name="date" placeholder="Date" value="${obj.date}" class="flatpickr-date"${ro}/></td>`,
        `<td><input id="${obj._id}_time" type="text" name="time" placeholder="Time" value="${obj.time}" class="flatpickr-time"${ro}/></td>`,
        `<td>${rooms}</td>`,
        `<td>
            <div class="action-cell">
                <span class="action-group">${inlineIcons.join('')}</span>
                ${
                    actionItems.length > 0
                        ? `
                <div class="action-dropdown-wrap">
                    <button class="action-dropdown-trigger" onclick="toggleActionDropdown(this)" aria-label="More actions">
                        <i class="uil uil-ellipsis-v"></i>
                    </button>
                    <div class="action-dropdown-menu">
                        ${actionItems.join('\n                        ')}
                    </div>
                </div>`
                        : ''
                }
            </div>
        </td>`,
    ];
}

function addRowToolTips(id) {
    // No tooltips needed — actions are now labeled inside dropdown menu
}

function toggleActionDropdown(triggerBtn) {
    const wrap = triggerBtn.closest('.action-dropdown-wrap');
    const menu = wrap.querySelector('.action-dropdown-menu');
    const isOpen = wrap.classList.contains('open');

    // Close all other open dropdowns first
    document.querySelectorAll('.action-dropdown-wrap.open').forEach((el) => {
        el.classList.remove('open');
    });

    if (!isOpen) {
        wrap.classList.add('open');

        // Position the menu using fixed coordinates
        const rect = triggerBtn.getBoundingClientRect();
        menu.style.top = rect.bottom + 4 + 'px';
        menu.style.left = 'auto';
        menu.style.right = window.innerWidth - rect.right + 'px';

        // If menu would overflow below viewport, show above instead
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            if (menuRect.bottom > window.innerHeight - 8) {
                menu.style.top = rect.top - menuRect.height - 4 + 'px';
            }
        });

        // Close on outside click
        const closeHandler = (e) => {
            if (!wrap.contains(e.target)) {
                wrap.classList.remove('open');
                document.removeEventListener('click', closeHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
    }
}

function closeActionDropdown(itemBtn) {
    const wrap = itemBtn.closest('.action-dropdown-wrap');
    if (wrap) wrap.classList.remove('open');
}

function initVisibleRowsToolTips() {
    dataTable.rows({ page: 'current' }).every(function () {
        const id = this.node().id;
        if (id) addRowToolTips(id);
    });
}

function setRandomRoom(id) {
    const room = document.getElementById(id + '_room');
    room.value = getUUID4();
}

function copyRoom(id) {
    const data = getRowValues(id);
    const roomURL = getRoomURL(data);

    navigator.clipboard.writeText(roomURL).then(
        () => {
            console.log(`The roomURL: ${roomURL} \n has been successfully copied to the clipboard 👍`);
            popupMessage(
                'copyRoom',
                `<br/>
                <div id="qrRoomContainer">
                    <canvas id="qrRoom"></canvas>
                </div>
                <br/>
                <p class="txt-green">Join from your mobile device</p>
                <br/>
                <p class="txt-qr">No need for apps, simply capture the QR code with your mobile camera Or Invite someone else to join by sending them the following URL</p>
                <br/>
                <p class="txt-green">${roomURL}</p>`
            );
            makeRoomQR(roomURL);
        },
        (err) => {
            console.error('Could not copy text: ', err);
        }
    );
}

function makeRoomQR(room) {
    const qr = new QRious({
        element: document.getElementById('qrRoom'),
        value: room,
    });
    qr.set({
        size: 256,
    });
}

async function shareRoom(id) {
    const data = getRowValues(id);
    const roomURL = getRoomURL(data, false);
    if (navigator.share) {
        try {
            await navigator.share({ url: roomURL });
        } catch (err) {
            console.error('[Error] navigator share', err);
        }
    } else {
        popupMessage('warning', 'Navigator Share is not supported on this device.');
    }
}

function sendEmail(id) {
    const newLine = '%0D%0A%0D%0A';
    const data = getRowValues(id);
    const roomURL = getRoomURL(data, false);
    const emailSubject = `Please join our MiroTalk ${data.type} Video Chat Meeting`;
    const emailBody = `The meeting is scheduled at: ${newLine} Date: ${data.date} ${newLine} Time: ${data.time} ${newLine} Click to join: ${roomURL} ${newLine}`;
    document.location = 'mailto:' + data.email + '?subject=' + emailSubject + '&body=' + emailBody;
}

function sendSmSInvitation(id) {
    const data = getRowValues(id);
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        showDenyButton: true,
        imageUrl: '../Images/sms.png',
        title: 'SMS Invitation',
        position: 'top',
        input: 'text',
        inputPlaceholder: 'Enter phone number: [Prefix][Number]',
        inputValue: `${data.phone}`,
        confirmButtonText: 'Send SMS',
        denyButtonText: 'Exit',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        inputValidator: async (phoneNumber) => {
            if (!phoneNumber) return 'Please enter phone number';
            const data = getRowValues(id);
            const roomURL = getRoomURL(data, false);
            const dataSmS = {
                message: `[${data.date}|${data.time}] MiroTalk: ${roomURL}`,
                toNumber: phoneNumber,
            };
            smsSend(dataSmS)
                .then((res) => {
                    console.log('[API] - SMS INVITATION RESPONSE', res);
                    if (res.message) {
                        popupMessage('warning', `${res.message}`);
                    } else {
                        popupMessage('success', `SMS Meeting Invitation Sent: ${res.sid}`);
                    }
                })
                .catch((err) => {
                    console.error('[API] - SMS INVITATION ERROR', err);
                    popupMessage('error', `API SMS INVITATION error: ${err.message}`);
                });
        },
    });
}

function joinRoom(id, external = false) {
    const data = getRowValues(id);
    const roomURL = getRoomURL(data);
    if (external) {
        openURL(roomURL, true);
    } else {
        switch (data.type) {
            case 'P2P':
                p2pIframe.setAttribute('src', roomURL);
                navShow([p2p]);
                break;
            case 'SFU':
                sfuIframe.setAttribute('src', roomURL);
                navShow([sfu]);
                break;
            case 'C2C':
                c2cIframe.setAttribute('src', roomURL);
                navShow([c2c]);
                break;
            case 'BRO':
                broIframe.setAttribute('src', roomURL);
                navShow([bro]);
                break;
            default:
                break;
        }
    }
}

function updateRow(id) {
    const data = getRowValues(id);
    const saveBtn = document.getElementById(`${id}_save`);

    if (saveBtn) btnLoading(saveBtn);

    roomUpdate(id, data)
        .then((res) => {
            console.log('[API] - UPDATE ROW RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
            } else {
                popupMessage('toast', 'Data saved successfully');
                debouncedLoadStats();
                flashRow(document.getElementById(id));
            }
        })
        .catch((err) => {
            console.log('[API] - UPDATE ROW ERROR', err);
            popupMessage('error', `API UPDATE ROW error: ${err.message}`);
            showDataTable();
        })
        .finally(() => {
            if (saveBtn) btnReset(saveBtn);
        });
}

function delRow(id) {
    const dataTableTR = document.getElementById(id);
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'top',
        icon: 'warning',
        title: 'Delete room',
        text: 'Are you sure you want to delete the room?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            roomDelete(id)
                .then((res) => {
                    console.log('[API] - DELETE ROW RESPONSE', res);
                    dataTable.row(`#${id}`).remove().draw();
                    toggleRoomsList(dataTable.rows().count() > 0);
                    debouncedLoadStats();
                })
                .catch((err) => {
                    console.log('[API] - DELETE ROW ERROR', err);
                    popupMessage('error', `API DELETE ROW error: ${err.message}`);
                });
        }
    });
}

function getActiveFilter() {
    const active = document.querySelector('.filter-chip.active');
    return active ? active.dataset.filter : 'all';
}

function getFilterLabel() {
    const filter = getActiveFilter();
    if (filter === 'today') return "today's";
    if (filter === 'upcoming') return 'upcoming';
    if (filter === 'past') return 'past';
    return 'all';
}

function delAllRows() {
    if (dataTable.rows().count() === 0) return;
    const filter = getActiveFilter();
    const label = getFilterLabel();

    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'top',
        icon: 'warning',
        title: `Delete ${label} rooms`,
        text: `Are you sure you want to delete ${label} rooms?`,
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            if (filter === 'all') {
                roomDeleteFindBy(userId)
                    .then((res) => {
                        console.log('[API] - DELETE ALL ROWS RESPONSE', res);
                        dataTable.clear().draw();
                        toggleRoomsList(false);
                        debouncedLoadStats();
                    })
                    .catch((err) => {
                        console.log('[API] - DELETE ALL ROWS ERROR', err);
                        popupMessage('error', `API DELETE ALL error: ${err.message}`);
                    });
            } else {
                const rowIds = [];
                dataTable.rows({ search: 'applied' }).every(function () {
                    rowIds.push(this.node().id);
                });
                if (rowIds.length === 0) {
                    popupMessage('info', `No ${label} rooms to delete`);
                    return;
                }
                Promise.all(rowIds.map((id) => roomDelete(id)))
                    .then(() => {
                        console.log(`[API] - DELETE ${label.toUpperCase()} ROWS RESPONSE`, rowIds);
                        rowIds.forEach((id) => dataTable.row(`#${id}`).remove());
                        dataTable.draw();
                        toggleRoomsList(dataTable.rows().count() > 0);
                        debouncedLoadStats();
                    })
                    .catch((err) => {
                        console.log(`[API] - DELETE ${label.toUpperCase()} ROWS ERROR`, err);
                        popupMessage('error', `API DELETE error: ${err.message}`);
                    });
            }
        }
    });
}

function removeRow(id) {
    dataTable.row(`#${id}`).remove().draw();
}

function removeLastRow() {
    const lastRowIndex = dataTable.rows().count() - 1;
    if (lastRowIndex >= 0) {
        dataTable.row(lastRowIndex).remove().draw();
    }
}

function getMyAccount() {
    const userPromise = isOidcMode ? userGetMe() : userGet(userId);
    userPromise
        .then((res) => {
            console.log('[API] - USER GET RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
            } else {
                accountID.value = res._id;
                accountEmail.value = res.email;
                accountUsername.value = res.username;
                accountCreatedAt.value = res.createdAt;
                accountUpdatedAt.value = res.updatedAt;
                accountServicesAllowed.value = res.allow;
                accountRoomsAllowed.value = res.allowedRooms;
                accountRole.value = res.role === 'admin' ? 'Admin' : 'Guest';
                accountRoleIcon.innerHTML =
                    res.role === 'admin'
                        ? '<i class="uil uil-shield-check admin-role-icon"></i>'
                        : '<i class="uil uil-user"></i>';
                toggleAccount();
            }
        })
        .catch((err) => {
            console.error('[API] - USER GET ERROR', err);
            popupMessage('error', `USER GET error: ${err.message}`);
        });
}

function delMyAccount() {
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'top',
        icon: 'warning',
        title: 'Delete account!',
        text: 'Are you sure to want delete your account and all associated data?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            userDelete(userId)
                .then((res) => {
                    console.log('[API] - USER DELETE RESPONSE', res);
                    openURL(isOidcMode ? '/logout' : '/');
                })
                .catch((err) => {
                    console.log('[API] - USER DELETE ERROR', err);
                    popupMessage('error', `API USER DELETE error: ${err.message}`);
                });
        }
    });
}

function refreshPage() {
    if (dataTable.rows().count() === 0) return;
    dataTable.clear().draw();
    showDataTable();
    loadDashboardStats();
    popupMessage('toast', 'Data refreshed');
}

function loadDashboardStats() {
    getDashboardStats()
        .then((data) => {
            console.log('[API] - DASHBOARD STATS RESPONSE', data);
            renderDashboardStats(data);
        })
        .catch((err) => {
            console.error('[API] - DASHBOARD STATS ERROR', err);
        });
}

function renderDashboardStats(data) {
    if (data.isAdmin) {
        elemDisplay(statsUsersSection, true);
        elemDisplay(statMemberSince, false);
        statTotalUsersVal.textContent = data.totalUsers;
        statActiveUsersVal.textContent = data.activeUsers;
        statInactiveUsersVal.textContent = data.inactiveUsers;
        statAdminsVal.textContent = data.adminCount;
        statGuestsVal.textContent = data.guestCount;
        statLatestUserVal.textContent = data.latestUser;
        statTotalRoomsVal.textContent = data.totalRooms;
        statTotalRoomsLabel.textContent = 'Total Rooms';
        statTodayVal.textContent = data.todayRooms;
        statTodayLabel.textContent = 'Today';
        statUpcomingVal.textContent = data.upcomingRooms;
        statUpcomingLabel.textContent = 'Upcoming';
        statsRoomsSectionTitle.textContent = 'Rooms';
        statsTypesSectionTitle.textContent = 'Room Types';
        statP2PVal.textContent = data.roomsByType.P2P;
        statSFUVal.textContent = data.roomsByType.SFU;
        statC2CVal.textContent = data.roomsByType.C2C;
        statBROVal.textContent = data.roomsByType.BRO;
    } else {
        elemDisplay(statsUsersSection, false);
        elemDisplay(statMemberSince, true);
        statMemberSinceVal.textContent = data.memberSince ? new Date(data.memberSince).toLocaleDateString() : '-';
        statTotalRoomsVal.textContent = data.myRooms;
        statTotalRoomsLabel.textContent = 'My Rooms';
        statTodayVal.textContent = data.myTodayRooms;
        statTodayLabel.textContent = 'Today';
        statUpcomingVal.textContent = data.myUpcomingRooms;
        statUpcomingLabel.textContent = 'Upcoming';
        statsRoomsSectionTitle.textContent = 'My Rooms';
        statsTypesSectionTitle.textContent = 'My Room Types';
        statP2PVal.textContent = data.myRoomsByType.P2P;
        statSFUVal.textContent = data.myRoomsByType.SFU;
        statC2CVal.textContent = data.myRoomsByType.C2C;
        statBROVal.textContent = data.myRoomsByType.BRO;
    }
}

function openURL(url, blank = false) {
    blank ? window.open(url, '_blank') : (window.location.href = url);
}

function getUUID4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
}

function getRoomURL(data, bro = true) {
    let roomURL;
    switch (data.type) {
        case 'P2P':
            roomURL = `${config.MiroTalk.P2P.Join}${data.room}`;
            break;
        case 'SFU':
            const name = window.localStorage.name || data.email;
            roomURL =
                tokens.sfu !== ''
                    ? `${config.MiroTalk.SFU.Join}?room=${data.room}&name=${name}&token=${tokens.sfu}`
                    : `${config.MiroTalk.SFU.Join}?room=${data.room}&name=${name}`;
            break;
        case 'C2C':
            roomURL = `${config.MiroTalk.C2C.Room}${data.room}`;
            break;
        case 'BRO':
            roomURL = bro
                ? `${config.MiroTalk.BRO.Broadcast}${data.room}&name=Broadcast-${getRandomInt(99999)}`
                : `${config.MiroTalk.BRO.Viewer}${data.room}%26name=Viewer-${getRandomInt(99999)}`;
            break;
        default:
            break;
    }
    return roomURL;
}

function getRowValues(id) {
    return {
        userId: userId,
        type: document.getElementById(id + '_type').value,
        tag: document.getElementById(id + '_tag').value,
        email: document.getElementById(id + '_email').value.toLowerCase(),
        phone: document.getElementById(id + '_phone').value,
        date: document.getElementById(id + '_date').value,
        time: document.getElementById(id + '_time').value,
        room: document.getElementById(id + '_room').value,
    };
}

function getFormValues() {
    const roomValue = user.allowedRoomsALL
        ? addRoom.value.trim().replace(/\s+/g, '-')
        : selRoom.value.trim().replace(/\s+/g, '-');
    return {
        userId: userId,
        type: addType.value,
        tag: addTag.value,
        email: addEmail.value.toLowerCase(),
        phone: addPhone.value,
        date: addDate.value,
        time: addTime.value,
        room: roomValue,
    };
}

function resetFormValues() {
    addTag.value = '';
    addEmail.value = '';
    addPhone.value = '';
    addDate.value = new Date().toISOString().substring(0, 10);
    addTime.value = new Date().toISOString().substring(11, 16);
    addRoom.value = getUUID4();
    if (addDate._flatpickr) addDate._flatpickr.setDate(addDate.value, false);
    if (addTime._flatpickr) addTime._flatpickr.setDate(addTime.value, false);
}

function getFlatpickrOnReady() {
    const isDark = document.body.classList.contains('dark');
    return function (selectedDates, dateStr, instance) {
        if (isDark) instance.calendarContainer.classList.add('dark');
    };
}

function initFlatpickr() {
    const onReady = getFlatpickrOnReady();

    flatpickr(addDate, {
        dateFormat: 'Y-m-d',
        defaultDate: new Date().toISOString().substring(0, 10),
        minDate: 'today',
        allowInput: true,
        disableMobile: true,
        onReady,
    });

    flatpickr(addTime, {
        enableTime: true,
        noCalendar: true,
        dateFormat: 'H:i',
        time_24hr: true,
        defaultDate: new Date().toISOString().substring(11, 16),
        allowInput: true,
        disableMobile: true,
        onReady,
    });
}

function initRowFlatpickr(rowId) {
    const dateEl = document.getElementById(rowId + '_date');
    const timeEl = document.getElementById(rowId + '_time');
    const onReady = getFlatpickrOnReady();
    if (dateEl && !dateEl._flatpickr) {
        flatpickr(dateEl, {
            dateFormat: 'Y-m-d',
            minDate: 'today',
            allowInput: true,
            disableMobile: true,
            onReady,
        });
    }
    if (timeEl && !timeEl._flatpickr) {
        flatpickr(timeEl, {
            enableTime: true,
            noCalendar: true,
            dateFormat: 'H:i',
            time_24hr: true,
            allowInput: true,
            disableMobile: true,
            onReady,
        });
    }
}

function initVisibleRowsFlatpickr() {
    const onReady = getFlatpickrOnReady();
    document.querySelectorAll('#myTableBody .flatpickr-date, #myTableBody .flatpickr-time').forEach((el) => {
        if (el._flatpickr) return;
        if (el.classList.contains('flatpickr-date')) {
            flatpickr(el, { dateFormat: 'Y-m-d', minDate: 'today', allowInput: true, disableMobile: true, onReady });
        } else {
            flatpickr(el, {
                enableTime: true,
                noCalendar: true,
                dateFormat: 'H:i',
                time_24hr: true,
                allowInput: true,
                disableMobile: true,
                onReady,
            });
        }
    });
}

function updateFlatpickrTheme() {
    const isDark = document.body.classList.contains('dark');
    document.querySelectorAll('.flatpickr-calendar').forEach((cal) => {
        if (isDark) {
            cal.classList.add('dark');
        } else {
            cal.classList.remove('dark');
        }
    });
}

function animateCSS(element, animation, prefix = 'animate__') {
    return new Promise((resolve, reject) => {
        const animationName = `${prefix}${animation}`;
        element.classList.add(`${prefix}animated`, animationName);
        function handleAnimationEnd(event) {
            event.stopPropagation();
            element.classList.remove(`${prefix}animated`, animationName);
            resolve(true);
        }
        element.addEventListener('animationend', handleAnimationEnd, { once: true });
    });
}

function elemDisplay(elem, show) {
    if (!elem) return;
    elem.style.display = show ? 'flex' : 'none';
}

function toggleRoomsList(hasData) {
    const emptyState = document.getElementById('emptyState');
    const filterBar = document.getElementById('filterBar');
    const tableWrapper = document.getElementById('myTable_wrapper');
    elemDisplay(emptyState, !hasData);
    elemDisplay(filterBar, hasData);
    if (tableWrapper) tableWrapper.style.display = hasData ? '' : 'none';
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function loadToolTip(tt) {
    tt.forEach(({ element, text, position }) => {
        if (element) setTippy(element, text, position);
    });
}

function setTippy(elem, content, placement) {
    if (isMobile) return;
    try {
        tippy(elem, {
            content: content,
            placement: placement,
        });
    } catch (err) {
        console.error('setTippy error', err.message);
    }
}

// Debounced dashboard stats refresh
let statsTimeout;
function debouncedLoadStats() {
    clearTimeout(statsTimeout);
    statsTimeout = setTimeout(loadDashboardStats, 500);
}

// Filter chips for rooms table
document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.filter;
        const today = new Date().toISOString().split('T')[0];

        // Remove any previously pushed custom filter
        $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter((fn) => !fn._isRoomFilter);

        if (filter !== 'all') {
            const filterFn = function (settings, data, dataIndex) {
                const row = dataTable.row(dataIndex).node();
                const dateInput = row ? row.querySelector('.flatpickr-date') : null;
                const rowDate = dateInput ? dateInput.value : '';
                if (filter === 'today') return rowDate === today;
                if (filter === 'upcoming') return rowDate >= today;
                if (filter === 'past') return rowDate < today;
                return true;
            };
            filterFn._isRoomFilter = true;
            $.fn.dataTable.ext.search.push(filterFn);
        }
        dataTable.draw();
    });
});

// Filter chips for users table
document.querySelectorAll('.users-filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.users-filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.filter;
        const today = new Date().toISOString().split('T')[0];

        $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter((fn) => !fn._isUserFilter);

        if (filter !== 'all') {
            const now = new Date();
            const d7 = new Date(now);
            d7.setDate(d7.getDate() - 7);
            const d30 = new Date(now);
            d30.setDate(d30.getDate() - 30);
            const filterFn = function (settings, data, dataIndex) {
                if (settings.nTable.id !== 'usersTable') return true;
                const row = usersDataTable.row(dataIndex).node();
                const dateEl = row ? row.querySelector('[data-date]') : null;
                const rowDate = dateEl ? dateEl.dataset.date : '';
                if (!rowDate) return false;
                if (filter === 'today') return rowDate === today;
                const rd = new Date(rowDate);
                if (filter === '7days') return rd >= d7;
                if (filter === '30days') return rd >= d30;
                return true;
            };
            filterFn._isUserFilter = true;
            $.fn.dataTable.ext.search.push(filterFn);
        }
        usersDataTable.draw();
    });
});
