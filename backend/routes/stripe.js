'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const demo = require('../middleware/demo');

const router = express.Router();
const controllersStripe = require('../controllers/stripe');

//CHECKOUT: /api/v1/stripe/checkout
router.post('/stripe/checkout', demo, auth, (req, res) => {
    controllersStripe.createCheckout(req, res);
});

//PORTAL: /api/v1/stripe/portal
router.post('/stripe/portal', auth, (req, res) => {
    controllersStripe.createPortal(req, res);
});

//BILLING STATUS: /api/v1/stripe/billing
router.get('/stripe/billing', auth, (req, res) => {
    controllersStripe.getBilling(req, res);
});

//VERIFY SESSION: /api/v1/stripe/verify?session_id=cs_xxx
router.get('/stripe/verify', auth, (req, res) => {
    controllersStripe.verifySession(req, res);
});

module.exports = router;
