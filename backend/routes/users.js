'use strict';

const express = require('express');
const auth = require('../middleware/auth');
const validator = require('../middleware/validator');
const User = require('../models/users');
const Room = require('../models/room');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_EXP = process.env.JWT_EXP;
const JWT_KEY = process.env.JWT_KEY;

//CREATE: /api/v1/user

router.post('/user', validator, async (req, res) => {
    try {
        const { email, password } = req.body;
        const userFindOne = await User.findOne({ email: email });
        if (userFindOne && Object.keys(userFindOne).length === 0) {
            const encryptedPassword = await bcrypt.hash(password, 10);
            const token = jwt.sign({ email: email }, JWT_KEY, {
                expiresIn: JWT_EXP,
            });
            const userData = new User({
                email: email,
                password: encryptedPassword,
                token: token,
                createdAt: new Date().toISOString(),
            });
            const userSaveData = await userData.save();
            console.log('User create OK', userSaveData);
            res.status(200).json(userSaveData);
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
        const { email, password } = req.body;
        const dateNow = new Date().toISOString();
        const userFindOne = await User.findOne({ email: email });
        if (userFindOne && Object.keys(userFindOne).length != 0 && bcrypt.compare(password, userFindOne.password)) {
            // User found just refresh the token
            const token = jwt.sign({ email: email }, JWT_KEY, {
                expiresIn: JWT_EXP,
            });
            userFindOne.token = token;
            userFindOne.updatedAt = dateNow;
            const saveUserFindOne = await userFindOne.save();
            console.log('User login OK', saveUserFindOne);
            res.status(201).json(saveUserFindOne);
        } else {
            //Auto create the user if not found (demo purposes)
            const encryptedPassword = await bcrypt.hash(password, 10);
            const token = jwt.sign({ email: email }, JWT_KEY, {
                expiresIn: JWT_EXP,
            });
            const userData = new User({
                email: email,
                password: encryptedPassword,
                token: token,
                createdAt: dateNow,
            });
            const userSaveData = await userData.save();
            console.log('User create OK', userSaveData);
            res.status(201).json(userSaveData);
        }
    } catch (error) {
        console.error('login', error);
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
