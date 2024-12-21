'use strict';

const express = require('express');
const url = require('../middleware/url');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const api = require('../middleware/api');
const validator = require('../middleware/validator');
const router = express.Router();
const controllersUsers = require('../controllers/users');

//CREATE: /api/v1/user
router.post('/user', validator, url, (req, res) => {
    controllersUsers.userCreate(req, res);
});

//LOGIN: /api/v1/user/login
router.post('/user/login', validator, url, (req, res) => {
    controllersUsers.userLogin(req, res);
});

//POST: /api/v1/user/isAuth/
router.post('/user/isAuth', api, url, (req, res) => {
    controllersUsers.userIsAuth(req, res);
});

//POST: /api/v1/user/isRoomAllowed/
router.post('/user/isRoomAllowed', api, url, (req, res) => {
    controllersUsers.userIsRoomAllowed(req, res);
});

//POST: /api/v1/user/allowedRooms/
router.post('/user/roomsAllowed', api, url, (req, res) => {
    controllersUsers.userRoomsAllowed(req, res);
});

//GET: /api/v1/user/confirmation/?token=<token>
router.get('/user/confirmation', auth, url, (req, res) => {
    controllersUsers.userConfirmation(req, res);
});

//GET: /api/v1/user/id
router.get('/user/:id', auth, url, (req, res) => {
    controllersUsers.userGet(req, res);
});

//UPDATE: /api/v1/user/id
router.patch('/user/:id', auth, validator, url, (req, res) => {
    controllersUsers.userUpdate(req, res);
});

//DELETE: /api/v1/user/id
router.delete('/user/:id', auth, url, (req, res) => {
    controllersUsers.userDelete(req, res);
});

//DELETE: /api/v1/user/deleteALL
router.delete('/user/deleteALL', admin, url, (req, res) => {
    controllersUsers.userDeleteALL(req, res);
});

module.exports = router;
