'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/saas');
//const admin = require('../middleware/admin');
const router = express.Router();
const controllersSmS = require('../controllers/sms');

//POST: /api/v1/sms
router.post('/sms', auth, requireSubscription, (req, res) => {
    controllersSmS.smsSend(req, res);
});

module.exports = router;
