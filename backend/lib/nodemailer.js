'use-strict';

const logs = require('../common/logs');
const nodemailer = require('nodemailer');

const log = new logs('NodeMailer');

const SERVER_URL = process.env.SERVER_URL;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_VERIFICATION = process.env.EMAIL_VERIFICATION === 'true' || false;
const SUPPORT =
    'https://codecanyon.net/item/mirotalk-webrtc-ultimate-bundle-for-seamless-live-smart-communication/47976343'; // Thank you!

log.info('Email', {
    verification: EMAIL_VERIFICATION,
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    username: EMAIL_USERNAME,
    password: EMAIL_PASSWORD,
});

const transport = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD,
    },
});

function sendConfirmationEmail(name, email, confirmationCode) {
    transport
        .sendMail({
            from: EMAIL_USERNAME,
            to: email,
            subject: 'MiroTalk WEB - Please confirm your email',
            html: `
                <h1>Email Confirmation</h1>
                <h2>Hello ${name}</h2>
                <p>Thank you for subscribing. Please confirm your email by clicking on the following link</p>
                <a href=${SERVER_URL}/api/v1/user/confirmation/${confirmationCode}> Click here to confirm</a>
                <p>If it wasn't you, please ignore this email.</p>
            `,
        })
        .catch((err) => log.error(err));
}

function sendConfirmationOkEmail(name, toEmail, credential) {
    const credentialObj = JSON.parse(credential);
    const { role, email, username, password, active, allow, allowedRooms, createdAt, updatedAt } = credentialObj;
    log.debug('sendConfirmationOkEmail', credentialObj);
    transport
        .sendMail({
            from: EMAIL_USERNAME,
            to: toEmail,
            subject: 'MiroTalk WEB - Email confirmed',
            html: `
                <h1>Email Confirmed</h1>
                <h2>Hello ${name}</h2>
                <p>Thank you for confirmation. Here your account info</p>
                <style>
                    table {
                        font-family: arial, sans-serif;
                        border-collapse: collapse;
                        width: 100%;
                    }
                    td {
                        border: 1px solid #dddddd;
                        text-align: left;
                        padding: 8px;
                    }
                    tr:nth-child(even) {
                        background-color: #dddddd;
                    }
                </style>
                <table>
                    <tr>
                        <td>Role</td>
                        <td>${role}</td>
                    </tr>
                    <tr>
                        <td>Email</td>
                        <td>${email}</td>
                    </tr>
                    <tr>
                        <td>Username</td>
                        <td>${username}</td>
                    </tr>
                    <tr>
                        <td>Password</td>
                        <td>${password}</td>
                    </tr>
                    <tr>
                        <td>Active</td>
                        <td>${active}</td>
                    </tr>
                    <tr>
                        <td>Allowed services</td>
                        <td>${allow}</td>
                    </tr>
                    <tr>
                        <td>Allowed rooms</td>
                        <td>${allowedRooms}</td>
                    </tr>
                    <tr>
                        <td>Created at</td>
                        <td>${createdAt}</td>
                    </tr>
                    <tr>
                        <td>Updated at</td>
                        <td>${updatedAt}</td>
                    </tr>
                </table>
                <br/>
                <p>Home page</p>
                <a href="${SERVER_URL}" target="_blank">${SERVER_URL}</a>
                <br/> 
                <p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p> 
                <p>Get <strong>License</strong>, <strong>Full Source Code</strong>, and <strong>Priority Support</strong>, plus access to all updates. Your purchase fuels future improvements!</p> 
                <p>Ready to upgrade? Click below to choose your MiroTalk package.</p> 
                <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a> 
                <br/> 
                <p>Thank you for your support!</p> 
                <p>MiroTalk Team</p>
            `,
        })
        .catch((err) => log.error(err));
}

module.exports = {
    sendConfirmationEmail,
    sendConfirmationOkEmail,
    EMAIL_VERIFICATION,
    SUPPORT,
};
