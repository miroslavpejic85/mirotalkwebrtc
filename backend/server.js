'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const auth = require('./middleware/auth');
const cors = require('cors');
const compression = require('compression');
const api = require('./routes/api');
const room = require('./routes/room');
const sms = require('./routes/sms');
const users = require('./routes/users');
const config = require('./config');
const ngrok = require('./common/ngrok');
const sentry = require('./common/sentry');
const path = require('path');

const apiPath = '/api/v1';

sentry.start(); // Start sentry (optional)

const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;
const SERVER_URL = process.env.SERVER_URL;
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DATABASE = process.env.MONGO_DATABASE;

// Mandatory params to make this server up and running

if (!SERVER_HOST || !SERVER_PORT || !SERVER_URL || !MONGO_URL || !MONGO_DATABASE) {
    console.error('Invalid or missing .env file');
    process.exit(1);
}

const home = SERVER_URL;
const apiDocs = home + apiPath + '/docs';

const frontendDir = path.join(__dirname, '../', 'frontend');

const login = path.join(__dirname, '../', 'frontend/html/home.html');
const client = path.join(__dirname, '../', 'frontend/html/client.html');

mongoose.set('strictQuery', true);

mongoose
    .connect(MONGO_URL, { dbName: MONGO_DATABASE })
    .then(() => {
        const app = express();

        app.use(cors());
        app.use(compression());
        app.use(express.static(frontendDir));
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());

        // Logs requests
        app.use((req, res, next) => {
            console.log('[ ' + new Date().toISOString() + ' ] - New request:', {
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
        app.use(apiPath, users);

        app.get('/', (req, res) => {
            res.sendFile(login);
        });

        app.get('/client', auth, (req, res) => {
            res.sendFile(client);
        });

        app.get('/config', auth, (req, res) => {
            console.log('Send config', config);
            res.status(200).json(config);
        });

        app.use('*', (req, res) => {
            res.status(404).json({ message: 'Page not found' });
        });

        app.listen(SERVER_PORT, null, () => {
            if (ngrok.enabled()) {
                ngrok.start();
            } else {
                console.debug('Server', {
                    home: home,
                    apiDocs: apiDocs,
                    nodeVersion: process.versions.node,
                });
            }
        });
    })
    .catch((err) => console.error('Mongoose init connection error: ' + err));

mongoose.connection.on('connected', () => {
    console.log('Mongoose connection open to:', { url: MONGO_URL, db: MONGO_DATABASE });
});

mongoose.connection.on('error', (err) => {
    console.log('Mongoose connection error:', { error: err, url: MONGO_URL, db: MONGO_DATABASE });
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose connection disconnected');
});

process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        console.log('Mongoose connection disconnected through app termination');
        process.exit(0);
    });
});
