'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const yaml = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = yaml.load(path.join(__dirname, '../', 'api/swagger.yaml'));

router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerDocument));

module.exports = router;
