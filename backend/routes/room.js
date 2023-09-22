'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validator = require('../middleware/validator');
const router = express.Router();
const controllersRooms = require('../controllers/rooms');

//GET: /api/v1/room/findRole
router.get('/room/findRole/:room/:userId', auth, (req, res) => {
    controllersRooms.getUserRole(req, res);
});

//CREATE: /api/v1/room
router.post('/room', auth, validator, (req, res) => {
    controllersRooms.roomCreate(req, res);
});

//GET: /api/v1/room/findBy/userId
router.get('/room/findBy/:userId', auth, (req, res) => {
    controllersRooms.roomFindBy(req, res);
});

//DELETE: /api/v1/findBy/userId
router.delete('/room/findBy/:userId', auth, (req, res) => {
    controllersRooms.roomDeleteFindBy(req, res);
});

//GET: /api/v1/room/id
router.get('/room/:id', auth, (req, res) => {
    controllersRooms.roomGet(req, res);
});

//UPDATE: /api/v1/room/id
router.patch('/room/:id', auth, validator, (req, res) => {
    controllersRooms.roomUpdate(req, res);
});

//DELETE: /api/v1/room/id
router.delete('/room/:id', auth, (req, res) => {
    controllersRooms.roomDelete(req, res);
});

//DELETE: /api/v1/room/deleteALL
router.delete('/room/deleteAll', admin, (req, res) => {
    controllersRooms.roomDeleteALL(req, res);
});

module.exports = router;
