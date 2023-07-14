'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validator = require('../middleware/validator');
const router = express.Router();
const controllersUsers = require('../controllers/users');

//CREATE: /api/v1/user
router.post('/user', validator, (req, res) => {
    controllersUsers.userCreate(req, res);
});

//LOGIN: /api/v1/user/login
router.post('/user/login', validator, (req, res) => {
    controllersUsers.userLogin(req, res);
});

//POST: /api/v1/user/confirmation/?token=<token>
router.get('/user/confirmation', auth, (req, res) => {
    controllersUsers.userConfirmation(req, res);
});

//GET: /api/v1/user/id
router.get('/user/:id', auth, (req, res) => {
    controllersUsers.userGet(req, res);
});

//UPDATE: /api/v1/user/id
router.patch('/user/:id', auth, validator, (req, res) => {
    controllersUsers.userUpdate(req, res);
});

//DELETE: /api/v1/user/id
router.delete('/user/:id', auth, (req, res) => {
    controllersUsers.userDelete(req, res);
});

//DELETE: /api/v1/user/deleteALL
router.delete('/user/deleteALL', admin, (req, res) => {
    controllersUsers.userDeleteALL(req, res);
});

module.exports = router;
