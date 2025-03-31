'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const auth = require('./middleware/auth');
const url = require('./middleware/url');
const HtmlInjector = require('./middleware/htmlInjector');
const corsOptions = require('./config/cors');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const api = require('./routes/api');
const room = require('./routes/room');
const sms = require('./routes/sms');
const token = require('./routes/token');
const users = require('./routes/users');
const config = require('./config');
const ngrok = require('./common/ngrok');
const sentry = require('./common/sentry');
const logs = require('./common/logs');
const path = require('path');
const packageJson = require('../package.json');

const log = new logs('Server');

const apiPath = '/api/v1';

sentry.start(); // Start sentry (optional)

const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;
const SERVER_URL = process.env.SERVER_URL;
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DATABASE = process.env.MONGO_DATABASE;

// Mandatory params to make this server up and running

if (!SERVER_HOST || !SERVER_PORT || !SERVER_URL || !MONGO_URL || !MONGO_DATABASE) {
    log.error('Invalid or missing .env file');
    process.exit(1);
}

const home = SERVER_URL;
const apiDocs = home + apiPath + '/docs';

const frontendDir = path.join(__dirname, '../', 'frontend');

const login = path.join(__dirname, '../', 'frontend/html/home.html');
const client = path.join(__dirname, '../', 'frontend/html/client.html');

// File to cache and inject custom HTML data like OG tags and any other elements.
const filesPath = [login, client];
const htmlInjector = new HtmlInjector(filesPath, config || null);

mongoose.set('strictQuery', true);

mongoose
    .connect(MONGO_URL, { dbName: MONGO_DATABASE })
    .then(() => {
        const app = express();

        app.use(helmet.noSniff()); // Enable content type sniffing prevention
        app.use(cors(corsOptions()));
        app.use(compression());
        app.use(express.static(frontendDir));
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());

        // Logs requests
        app.use(url, (req, res, next) => {
            log.debug('New request:', {
                headers: req.headers,
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
            next();
        });

        app.use(apiPath, api);
        app.use(apiPath, room);
        app.use(apiPath, sms);
        app.use(apiPath, token);
        app.use(apiPath, users);

        app.get('/', (req, res) => {
            htmlInjector.injectHtml(login, res);
        });

        app.get('/client', auth, (req, res) => {
            htmlInjector.injectHtml(client, res);
        });

        app.get('/config', auth, (req, res) => {
            log.debug('Send config', config);
            res.status(200).json(config);
        });

        app.use((req, res) => {
            res.status(404).json({ message: 'Page not found' });
        });

        app.listen(SERVER_PORT, null, () => {
            if (ngrok.enabled()) {
                ngrok.start();
            } else {
                log.info('Server', {
                    cors: corsOptions(),
                    home: home,
                    apiDocs: apiDocs,
                    nodeVersion: process.versions.node,
                    app_version: packageJson.version,
                });
            }
        });
    })
    .catch((err) => log.error('Mongoose init connection error: ' + err));

mongoose.connection.on('connected', () => {
    log.debug('Mongoose connection open to:', { url: MONGO_URL, db: MONGO_DATABASE });
});

mongoose.connection.on('error', (err) => {
    log.error('Mongoose connection error:', { error: err, url: MONGO_URL, db: MONGO_DATABASE });
});

mongoose.connection.on('disconnected', () => {
    log.debug('Mongoose connection disconnected');
});

process.on('SIGINT', () => {
    mongoose.connection
        .close()
        .then(() => {
            log.debug('Mongoose connection disconnected through app termination');
            process.exit(0);
        })
        .catch((error) => {
            log.error('Error closing MongoDB connection:', error);
            process.exit(0);
        });
});
