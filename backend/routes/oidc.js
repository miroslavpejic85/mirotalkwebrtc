'use strict';

const express = require('express');
const router = express.Router();
const controllersOidc = require('../controllers/oidc');

// GET /oidc/status
router.get('/status', (req, res) => {
    controllersOidc.oidcStatus(req, res);
});

// GET /oidc/profile-image
router.get('/profile-image', (req, res) => {
    controllersOidc.oidcProfileImage(req, res);
});

module.exports = router;
