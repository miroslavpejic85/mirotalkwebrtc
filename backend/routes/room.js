'use strict';

const express = require('express');
const api = require('../middleware/api');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validator = require('../middleware/validator');
const { requireSubscription } = require('../middleware/saas');
const { roomInvitationLimiter } = require('../middleware/rateLimiter');
const router = express.Router();
const controllersRooms = require('../controllers/rooms');
const controllersInvitations = require('../controllers/invitations');

//CREATE: /api/v1/room
router.post('/room', auth, requireSubscription, validator, (req, res) => {
    controllersRooms.roomCreate(req, res);
});

//EXISTS: /api/v1/room/exists
router.post('/room/exists', api, (req, res) => {
    controllersRooms.roomExists(req, res);
});

//INVITE: /api/v1/room/invite (server-side email invitations; gated by EMAIL_INVITATION_SERVER_SIDE)
router.post('/room/invite', auth, requireSubscription, roomInvitationLimiter, (req, res) => {
    controllersInvitations.sendRoomInvitation(req, res);
});

//RECURRING: /api/v1/room/:id/recurring (enable/disable weekly recurring invitations)
router.post('/room/:id/recurring', auth, requireSubscription, roomInvitationLimiter, (req, res) => {
    controllersInvitations.setRoomRecurring(req, res);
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
router.patch('/room/:id', auth, requireSubscription, validator, (req, res) => {
    controllersRooms.roomUpdate(req, res);
});

//DELETE: /api/v1/room/id
router.delete('/room/:id', auth, requireSubscription, (req, res) => {
    controllersRooms.roomDelete(req, res);
});

//DELETE: /api/v1/room/deleteALL
router.delete('/room/deleteAll', admin, (req, res) => {
    controllersRooms.roomDeleteALL(req, res);
});

module.exports = router;
