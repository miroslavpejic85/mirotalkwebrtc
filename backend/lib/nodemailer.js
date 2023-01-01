'use-strict';

const nodemailer = require('nodemailer');

const SERVER_URL = process.env.SERVER_URL;
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

const transport = nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD,
    },
});

module.exports.sendConfirmationEmail = (name, email, confirmationCode) => {
    transport
        .sendMail({
            from: EMAIL_USERNAME,
            to: email,
            subject: 'MiroTalk WEB - Please confirm your email',
            html: `
			<h1>Email Confirmation</h1>
			<h2>Hello ${name}</h2>
			<p>Thank you for subscribing. Please confirm your email by clicking on the following link</p>
			<a href=${SERVER_URL}/api/v1/user/confirmation/${confirmationCode}> Click here</a>
            <p>If it wasn't you, please ignore this email.</p>
		`,
        })
        .catch((err) => console.error(err));
};

module.exports.sendConfirmationOkEmail = (name, email, credential) => {
    transport
        .sendMail({
            from: EMAIL_USERNAME,
            to: email,
            subject: 'MiroTalk WEB - Email confirmed',
            html: `
			<h1>Email Confirmed</h1>
			<h2>Hello ${name}</h2>
			<p>Thank you for confirmation. Here your account info</p>
			<pre>${credential}</pre>
            <p>Home page</p>
            <a href="${SERVER_URL}" target="_blank">${SERVER_URL}</a>
		`,
        })
        .catch((err) => console.error(err));
};
