'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const validator = require('../middleware/validator');
const router = express.Router();
const controllersToken = require('../controllers/token');

//GET: /api/v1/token/SFU/:token
router.get('/token/SFU/:token', auth, validator, (req, res) => {
    controllersToken.tokenSFU(req, res);
});

module.exports = router;
