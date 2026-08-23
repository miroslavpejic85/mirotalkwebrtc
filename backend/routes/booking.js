'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const { requirePaidSubscription } = require('../middleware/saas');
const { publicBookingLimiter } = require('../middleware/rateLimiter');
const controllers = require('../controllers/bookings');

const router = express.Router();

router.get('/booking/profile', auth, controllers.getProfile);
router.patch('/booking/profile', auth, requirePaidSubscription, controllers.updateProfile);
router.get('/booking/manage', auth, controllers.listBookings);
router.get('/booking/public/:slug', publicBookingLimiter, controllers.getPublicProfile);
router.get('/booking/public/:slug/slots', publicBookingLimiter, controllers.getPublicSlots);
router.post('/booking/public/:slug', publicBookingLimiter, controllers.createBooking);
router.get('/booking/cancel/:token', publicBookingLimiter, controllers.getCancellation);
router.post('/booking/cancel/:token', publicBookingLimiter, controllers.cancelBooking);

module.exports = router;
