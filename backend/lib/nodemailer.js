'use-strict';

const nodemailer = require('nodemailer');

const SERVER_URL = process.env.SERVER_URL;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_VERIFICATION = process.env.EMAIL_VERIFICATION === 'true' || false;
const SUPPORT = 'https://paypal.me/mirotalk?country.x=EN&locale.x=en_EN'; // Thank you!

console.debug('Email', {
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
        .catch((err) => console.error(err));
}

function sendConfirmationOkEmail(name, toEmail, credential) {
    const credentialObj = JSON.parse(credential);
    const { role, email, username, password, active, allow, createdAt, updatedAt } = credentialObj;
    console.log('sendConfirmationOkEmail', credentialObj);
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
                <p>We sincerely hope you're finding our application incredibly useful! Your support means the world to us, and it's what keeps us motivated to continuously improve and expand its features.</p>
                <p>If you've been enjoying your experience and want to see more great things coming your way, please consider making a small donation. Your contribution not only shows us that you appreciate our hard work but also helps us invest in making the application even better for you.</p>
                <p>It's easy to make a difference. Just click the PayPal link below to contribute. Every dollar counts, and your generosity will fuel our dedication to providing you with an exceptional experience.</p>
                <p>Thank you for being a valued part of our community. Your support is what keeps us going, and we can't wait to bring you more amazing updates in the future.</p>
                <a href="${SUPPORT}" target="_blank">PayPal Donation Link</a>
                <br/>
                <p>With gratitude,</p>
                <p>MiroTalk Team</p>
            `,
        })
        .catch((err) => console.error(err));
}

module.exports = {
    sendConfirmationEmail,
    sendConfirmationOkEmail,
    EMAIL_VERIFICATION,
    SUPPORT,
};
