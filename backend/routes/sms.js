'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const url = require('../middleware/url');
//const admin = require('../middleware/admin');
const router = express.Router();
const controllersSmS = require('../controllers/sms');

//POST: /api/v1/sms
router.post('/sms', auth, url, (req, res) => {
    controllersSmS.smsSend(req, res);
});

module.exports = router;
