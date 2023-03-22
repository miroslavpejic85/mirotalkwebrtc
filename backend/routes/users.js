'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const validator = require('../middleware/validator');
const router = express.Router();
const User = require('../models/users');
const Room = require('../models/room');
const nodemailer = require('../lib/nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_EXP = process.env.JWT_EXP;
const JWT_KEY = process.env.JWT_KEY;

//CREATE: /api/v1/user

router.post('/user', validator, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userFindOne = await User.findOne({ username: username, email: email });
        if (userFindOne && Object.keys(userFindOne).length === 0) {
            const token = jwt.sign({ username: username, email: email, password: password }, JWT_KEY, {
                expiresIn: JWT_EXP,
            });
            //New user, send email confirmation
            const confirmationCode = `?token=${token}`;
            nodemailer.sendConfirmationEmail(username, email, confirmationCode);
            console.log('New user, sent email confirmation');
            return res.status(201).send({
                message: '⚠️ Pending account. <br/> Please verify your email to confirm!',
            });
        } else {
            console.log('User already exist');
            res.status(409).json({ message: 'User already exist!' });
        }
    } catch (error) {
        console.error('User', error);
        res.status(400).json({ message: error.message });
    }
});

//LOGIN: /api/v1/user/login

router.post('/user/login', validator, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const dateNow = new Date().toISOString();
        const token = jwt.sign({ email: email, username: username, password: password }, JWT_KEY, {
            expiresIn: JWT_EXP,
        });
        const userFindOne = await User.findOne({ email: email, username: username });

        if (userFindOne && Object.keys(userFindOne).length != 0 && userFindOne.active) {
            //User found, but we going to check if the provided password exists
            bcrypt.compare(password, userFindOne.password, async function (err, result) {
                if (err) {
                    console.error('login password check', err);
                    res.status(400).json({ message: err });
                }
                if (result) {
                    //User found, just refresh the token
                    userFindOne.token = token;
                    userFindOne.updatedAt = dateNow;
                    const saveUserFindOne = await userFindOne.save();
                    console.log('User login OK', saveUserFindOne);
                    res.status(201).json(saveUserFindOne);
                } else {
                    //New user, send email confirmation
                    const confirmationCode = `?token=${token}`;
                    nodemailer.sendConfirmationEmail(username, email, confirmationCode);
                    console.log('User login, sent email confirmation');
                    return res.status(201).send({
                        message: '⚠️ Pending account. <br/> Please verify your email to confirm!',
                    });
                }
            });
        }
    } catch (error) {
        console.error('login', error);
        res.status(400).json({ message: error.message });
    }
});

//POST: /api/v1/user/confirmation/?token=<token>

router.get('/user/confirmation', auth, async (req, res) => {
    try {
        console.log('userConfirmation query', req.query);
        const { token } = req.query;
        const decoded = jwt.verify(token, JWT_KEY);
        console.log('User confirmation token decoded', decoded);
        const userFindOne = await User.findOne({ email: decoded.email, username: decoded.username });
        if (!userFindOne || Object.keys(userFindOne).length === 0) {
            //User confirmed by email, going to add it the db
            const encryptedPassword = await bcrypt.hash(decoded.password, 10);
            const userData = new User({
                email: decoded.email,
                username: decoded.username,
                password: encryptedPassword,
                token: token,
                active: true,
                createdAt: new Date().toISOString(),
            });
            const userSaveData = await userData.save();
            console.log('User create OK', userSaveData);
            userSaveData.password = decoded.password.substring(0, 5) + '************';
            res.status(200).json(userSaveData);
            //Send email to the user
            nodemailer.sendConfirmationOkEmail(
                userSaveData.username,
                userSaveData.email,
                JSON.stringify(userSaveData, null, 4),
            );
        } else {
            console.log('User already confirmed');
            res.status(409).json({ message: 'User already confirmed!' });
        }
    } catch (error) {
        console.error('confirmationUser', error);
        res.status(400).json({ message: error.message });
    }
});

//GET: /api/v1/user/id

router.get('/user/:id', auth, async (req, res) => {
    try {
        const data = await User.findById(req.params.id);
        res.json(data);
    } catch (error) {
        console.error('getUser', error);
        res.status(400).json({ message: error.message });
    }
});

//UPDATE: /api/v1/user/id

router.patch('/user/:id', auth, validator, async (req, res) => {
    try {
        const id = req.params.id;
        const updatedData = req.body;
        const options = { new: true };
        const dateNow = new Date().toISOString();
        const encryptedPassword = await bcrypt.hash(updatedData.password, 10);
        updatedData.password = encryptedPassword;
        updatedData.updatedAt = dateNow;
        const result = await User.findByIdAndUpdate(id, updatedData, options);
        return res.send(result);
    } catch (error) {
        console.error('updateUser', error);
        res.status(400).json({ message: error.message });
    }
});

//DELETE: /api/v1/user/id

router.delete('/user/:id', auth, async (req, res) => {
    try {
        const id = req.params.id;
        const dataUser = await User.findByIdAndDelete(id);
        if (dataUser && dataUser._id == id) {
            // I'm going to delete all the rooms associated to this user id
            const deleteRooms = await Room.deleteMany({ userId: dataUser._id });
            return res.json({
                message: `The User with id ${dataUser._id} and all associated rooms (${deleteRooms.deletedCount}) has been deleted`,
            });
        }
        return res.json({ message: `The User with id ${dataUser._id} has been deleted (no associated rooms found)` });
    } catch (error) {
        console.error('deleteUser', error);
        res.status(400).json({ message: error.message });
    }
});

//DELETE: /api/v1/user/deleteALL

router.delete('/user/deleteALL', auth, async (req, res) => {
    return res.json({ message: '⚠️ Route disabled' });
    try {
        const data = await Room.deleteMany();
        data.deletedCount > 0
            ? res.json({ message: `${data.deletedCount} documents has been deleted` })
            : res.json({ message: 'No documents found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
