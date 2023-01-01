'use-strict';

const apiPath = '/api/v1';
const userEmail = window.localStorage.email;
const userId = window.sessionStorage.userId;
const userToken = window.sessionStorage.userToken;

const headers = {
    'x-access-token': `${userToken}`,
};

// API USER

function userCreate(data) {
    return axios({
        method: 'POST',
        url: `${apiPath}/user`,
        data: data,
    }).then((response) => response.data);
}

function userLogin(data) {
    return axios({
        method: 'POST',
        url: `${apiPath}/user/login`,
        data: data,
    }).then((response) => response.data);
}

function userConfirmation(token) {
    return axios({
        method: 'GET',
        url: `${apiPath}/user/confirmation${token}`,
        headers: headers,
    }).then((response) => response.data);
}

function userGet(id) {
    return axios({
        method: 'GET',
        url: `${apiPath}/user/${id}`,
        headers: headers,
    }).then((response) => response.data);
}

function userUpdate(id, data) {
    return axios({
        method: 'PATCH',
        url: `${apiPath}/user/${id}`,
        headers: headers,
        data: data,
    }).then((response) => response.data);
}

function userDelete(id) {
    return axios({
        method: 'DELETE',
        url: `${apiPath}/user/${id}`,
        headers: headers,
    }).then((response) => response.data);
}

function userDeleteALL() {
    return axios({
        method: 'DELETE',
        url: `${apiPath}/user/deleteALL`,
        headers: headers,
    }).then((response) => response.data);
}

// API ROOM

function roomCreate(data) {
    return axios({
        method: 'POST',
        url: `${apiPath}/room`,
        headers: headers,
        data: data,
    }).then((response) => response.data);
}

function roomFindBy(userId) {
    return axios({
        method: 'GET',
        url: `${apiPath}/room/findBy/${userId}`,
        headers: headers,
    }).then((response) => response.data);
}

function roomDeleteFindBy(userId) {
    return axios({
        method: 'DELETE',
        url: `${apiPath}/room/findBy/${userId}`,
        headers: headers,
    }).then((response) => response.data);
}

function roomGet(id) {
    return axios({
        method: 'GET',
        url: `${apiPath}/room/${id}`,
        headers: headers,
    }).then((response) => response.data);
}

function roomUpdate(id, data) {
    return axios({
        method: 'PATCH',
        url: `${apiPath}/room/${id}`,
        headers: headers,
        data: data,
    }).then((response) => response.data);
}

function roomDelete(id) {
    return axios({
        method: 'DELETE',
        url: `${apiPath}/room/${id}`,
        headers: headers,
    }).then((response) => response.data);
}

function roomDeleteALL() {
    return axios({
        method: 'DELETE',
        url: `${apiPath}/room/deleteALL`,
        headers: headers,
    }).then((response) => response.data);
}
