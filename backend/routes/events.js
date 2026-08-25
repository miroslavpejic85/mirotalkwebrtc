'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const { requirePaidSubscription } = require('../middleware/saas');
const { publicBookingLimiter } = require('../middleware/rateLimiter');
const controllers = require('../controllers/events');

const router = express.Router();

router.get('/events', auth, controllers.listEvents);
router.post('/events', auth, requirePaidSubscription, controllers.createEvent);
router.patch('/events/:id', auth, requirePaidSubscription, controllers.updateEvent);
router.delete('/events/:id', auth, requirePaidSubscription, controllers.deleteEvent);
router.get('/events/public/:slug', publicBookingLimiter, controllers.getPublicEvent);

module.exports = router;
