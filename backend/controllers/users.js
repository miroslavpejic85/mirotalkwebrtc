'use strict';

const User = require('../models/users');
const Room = require('../models/room');
const nodemailer = require('../lib/nodemailer');
const utils = require('../common/utils');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const USER_REGISTRATION_MODE = process.env.USER_REGISTRATION_MODE == 'true';
const JWT_EXP = process.env.JWT_EXP;
const JWT_KEY = process.env.JWT_KEY;

async function userCreate(req, res) {
    try {
        const { email, username, password } = req.body;
        const userFindOne = await User.findOne({ email: email, username: username });
        console.log('No user found in the storage');
        if (Object.is(userFindOne, null) || Object.keys(userFindOne).length === 0) {
            const token = jwt.sign({ username: username, email: email, password: password }, JWT_KEY, {
                expiresIn: JWT_EXP,
            });
            if (nodemailer.EMAIL_VERIFICATION) {
                console.log('New user, send email confirmation');
                const confirmationCode = `?token=${token}`;
                nodemailer.sendConfirmationEmail(username, email, confirmationCode);
                console.log('New user, sent email confirmation');
                return res.status(201).send({
                    message: '⚠️ Pending account. <br/> Please verify your email to confirm!',
                });
            } else {
                console.log('New user, no email verification needed, going to add it the storage');
                const isUserAdmin = utils.isAdmin(email, username, password);
                const encryptedPassword = await bcrypt.hash(password, 10);
                const userData = new User({
                    email: email,
                    username: username,
                    password: encryptedPassword,
                    role: isUserAdmin ? 'admin' : 'guest',
                    token: token,
                    active: true,
                    createdAt: new Date().toISOString(),
                });
                const userSaveData = await userData.save();
                console.log('User create OK', userSaveData);
                res.status(201).json(userSaveData);
            }
        } else {
            console.log('User already exist');
            res.status(409).json({ message: 'User already exist!' });
        }
    } catch (error) {
        console.error('User', error);
        res.status(400).json({ message: error.message });
    }
}

async function userLogin(req, res) {
    try {
        const { email, username, password } = req.body;
        const dateNow = new Date().toISOString();
        const token = jwt.sign({ email: email, username: username, password: password }, JWT_KEY, {
            expiresIn: JWT_EXP,
        });
        const userFindOne = await User.findOne({ email: email, username: username });

        if (!Object.is(userFindOne, null) && userFindOne.active) {
            console.log('User found, but we going to check if the provided password exists');
            bcrypt.compare(password, userFindOne.password, async function (err, result) {
                if (err) {
                    console.error('login password check', err);
                    return res.status(400).json({ message: err });
                }
                if (result) {
                    console.log('User found, just refresh the token');
                    userFindOne.token = token;
                    userFindOne.updatedAt = dateNow;
                    const saveUserFindOne = await userFindOne.save();
                    console.log('User login OK', saveUserFindOne);
                    res.status(201).json(saveUserFindOne);
                } else {
                    console.log('User found, wrong password!');
                    return res.status(201).send({
                        message: '⚠️ Account already exists. <br/> The password seems wrong!',
                    });
                }
            });
        } else {
            if (USER_REGISTRATION_MODE != true) {
                console.error('USER REGISTRATION MODE DISABLED, user not found!');
                return res.status(201).json({ message: 'User not found!' });
            }
            if (nodemailer.EMAIL_VERIFICATION) {
                console.log('New user, send email confirmation');
                const confirmationCode = `?token=${token}`;
                nodemailer.sendConfirmationEmail(username, email, confirmationCode);
                console.log('User login, sent email confirmation');
                return res.status(201).send({
                    message: '⚠️ Pending account. <br/> Please verify your email to confirm!',
                });
            } else {
                console.log('No email verification, add user to storage...');
                const isUserAdmin = utils.isAdmin(email, username, password);
                const encryptedPassword = await bcrypt.hash(password, 10);
                const userData = new User({
                    email: email,
                    username: username,
                    password: encryptedPassword,
                    role: isUserAdmin ? 'admin' : 'guest',
                    token: token,
                    active: true,
                    createdAt: new Date().toISOString(),
                });
                const userSaveData = await userData.save();
                console.log('User create OK', userSaveData);
                return res.status(201).send({
                    message: `👍 Account created! <br/> Click on Login and enjoy! <br><br>
                    <p>I am hoping you find the application useful. Making a small donation is a great way to let me know you like it and want me to keep working on it. Thank you! ❤️</p>
                    <a href="${nodemailer.SUPPORT}" target="_blanck" style="text-decoration:none;"><h1 style="color:lime;">👉 paypal.me 👈<h1></a>`,
                });
            }
        }
    } catch (error) {
        console.error('login', error);
        res.status(400).json({ message: error.message });
    }
}

async function userConfirmation(req, res) {
    try {
        console.log('userConfirmation query', req.query);
        const { token } = req.query;
        const decoded = jwt.verify(token, JWT_KEY);
        console.log('User confirmation token decoded', decoded);
        const userFindOne = await User.findOne({ email: decoded.email, username: decoded.username });
        if (!userFindOne || Object.keys(userFindOne).length === 0) {
            console.log('User confirmed by email, going to add it the storage');
            const isUserAdmin = utils.isAdmin(decoded.email, decoded.username, decoded.password);
            const encryptedPassword = await bcrypt.hash(decoded.password, 10);
            const userData = new User({
                email: decoded.email,
                username: decoded.username,
                password: encryptedPassword,
                role: isUserAdmin ? 'admin' : 'guest',
                token: token,
                active: true,
                createdAt: new Date().toISOString(),
            });
            const userSaveData = await userData.save();
            console.log('User create OK', userSaveData);
            userSaveData.password = decoded.password.substring(0, 5) + '************';
            res.status(200).json(userSaveData);
            if (nodemailer.EMAIL_VERIFICATION) {
                console.log('Send email to the user');
                nodemailer.sendConfirmationOkEmail(
                    userSaveData.username,
                    userSaveData.email,
                    JSON.stringify(userSaveData, null, 4),
                );
            }
        } else {
            console.log('User already confirmed');
            res.status(409).json({ message: 'User already confirmed!' });
        }
    } catch (error) {
        console.error('confirmationUser', error);
        res.status(400).json({ message: error.message });
    }
}

async function userGet(req, res) {
    try {
        const data = await User.findById(req.params.id);
        res.json(data);
    } catch (error) {
        console.error('getUser', error);
        res.status(400).json({ message: error.message });
    }
}

async function userUpdate(req, res) {
    try {
        const id = req.params.id;
        const updatedData = req.body;
        const options = { new: true };
        const dateNow = new Date().toISOString();
        const encryptedPassword = await bcrypt.hash(updatedData.password, 10);
        const isUserAdmin = utils.isAdmin(updatedData.email, updatedData.username, updatedData.password);
        updatedData.role = isUserAdmin ? 'admin' : 'guest';
        updatedData.password = encryptedPassword;
        updatedData.updatedAt = dateNow;
        const result = await User.findByIdAndUpdate(id, updatedData, options);
        return res.send(result);
    } catch (error) {
        console.error('updateUser', error);
        res.status(400).json({ message: error.message });
    }
}

async function userDelete(req, res) {
    try {
        const id = req.params.id;
        const dataUser = await User.findByIdAndDelete(id);
        if (dataUser && dataUser._id == id) {
            const deleteRooms = await Room.deleteMany({ userId: dataUser._id });
            console.log(
                `Going to delete User with id ${dataUser._id} and all associated rooms (${deleteRooms.deletedCount})`,
            );
            return res.json({
                message: `The User with id ${dataUser._id} and all associated rooms (${deleteRooms.deletedCount}) has been deleted`,
            });
        }
        return res.json({ message: `The User with id ${dataUser._id} has been deleted (no associated rooms found)` });
    } catch (error) {
        console.error('deleteUser', error);
        res.status(400).json({ message: error.message });
    }
}

async function userDeleteALL(req, res) {
    return res.json({ message: '⚠️ Route disabled' });
    try {
        const data = await Room.deleteMany();
        data.deletedCount > 0
            ? res.json({ message: `${data.deletedCount} documents has been deleted` })
            : res.json({ message: 'No documents found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

module.exports = {
    userCreate,
    userLogin,
    userConfirmation,
    userGet,
    userUpdate,
    userDelete,
    userDeleteALL,
};
