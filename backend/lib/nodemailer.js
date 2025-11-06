'use strict';

const logs = require('../common/logs');
const nodemailer = require('nodemailer');

const log = new logs('NodeMailer');

const SERVER_URL = process.env.SERVER_URL;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USERNAME;
const EMAIL_VERIFICATION = process.env.EMAIL_VERIFICATION === 'true' || false;
const SUPPORT =
    'https://codecanyon.net/item/mirotalk-webrtc-ultimate-bundle-for-seamless-live-smart-communication/47976343'; // Thank you!

log.info('Email', {
    verification: EMAIL_VERIFICATION,
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    username: EMAIL_USERNAME,
    password: EMAIL_PASSWORD,
    from: EMAIL_FROM,
});

const IS_TLS_PORT = EMAIL_PORT === 465;
const transport = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: IS_TLS_PORT,
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
            from: EMAIL_FROM,
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

function sendPasswordResetEmail(name, email, resetUrl) {
    transport
        .sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'MiroTalk WEB - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #316fb2;">Password Reset Request</h1>
                    <h2>Hello ${name}</h2>
                    <p>You recently requested to reset your password. Click the button below to reset it:</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #316fb2; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        This link will expire in 1 hour.<br>
                        If you didn't request this, please ignore this email.
                    </p>
                    <br/>
                    <p>Enjoying our app? Unlock its full potential with a MiroTalk purchase on CodeCanyon.</p>
                    <a href="${SUPPORT}" target="_blank">Purchase from CodeCanyon</a>
                    <br/>
                    <p>Thank you for your support!</p>
                    <p>MiroTalk Team</p>
                </div>
            `,
        })
        .catch((err) => log.error(err));
}

function sendPasswordChangeConfirmation(name, email) {
    transport
        .sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'MiroTalk WEB - Password Changed Successfully',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #10b981;">Password Changed Successfully</h1>
                    <h2>Hello ${name}</h2>
                    <p>Your password has been successfully changed.</p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        If you didn't make this change, please contact support immediately.
                    </p>
                    <br/>
                    <p>Home page</p>
                    <a href="${SERVER_URL}" target="_blank">${SERVER_URL}</a>
                    <br/>
                    <p>Thank you for your support!</p>
                    <p>MiroTalk Team</p>
                </div>
            `,
        })
        .catch((err) => log.error(err));
}

module.exports = {
    sendConfirmationEmail,
    sendConfirmationOkEmail,
    sendPasswordResetEmail,
    sendPasswordChangeConfirmation,
    EMAIL_VERIFICATION,
    SUPPORT,
};
