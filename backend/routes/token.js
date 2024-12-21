'use strict';

const express = require('express');
const url = require('../middleware/url');
const auth = require('../middleware/auth');
const validator = require('../middleware/validator');
const router = express.Router();
const controllersToken = require('../controllers/token');

//GET: /api/v1/token/SFU/:token
router.get('/token/SFU/:token', auth, validator, url, (req, res) => {
    controllersToken.tokenSFU(req, res);
});

module.exports = router;
