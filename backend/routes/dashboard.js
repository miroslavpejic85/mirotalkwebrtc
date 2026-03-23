'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const controllersDashboard = require('../controllers/dashboard');

//GET: /api/v1/dashboard/stats
router.get('/dashboard/stats', auth, (req, res) => {
    controllersDashboard.getDashboardStats(req, res);
});

module.exports = router;
