'use-strict';

const isMobile = !!/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(
    navigator.userAgent.toLowerCase() || '',
);

const body = document.querySelector('body');
const modeToggle = body.querySelector('.mode-toggle');
const sidebar = body.querySelector('nav');
const sidebarToggle = body.querySelector('.sidebar-toggle');

const navDash = document.getElementById('navDash');
const navC2C = document.getElementById('navC2C');
const navP2P = document.getElementById('navP2P');
const navSFU = document.getElementById('navSFU');
const navBRO = document.getElementById('navBRO');
const navSup = document.getElementById('navSup');
const navAcc = document.getElementById('navAcc');

const myProfile = document.getElementById('myProfile');

const search = document.getElementById('search');
const dsDash = document.getElementById('dsDash');
const dsRooms = document.getElementById('dsRooms');

const hideBoxesDS = document.getElementById('hide-boxesDS');
const showBoxesDS = document.getElementById('show-boxesDS');

const boxesDS = document.getElementById('boxesDS');
const titleDS = document.getElementById('titleDS');

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
const accountToken = document.getElementById('account-token');
const accountCreatedAt = document.getElementById('account-created-at');
const accountUpdatedAt = document.getElementById('account-updated-at');
const accountServicesAllowed = document.getElementById('account-services-allowed');
const accountDelete = document.getElementById('account-delete');

const addRowDiv = document.getElementById('addRowDiv');
const openAddBtn = document.getElementById('open-add-btn');
const closeAddBtn = document.getElementById('add-close-btn');

const addType = document.getElementById('add-type');
const addTag = document.getElementById('add-tag');
const addEmail = document.getElementById('add-email');
const addPhone = document.getElementById('add-phone');
const addDate = document.getElementById('add-date');
const addTime = document.getElementById('add-time');
const addRoom = document.getElementById('add-room');
const genRoom = document.getElementById('gen-room');
const addRowBtn = document.getElementById('add-row-btn');

const refreshBtn = document.getElementById('refresh-page-btn');
const delAllBtn = document.getElementById('del-all-btn');

const myTable = document.getElementById('myTable');
const myTableBody = document.getElementById('myTableBody');

const dataTable = $('#myTable').DataTable({
    searching: true,
    paging: true,
    pageLength: 10,
    lengthChange: false,
    pagingType: 'simple_numbers',
    info: false,
    responsive: true,
    scrollX: true,
    columnDefs: [
        { width: '5%', targets: 0 },
        { width: '10%', targets: 1 },
        { width: '20%', targets: 2 },
        { width: '10%', targets: 3 },
        { width: '10%', targets: 4 },
        { width: '10%', targets: 5 },
        { width: '20%', targets: 6 },
        { width: '10%', targets: 7 },
        {
            targets: [0, 1, 2, 3, 4, 5, 6],
            type: 'string',
            searchable: true,
        },
        {
            targets: [7],
            orderable: false,
            searchable: false,
        },
        {
            targets: [0, 1, 2, 3, 4, 5, 6, 7],
            className: 'dt-body-justify',
        },
    ], // [MiroTalk, Tag, Email, Phone, Date, Time, Room, Actions]
});

const getMode = window.localStorage.mode || 'dark';
const getStatus = window.localStorage.status;

if (getMode && getMode === 'dark') body.classList.toggle('dark');
if (getStatus && getStatus === 'close') sidebar.classList.toggle('close');

$(document).ready(function () {
    console.log('Config', config);
    loadConfig();
    handleUserRoles();
});

function loadConfig() {
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
}

function handleUserRoles() {
    userGet(userId)
        .then((res) => {
            console.log('[API] - USER ROLES GET RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
            } else {
                const { role, allow } = res;
                if (role == 'admin') {
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
            showDataTable();
        })
        .catch((err) => {
            console.error('[API] - USER ROLES GET ERROR', err);
            popupMessage('error', `USER ROLES GET error: ${err.message}`);
        });
}

function toggleElements() {
    elemDisplay(hideBoxesDS, true);
    elemDisplay(showBoxesDS, false);
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
        elemDisplay(titleDS, false);
    }
    for (var i = 0; i < addType.length; i++) {
        //console.log(addType.options[i].value);
        if (addType.options[i].value == 'P2P' && !config.MiroTalk.P2P.Visible) addType.remove(i);
        if (addType.options[i].value == 'SFU' && !config.MiroTalk.SFU.Visible) addType.remove(i);
        if (addType.options[i].value == 'C2C' && !config.MiroTalk.C2C.Visible) addType.remove(i);
        if (addType.options[i].value == 'BRO' && !config.MiroTalk.BRO.Visible) addType.remove(i);
    }
}

modeToggle.addEventListener('click', () => {
    body.classList.toggle('dark');
    window.localStorage.mode = body.classList.contains('dark') ? 'dark' : 'light';
});

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('close');
    window.localStorage.status = sidebar.classList.contains('close') ? 'close' : 'open';
});

navDash.addEventListener('click', () => {
    navShow([search, dsDash, dsRooms]);
});

navP2P.addEventListener('click', () => {
    navShow([p2p]);
    //p2pIframe.setAttribute('src', config.MiroTalk.P2P.Room);
});

navSFU.addEventListener('click', () => {
    navShow([sfu]);
    //sfuIframe.setAttribute('src', config.MiroTalk.SFU.Room);
});

navC2C.addEventListener('click', () => {
    navShow([c2c]);
    //c2cIframe.setAttribute('src', config.MiroTalk.C2C.Home);
});

navBRO.addEventListener('click', () => {
    navShow([bro]);
    //broIframe.setAttribute('src', config.MiroTalk.BRO.Home);
});

navSup.addEventListener('click', () => {
    openURL(config.Author.Support, true);
});
navAcc.addEventListener('click', () => {
    getMyAccount();
});

hideBoxesDS.addEventListener('click', () => {
    toggleBoxesDS(false);
});
showBoxesDS.addEventListener('click', () => {
    toggleBoxesDS(true);
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

delAllBtn.addEventListener('click', () => {
    delAllRows();
});

accountClose.addEventListener('click', () => {
    toggleAccount();
});
accountDelete.addEventListener('click', () => {
    delMyAccount();
});

function navShow(elements = []) {
    elemDisplay(search, false);
    elemDisplay(dsDash, false);
    elemDisplay(dsRooms, false);
    elemDisplay(p2p, false);
    elemDisplay(sfu, false);
    elemDisplay(c2c, false);
    elemDisplay(bro, false);
    elements.forEach((element, i) => {
        element.style.display = 'block';
    });
}

function searchRows() {
    const input = document.getElementById('myInput');
    dataTable.search(input.value).draw();
}

function toggleBoxesDS(show) {
    if (show) {
        elemDisplay(boxesDS, true);
        elemDisplay(hideBoxesDS, true);
        elemDisplay(showBoxesDS, false);
    } else {
        elemDisplay(boxesDS, false);
        elemDisplay(hideBoxesDS, false);
        elemDisplay(showBoxesDS, true);
    }
}

function toggleAddRows() {
    if (addRowDiv.classList.contains('show')) {
        animateCSS(addRowDiv, 'fadeOutRight').then((ok) => {
            addRowDiv.classList.toggle('show');
        });
    } else {
        addRowDiv.classList.toggle('show');
        animateCSS(addRowDiv, 'fadeInRight');
    }
}

function toggleAccount() {
    if (accountDiv.classList.contains('show')) {
        animateCSS(accountDiv, 'fadeOutRight').then((ok) => {
            accountDiv.classList.toggle('show');
        });
    } else {
        accountDiv.classList.toggle('show');
        animateCSS(accountDiv, 'fadeInRight');
    }
}

function showDataTable() {
    navDash.click();

    roomFindBy(userId)
        .then((res) => {
            console.log('[API] - GET ALL ROOMS RESPONSE', res);
            if (res) {
                res.forEach((obj) => {
                    const tableRow = getRow(obj);
                    if (tableRow) dataTable.row.add(tableRow).node().id = obj._id;
                });
                dataTable.draw();
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

    roomCreate(data)
        .then((res) => {
            console.log('[API] - ROOM CREATE RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
            } else {
                const tableRow = getRow(res);
                if (tableRow) {
                    dataTable.row.add(tableRow).node().id = res._id;
                    dataTable.draw();
                    toggleAddRows();
                }
            }
        })
        .catch((err) => {
            console.error('[API] - ROOM CREATE ERROR', err);
            popupMessage('error', `API ROOM CREATE error: ${err.message}`);
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

    const isP2P = obj.type == 'P2P' ? 'selected' : '';
    const isSFU = obj.type == 'SFU' ? 'selected' : '';
    const isC2C = obj.type == 'C2C' ? 'selected' : '';
    const isBRO = obj.type == 'BRO' ? 'selected' : '';

    const optionP2P = config.MiroTalk.P2P.Visible ? `<option value="P2P" ${isP2P}>P2P</option>` : '';
    const optionSFU = config.MiroTalk.SFU.Visible ? `<option value="P2P" ${isSFU}>SFU</option>` : '';
    const optionC2C = config.MiroTalk.C2C.Visible ? `<option value="C2C" ${isC2C}>C2C</option>` : '';
    const optionBRO = config.MiroTalk.BRO.Visible ? `<option value="BRO" ${isBRO}>BRO</option>` : '';

    const setRandomRoomIcon = config.BUTTONS.setRandomRoom
        ? `<i id="${obj._id}_randomRoom" onclick="setRandomRoom('${obj._id}')" class="uil uil-refresh random"></i>`
        : '';

    const copyRoomIcon = config.BUTTONS.copyRoom
        ? `<i id="${obj._id}_copy" onclick="copyRoom('${obj._id}')" class='uil uil-copy'></i>`
        : '';

    const shareRoomIcon =
        config.BUTTONS.shareRoom && isMobile
            ? `<i id="${obj._id}_share" onclick="shareRoom('${obj._id}')" class="uil uil-share-alt"></i>`
            : '';

    const sendEmailIcon = config.BUTTONS.sendEmail
        ? `<i id="${obj._id}_email" onclick="sendEmail('${obj._id}')" class="uil uil-envelope-upload"></i>`
        : '';

    const sendSmSInvitationIcon = config.BUTTONS.sendSmSInvitation
        ? `<i id="${obj._id}_sms" onclick="sendSmSInvitation('${obj._id}')" class="uil-message"></i>`
        : '';

    const joinInternalIcon = config.BUTTONS.joinInternal
        ? `<i id="${obj._id}_joinInternal" onclick="joinRoom('${obj._id}')" class="uil uil-estate"></i>`
        : '';

    const joinExternalIcon = config.BUTTONS.joinExternal
        ? `<i id="${obj._id}_joinExternal" onclick="joinRoom('${obj._id}', true)" class="uil uil-external-link-alt"></i>`
        : '';

    const updateRowIcon = config.BUTTONS.updateRow
        ? `<i id="${obj._id}_save" onclick="updateRow('${obj._id}')" class="uil uil-save"></i>`
        : '';

    const delRowIcon = config.BUTTONS.delRow
        ? `<i id="${obj._id}_delete" onclick="delRow('${obj._id}')" class="uil uil-multiply"></i>`
        : '';

    return [
        `<td>
            <select id="${obj._id}_type" class="select-options">    
                ${optionP2P}
                ${optionSFU}
                ${optionC2C}
                ${optionBRO}
            </select>
        </td>`,
        `<td><input id="${obj._id}_tag" type="text" name="tag" value="${obj.tag}"/></td>`,
        `<td><input id="${obj._id}_email" type="email" name="email" value="${obj.email}"/></td>`,
        `<td><input id="${obj._id}_phone" type="text" name="text" value="${obj.phone}"/></td>`,
        `<td><input id="${obj._id}_date" type="date" name="date" value="${obj.date}"/></td>`,
        `<td><input id="${obj._id}_time" type="time" name="time" value="${obj.time}"/></td>`,
        `<td><input id="${obj._id}_room" type="text" name="room" value="${obj.room}"/></td>`,
        `<td>
            ${setRandomRoomIcon}
            ${copyRoomIcon}
            ${shareRoomIcon}
            ${sendEmailIcon}
            ${sendSmSInvitationIcon}
            ${joinInternalIcon}
            ${joinExternalIcon}
            ${updateRowIcon}
            ${delRowIcon}
        </td>`,
    ];
}

function setRandomRoom(id) {
    const room = document.getElementById(id + '_room');
    room.value = getUUID4();
}

function copyRoom(id) {
    const room = document.getElementById(id + '_room').value;
    navigator.clipboard.writeText(room).then(
        () => {
            popupMessage('toast', `The room: ${room} \n has been successfully copied to the clipboard 👍`);
        },
        (err) => {
            console.error('Could not copy text: ', err);
        },
    );
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
        position: 'center',
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
                message: `MiroTalk [${data.date}:${data.time}] ${roomURL}`,
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

    roomUpdate(id, data)
        .then((res) => {
            console.log('[API] - UPDATE ROW RESPONSE', res);
            res.message
                ? popupMessage('warning', `${res.message}`)
                : popupMessage('toast', 'Data saved successfully 👍');
        })
        .catch((err) => {
            console.log('[API] - UPDATE ROW ERROR', err);
            popupMessage('error', `API UPDATE ROW error: ${err.message}`);
            showDataTable();
        });
}

function delRow(id) {
    const dataTableTR = document.getElementById(id);
    dataTableTR.classList.add('selected');
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'center',
        icon: 'warning',
        title: 'Delete room',
        text: 'Are you sure you want to delete the room?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: {
            popup: 'animate__animated animate__fadeInDown',
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp',
        },
    }).then((result) => {
        if (result.isConfirmed) {
            roomDelete(id)
                .then((res) => {
                    console.log('[API] - DELETE ROW RESPONSE', res);
                    dataTable.row(`#${id}`).remove().draw();
                    dataTableTR.classList.remove('selected');
                })
                .catch((err) => {
                    console.log('[API] - DELETE ROW ERROR', err);
                    popupMessage('error', `API DELETE ROW error: ${err.message}`);
                });
        } else {
            dataTableTR.classList.remove('selected');
        }
    });
}

function delAllRows() {
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        position: 'center',
        icon: 'warning',
        title: 'Delete all rooms',
        text: 'Are you sure you want to delete all rooms?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: {
            popup: 'animate__animated animate__fadeInDown',
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp',
        },
    }).then((result) => {
        if (result.isConfirmed) {
            roomDeleteFindBy(userId)
                .then((res) => {
                    console.log('[API] - DELETE ALL ROWS RESPONSE', res);
                    dataTable.clear().draw();
                })
                .catch((err) => {
                    console.log('[API] - DELETE ALL ROWS ERROR', err);
                    popupMessage('error', `API DELETE ALL error: ${err.message}`);
                });
        }
    });
}

function getMyAccount() {
    userGet(userId)
        .then((res) => {
            console.log('[API] - USER GET RESPONSE', res);
            if (res.message) {
                popupMessage('warning', `${res.message}`);
            } else {
                accountID.value = res._id;
                accountEmail.value = res.email;
                accountUsername.value = res.username;
                accountToken.value = res.token;
                accountCreatedAt.value = res.createdAt;
                accountUpdatedAt.value = res.updatedAt;
                accountServicesAllowed.value = res.allow;
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
        position: 'center',
        icon: 'warning',
        title: 'Delete account!',
        text: 'Are you sure to want delete your account and all associated data?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: {
            popup: 'animate__animated animate__fadeInDown',
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp',
        },
    }).then((result) => {
        if (result.isConfirmed) {
            userDelete(userId)
                .then((res) => {
                    console.log('[API] - USER DELETE RESPONSE', res);
                    openURL('/');
                })
                .catch((err) => {
                    console.log('[API] - USER DELETE ERROR', err);
                    popupMessage('error', `API USER DELETE error: ${err.message}`);
                });
        }
    });
}

function refreshPage() {
    document.location.reload(true);
}

function openURL(url, blank = false) {
    blank ? window.open(url, '_blank') : (window.location.href = url);
}

function getUUID4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
    );
}

function getRoomURL(data, bro = true) {
    let roomURL;
    switch (data.type) {
        case 'P2P':
            roomURL = `${config.MiroTalk.P2P.Join}${data.room}`;
            break;
        case 'SFU':
            roomURL = `${config.MiroTalk.SFU.Join}${data.room}`;
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
    const select_type = document.getElementById(id + '_type');
    return {
        userId: userId,
        type: select_type.options[select_type.selectedIndex].text,
        tag: document.getElementById(id + '_tag').value,
        email: document.getElementById(id + '_email').value.toLowerCase(),
        phone: document.getElementById(id + '_phone').value,
        date: document.getElementById(id + '_date').value,
        time: document.getElementById(id + '_time').value,
        room: document.getElementById(id + '_room').value,
    };
}

function getFormValues() {
    return {
        userId: userId,
        type: addType.options[addType.selectedIndex].text,
        tag: addTag.value,
        email: addEmail.value.toLowerCase(),
        phone: addPhone.value,
        date: addDate.value,
        time: addTime.value,
        room: addRoom.value,
    };
}

function resetFormValues() {
    addTag.value = '';
    addEmail.value = '';
    addPhone.value = '';
    addDate.value = new Date().toISOString().substring(0, 10);
    addTime.value = new Date().toISOString().substring(11, 16);
    addRoom.value = getUUID4();
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
    elem.style.display = show ? 'flex' : 'none';
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
