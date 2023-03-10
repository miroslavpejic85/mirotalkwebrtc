'use-strict';

const miroTalkP2PHome = 'https://p2p.mirotalk.com';
const miroTalkSFUHome = 'https://sfu.mirotalk.com';
const miroTalkC2CHome = 'https://c2c.mirotalk.com';
const miroTalkSponsor = 'https://github.com/sponsors/miroslavpejic85';

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
const navSup = document.getElementById('navSup');

const search = document.getElementById('search');
const dsDash = document.getElementById('dsDash');
const dsRooms = document.getElementById('dsRooms');

const c2c = document.getElementById('c2c');
const p2p = document.getElementById('p2p');
const sfu = document.getElementById('sfu');

const p2pIframe = document.getElementById('p2p-iframe');
const sfuIframe = document.getElementById('sfu-iframe');
const c2cIframe = document.getElementById('c2c-iframe');

const addRowDiv = document.getElementById('addRowDiv');
const openAddBtn = document.getElementById('open-add-btn');
const closeAddBtn = document.getElementById('add-close-btn');

const addType = document.getElementById('add-type');
const addTag = document.getElementById('add-tag');
const addEmail = document.getElementById('add-email');
const addDate = document.getElementById('add-date');
const addTime = document.getElementById('add-time');
const addRoom = document.getElementById('add-room');
const genRoom = document.getElementById('gen-room');
const addRowBtn = document.getElementById('add-row-btn');

const delMyAccBtn = document.getElementById('del-my-account');

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
        {
            targets: [0, 1, 2, 3, 4, 5],
            type: 'string',
            searchable: true,
        },
        {
            targets: [6],
            orderable: false,
            searchable: false,
        },
    ], // [MiroTalk, Tag, Email, Date, Time, Room, Actions]
});

const getMode = window.localStorage.mode;
const getStatus = window.localStorage.status;

if (getMode && getMode === 'dark') body.classList.toggle('dark');
if (getStatus && getStatus === 'close') sidebar.classList.toggle('close');

$(document).ready(function () {
    showDataTable();
});

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
    p2pIframe.setAttribute('src', `${miroTalkP2PHome}/newcall`);
    navShow([p2p]);
});

navSFU.addEventListener('click', () => {
    sfuIframe.setAttribute('src', `${miroTalkSFUHome}/newroom`);
    navShow([sfu]);
});

navC2C.addEventListener('click', () => {
    c2cIframe.setAttribute('src', miroTalkC2CHome);
    navShow([c2c]);
});
navSup.addEventListener('click', () => {
    openURL(miroTalkSponsor, true);
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

delMyAccBtn.addEventListener('click', () => {
    delMyAccount();
});

function navShow(elements = [], mode = 'none') {
    search.style.display = mode;
    dsDash.style.display = mode;
    dsRooms.style.display = mode;
    c2c.style.display = mode;
    p2p.style.display = mode;
    sfu.style.display = mode;
    elements.forEach((element, i) => {
        element.style.display = 'block';
    });
}

function searchRows() {
    const input = document.getElementById('myInput');
    dataTable.search(input.value).draw();
}

function toggleAddRows() {
    addRowDiv.classList.toggle('show');
}

function showDataTable() {
    navDash.click();

    roomFindBy(userId)
        .then((res) => {
            console.log('[API] - GET ALL ROOMS RESPONSE', res);
            if (res) {
                res.forEach((obj) => {
                    const tableRow = getRow(obj);
                    dataTable.row.add(tableRow).node().id = obj._id;
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
                dataTable.row.add(tableRow).node().id = res._id;
                dataTable.draw();
                addRowDiv.classList.toggle('show');
            }
        })
        .catch((err) => {
            console.error('[API] - ROOM CREATE ERROR', err);
            popupMessage('error', `API ROOM CREATE error: ${err.message}`);
        });
}

function getRow(obj) {
    const isP2P = obj.type == 'P2P' ? 'selected' : '';
    const isSFU = obj.type == 'SFU' ? 'selected' : '';
    const isC2C = obj.type == 'C2C' ? 'selected' : '';
    const shareRoomIcon = isMobile
        ? `<i id="${obj._id}_share" onclick="shareRoom('${obj._id}')" class="uil uil-share-alt"></i>`
        : '';
    return [
        `<td>
            <select id="${obj._id}_type" class="select-options">    
                <option value="P2P" ${isP2P}>P2P</option>
                <option value="SFU" ${isSFU}>SFU</option>
                <option value="C2C" ${isC2C}>C2C</option>
            </select>
        </td>`,
        `<td><input id="${obj._id}_tag" type="text" name="tag" value="${obj.tag}"/></td>`,
        `<td><input id="${obj._id}_email" type="email" name="email" value="${obj.email}"/></td>`,
        `<td><input id="${obj._id}_date" type="date" name="date" value="${obj.date}"/></td>`,
        `<td><input id="${obj._id}_time" type="time" name="time" value="${obj.time}"/></td>`,
        `<td><input id="${obj._id}_room" type="text" name="room" value="${obj.room}"/></td>`,
        `<td>
            <i id="${obj._id}_randomRoom" onclick="setRandomRoom('${obj._id}')" class="uil uil-refresh random"></i>
            <i id="${obj._id}_copy" onclick="copyRoom('${obj._id}')" class='uil uil-copy'></i>
            ${shareRoomIcon}
            <i id="${obj._id}_email" onclick="sendEmail('${obj._id}')" class="uil uil-envelope-upload"></i>
            <i id="${obj._id}_joinInternal" onclick="joinRoom('${obj._id}')" class="uil uil-estate"></i>
            <i id="${obj._id}_joinExternal" onclick="joinRoom('${obj._id}', true)" class="uil uil-external-link-alt"></i>
            <i id="${obj._id}_save" onclick="updateRow('${obj._id}')" class="uil uil-save"></i>
            <i id="${obj._id}_delete" onclick="delRow('${obj._id}')" class="uil uil-multiply"></i>
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
            popupMessage('toast', `The room: ${room} \n has been successfully copied to the clipboard ????`);
        },
        (err) => {
            console.error('Could not copy text: ', err);
        },
    );
}

async function shareRoom(id) {
    const data = getRowValues(id);
    const roomURL = getRoomURL(data);
    if (navigator.share) {
        try {
            await navigator.share({ url: roomURL });
        } catch (err) {
            console.error('[Error] navigator share', err);
        }
    } else {
        popupMessage('warning', 'Navigator share not supported on this device.');
    }
}

function sendEmail(id) {
    const data = getRowValues(id);
    const roomURL = getRoomURL(data);
    const emailSubject = `Please join our MiroTalk ${data.type} Video Chat Meeting`;
    const emailBody = `The meeting is scheduled at date: ${data.date} time: ${data.time}, Click to join: ${roomURL}`;
    document.location = 'mailto:' + data.email + '?subject=' + emailSubject + '&body=' + emailBody;
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
                : popupMessage('toast', 'Data saved successfully ????');
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
        title: 'Delete row',
        text: 'Are you sure to want delete the row?',
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
        title: 'Delete all records',
        text: 'Are you sure to want delete all records?',
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

function getRoomURL(data) {
    let roomURL;
    switch (data.type) {
        case 'P2P':
            roomURL = `${miroTalkP2PHome}/join/${data.room}`;
            break;
        case 'SFU':
            roomURL = `${miroTalkSFUHome}/join/${data.room}`;
            break;
        case 'C2C':
            roomURL = `${miroTalkC2CHome}/?room=${data.room}`;
            break;
    }
    return roomURL;
}

function getRowValues(id) {
    return {
        userId: userId,
        type: document.getElementById(id + '_type').selectedOptions[0].value,
        tag: document.getElementById(id + '_tag').value,
        email: document.getElementById(id + '_email').value.toLowerCase(),
        date: document.getElementById(id + '_date').value,
        time: document.getElementById(id + '_time').value,
        room: document.getElementById(id + '_room').value,
    };
}

function getFormValues() {
    return {
        userId: userId,
        type: addType.selectedOptions[0].value,
        tag: addTag.value,
        email: addEmail.value.toLowerCase(),
        date: addDate.value,
        time: addTime.value,
        room: addRoom.value,
    };
}

function resetFormValues() {
    addTag.value = '';
    addEmail.value = '';
    addDate.value = new Date().toISOString().substring(0, 10);
    addTime.value = new Date().toISOString().substring(11, 16);
    addRoom.value = getUUID4();
}
