'use strict';

const User = require('../models/users');
const Room = require('../models/room');
const Booking = require('../models/booking');
const BookingProfile = require('../models/bookingProfile');
const Event = require('../models/event');
const EmailInvitation = require('../models/emailInvitation');
const nodemailer = require('../lib/nodemailer');
const stripeLib = require('../lib/stripe');
const utils = require('../common/utils');
const logs = require('../common/logs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { setAuthCookie } = require('../common/authCookie');

const log = new logs('Controllers-users');

const USER_REGISTRATION_MODE = process.env.USER_REGISTRATION_MODE == 'true';
const LEGAL_POLICY_VERSION = process.env.LEGAL_POLICY_VERSION || '2026-09-18';

const USER_DEMO = {
    enabled: process.env.USER_DEMO_MODE == 'true',
    username: process.env.USER_DEMO_USERNAME,
    password: process.env.USER_DEMO_PASSWORD,
    email: process.env.USER_DEMO_EMAIL,
};

function getLegalConsent(body) {
    if (body.legalConsent !== true || body.legalVersion !== LEGAL_POLICY_VERSION) return null;
    return {
        termsAcceptedAt: new Date(),
        termsVersion: LEGAL_POLICY_VERSION,
        privacyPolicyVersion: LEGAL_POLICY_VERSION,
    };
}

async function userCreate(req, res) {
    try {
        const { email, username, password } = req.body;
        const legalConsent = getLegalConsent(req.body);
        if (!legalConsent) {
            return res.status(400).json({ message: 'Current Terms of Service and Privacy Policy must be accepted' });
        }
        const userFindOne = await User.findOne({ email: email, username: username });
        log.debug('No user found in the storage');
        if (Object.is(userFindOne, null) || Object.keys(userFindOne).length === 0) {
            const payload = { username: username, email: email, password: password, ...legalConsent };
            const token = utils.tokenEncode(payload);

            if (nodemailer.EMAIL_VERIFICATION) {
                log.debug('New user, send email confirmation');
                const confirmationCode = `?token=${token}`;
                await nodemailer.sendConfirmationEmail(username, email, confirmationCode);
                log.debug('New user, sent email confirmation');
                return res.status(201).send({
                    pending: true,
                    message: 'Check your inbox to confirm your account.',
                });
            } else {
                log.debug('New user, no email verification needed, going to add it the storage');
                const isUserAdmin = await utils.isAdmin(email, username, password);
                const encryptedPassword = await bcrypt.hash(password, 10);
                const userData = new User({
                    email: email,
                    username: username,
                    password: encryptedPassword,
                    role: isUserAdmin ? 'admin' : 'guest',
                    token: token,
                    active: true,
                    ...legalConsent,
                    createdAt: new Date().toISOString(),
                });
                const userSaveData = await userData.save();
                log.debug('User create OK', userSaveData);
                const safeUser = userSaveData.toObject();
                delete safeUser.password;
                delete safeUser.token;
                delete safeUser.resetPasswordToken;
                delete safeUser.resetPasswordExpires;
                delete safeUser.stripeCustomerId;
                delete safeUser.stripeSubscriptionId;
                res.status(201).json(safeUser);
            }
        } else {
            log.debug('User already exist');
            res.status(409).json({ message: 'User already exist!' });
        }
    } catch (error) {
        log.error('User', error);
        res.status(400).json({ message: error.message });
    }
}

/**
 * Public endpoint exposing whether the shared demo account is available.
 * Credentials are only returned when USER_DEMO_MODE is enabled, so the
 * landing page can offer a one-click "Try the demo" login. When disabled,
 * no credentials leak to the client.
 */
async function userDemoConfig(req, res) {
    try {
        if (!USER_DEMO.enabled) {
            return res.status(200).json({ enabled: false });
        }
        return res.status(200).json({
            enabled: true,
            username: USER_DEMO.username,
            email: USER_DEMO.email,
            password: USER_DEMO.password,
        });
    } catch (error) {
        log.error('userDemoConfig', error);
        res.status(400).json({ enabled: false });
    }
}

async function userLogin(req, res) {
    try {
        const { email, username, password } = req.body;
        const dateNow = new Date().toISOString();

        const isUserDemo =
            USER_DEMO.enabled &&
            email === USER_DEMO.email &&
            username === USER_DEMO.username &&
            password === USER_DEMO.password;

        const payload = { username: username, email: email, password: password };
        const token = utils.tokenEncode(payload);

        //const userFindOne = await User.findOne({ email: email });
        const userFindOne = await User.findOne({
            $or: [{ email: email }, { username: username }],
        });

        if (!Object.is(userFindOne, null) && userFindOne.active) {
            log.debug('User found, but we going to check if the provided password exists');
            bcrypt.compare(password, userFindOne.password, async function (err, result) {
                if (err) {
                    log.error('login password check', err);
                    return res.status(400).json({ message: err });
                }
                if (result) {
                    log.debug('User found, but we going to check if the provided username is correct');
                    if (userFindOne.username !== username) {
                        log.debug('User found, wrong username!');
                        return res.status(201).send({
                            message: '⚠️ Invalid credentials. <br/> Please check your email, username and password.',
                        });
                    }
                    log.debug('User found, just refresh the token');
                    if ((await utils.isAdmin(email, username, password)) && userFindOne.role !== 'admin') {
                        userFindOne.role = 'admin';
                    }
                    userFindOne.token = token;
                    userFindOne.updatedAt = dateNow;
                    const saveUserFindOne = await userFindOne.save();
                    log.debug('User login OK', saveUserFindOne);
                    setAuthCookie(res, token);
                    res.status(201).json(saveUserFindOne);
                } else {
                    log.debug('User found, wrong password!');
                    return res.status(201).send({
                        message: '⚠️ Invalid credentials. <br/> Please check your email, username and password.',
                    });
                }
            });
        } else {
            if (!Object.is(userFindOne, null) && !userFindOne.active) {
                log.debug('User found but account is deactivated');
                return res.status(201).send({
                    message:
                        '⚠️ Your account has been deactivated by the administrator. <br/> Please contact the admin for assistance.',
                });
            }
            if (USER_REGISTRATION_MODE != true) {
                log.error('USER REGISTRATION MODE DISABLED, user not found!');
                return res
                    .status(201)
                    .json({ message: '⚠️ Invalid credentials. <br/> Please check your email, username and password.' });
            }
            const legalConsent = isUserDemo ? {} : getLegalConsent(req.body);
            if (!isUserDemo && !legalConsent) {
                return res
                    .status(400)
                    .json({ message: 'Current Terms of Service and Privacy Policy must be accepted' });
            }
            log.debug(`User demo: ${isUserDemo}`);
            if (!isUserDemo && nodemailer.EMAIL_VERIFICATION) {
                const confirmationToken = utils.tokenEncode({
                    username,
                    email,
                    password,
                    ...legalConsent,
                });
                log.debug('New user, send email confirmation');
                const confirmationCode = `?token=${confirmationToken}`;
                await nodemailer.sendConfirmationEmail(username, email, confirmationCode);
                log.debug('User login, sent email confirmation');
                return res.status(201).send({
                    pending: true,
                    message: 'Check your inbox to confirm your account.',
                });
            } else {
                log.debug('No email verification, add user to storage...');
                const isUserAdmin = await utils.isAdmin(email, username, password);
                const encryptedPassword = await bcrypt.hash(password, 10);
                const userData = new User({
                    email: email,
                    username: username,
                    password: encryptedPassword,
                    role: isUserAdmin ? 'admin' : 'guest',
                    token: token,
                    active: true,
                    ...legalConsent,
                    createdAt: new Date().toISOString(),
                });
                const userSaveData = await userData.save();
                log.debug('User create OK', userSaveData);
                return res.status(201).send({
                    success: true,
                    message: `<style>
                    .container {
                        text-align: center;
                        background-color: var(--primary-color);
                        border-radius: 10px;
                        padding: 20px;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    }
                    h1 {
                        color: #4CAF50;
                        margin-bottom: 10px;
                    }
                    p {
                        color: var(--text-color);
                        margin-bottom: 20px;
                    }
                    a {
                        text-decoration: none;
                        color: #4CAF50;
                        font-weight: bold;
                        border: 2px solid #4CAF50;
                        border-radius: 5px;
                        padding: 10px 20px;
                        display: inline-block;
                        transition: background-color 0.3s, color 0.3s;
                    }
                    a:hover {
                        background-color: #4CAF50;
                        color: #fff;
                    }
                    </style>
                    <div class="container">
                        <h1>Account created!</h1>
                        <p>Click on Login and enjoy!</p>
                        ${nodemailer.getUpgradeMessage('/pricing')}
                    </div>`,
                });
            }
        }
    } catch (error) {
        log.error('login', error);
        res.status(400).json({ message: error.message });
    }
}

async function userIsAuth(req, res) {
    try {
        log.debug('userIsAuth query', req.body);

        const { email, username, password } = req.body;

        // Check by email (uuid) or username as indexed
        const userFindOne = await User.findOne({
            $or: [{ email: email }, { username: username ? username : email }],
        });

        if (Object.is(userFindOne, null) || !userFindOne.active) {
            log.debug('user not found!', email);
            return res.status(201).json({ message: false });
        }

        bcrypt
            .compare(password, userFindOne.password)
            .then((isPasswordValid) => {
                log.debug('bcrypt compare isPasswordValid', isPasswordValid);
                return res.status(201).json({ message: isPasswordValid });
            })
            .catch((error) => {
                log.error('bcrypt compare error', error);
                return res.status(400).json({ message: error.message });
            });
    } catch (error) {
        log.error('userIsAuth', error);
        res.status(400).json({ message: error.message });
    }
}

async function userIsRoomAllowed(req, res) {
    try {
        log.debug('userIsRoomAllowed query', req.body);

        const { email, username, room } = req.body;

        // Check by email (uuid) or username as indexed
        const userFindOne = await User.findOne({
            $or: [{ email: email }, { username: username ? username : email }],
        });

        if (Object.is(userFindOne, null) || !userFindOne.active) {
            log.debug('user not found!', email);
            return res.status(201).json({ message: false });
        }

        const roomAllowedForUser = userFindOne.allowedRooms.includes('*') || userFindOne.allowedRooms.includes(room);

        log.debug('userIsRoomAllowed', roomAllowedForUser);

        return roomAllowedForUser
            ? res.status(201).json({ message: roomAllowedForUser })
            : res.status(400).json({ message: false });
    } catch (error) {
        log.error('userIsRoomAllowed', error);
        res.status(400).json({ message: error.message });
    }
}

async function userRoomsAllowed(req, res) {
    try {
        log.debug('userRoomsAllowed query', req.body);

        const { email, username } = req.body;

        // Check by email (uuid) or username as indexed
        const userFindOne = await User.findOne({
            $or: [{ email: email }, { username: username ? username : email }],
        });

        if (Object.is(userFindOne, null) || !userFindOne.active) {
            log.debug('user not found!', email);
            return res.status(201).json({ message: false });
        }

        const roomsAllowedForUser = userFindOne.allowedRooms;

        log.debug('userRoomsAllowed', roomsAllowedForUser);

        res.status(201).json({ message: roomsAllowedForUser });
    } catch (error) {
        log.error('userRoomsAllowed', error);
        res.status(400).json({ message: error.message });
    }
}

async function userConfirmation(req, res) {
    try {
        log.debug('userConfirmation query', req.query);
        const { token } = req.query;
        const decoded = utils.tokenDecode(token);
        if (!decoded) return res.redirect('/confirmation?status=invalid');
        log.debug('User confirmation token decoded', decoded);
        const userFindOne = await User.findOne({ email: decoded.email, username: decoded.username });
        if (!userFindOne || Object.keys(userFindOne).length === 0) {
            log.debug('User confirmed by email, going to add it the storage');
            const isUserAdmin = await utils.isAdmin(decoded.email, decoded.username, decoded.password);
            const encryptedPassword = await bcrypt.hash(decoded.password, 10);
            const userData = new User({
                email: decoded.email,
                username: decoded.username,
                password: encryptedPassword,
                role: isUserAdmin ? 'admin' : 'guest',
                token: token,
                active: true,
                termsAcceptedAt: decoded.termsAcceptedAt || null,
                termsVersion: decoded.termsVersion || null,
                privacyPolicyVersion: decoded.privacyPolicyVersion || null,
                createdAt: new Date().toISOString(),
            });
            const userSaveData = await userData.save();
            log.debug('User create OK', userSaveData);
            res.redirect('/confirmation?status=success');
            if (nodemailer.EMAIL_VERIFICATION) {
                log.debug('Send email to the user');
                nodemailer.sendConfirmationOkEmail(userSaveData.username, userSaveData.email);
            }
        } else {
            log.debug('User already confirmed');
            res.redirect('/confirmation?status=already');
        }
    } catch (error) {
        log.error('confirmationUser', error);
        if (error.name === 'TokenExpiredError') return res.redirect('/confirmation?status=expired');
        if (error.name === 'JsonWebTokenError' || error.name === 'SyntaxError') {
            return res.redirect('/confirmation?status=invalid');
        }
        res.redirect('/confirmation?status=error');
    }
}

async function userResendConfirmation(req, res) {
    try {
        if (!nodemailer.EMAIL_VERIFICATION) {
            return res.status(400).json({ message: 'Email confirmation is not required.' });
        }

        const { email, username, password } = req.body;
        const legalConsent = getLegalConsent(req.body);
        if (!email || !username || !password || !legalConsent) {
            return res.status(400).json({ message: 'Valid registration details and consent are required.' });
        }

        const userFindOne = await User.findOne({ email, username });
        if (userFindOne && Object.keys(userFindOne).length > 0) {
            return res.status(409).json({ confirmed: true, message: 'This account is already confirmed.' });
        }

        const token = utils.tokenEncode({ username, email, password, ...legalConsent });
        await nodemailer.sendConfirmationEmail(username, email, `?token=${token}`);
        return res.status(200).json({
            pending: true,
            message: 'A new confirmation link has been sent.',
        });
    } catch (error) {
        log.error('userResendConfirmation', error);
        res.status(400).json({ message: 'We could not resend the confirmation email. Please try again.' });
    }
}

async function userGetAll(req, res) {
    try {
        const users = await User.find()
            .select(
                '_id email username role allow allowedRooms active accountSetupPending subscriptionType subscriptionStatus subscriptionExpiresAt stripeCustomerId stripeSubscriptionId createdAt updatedAt'
            )
            .sort({ createdAt: -1 })
            .lean();
        res.json(
            users.map(({ stripeCustomerId, stripeSubscriptionId, accountSetupPending, ...user }) => ({
                ...user,
                invitationPending: accountSetupPending === true,
                subscriptionManagedByStripe: !!(stripeCustomerId || stripeSubscriptionId),
            }))
        );
    } catch (error) {
        log.error('getAllUsers', error);
        res.status(400).json({ message: error.message });
    }
}

async function userGet(req, res) {
    try {
        const data = await User.findById(req.params.id).select(
            '-password -token -resetPasswordToken -resetPasswordExpires'
        );
        if (!data) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isAdmin = await utils.isAdmin(req.user.email, req.user.username, req.user.password);

        if (!isAdmin && data.email !== req.user.email) {
            return res.status(403).json({ message: 'You can only read your own account' });
        }

        res.json(data);
    } catch (error) {
        log.error('getUser', error);
        res.status(400).json({ message: error.message });
    }
}

async function userUpdate(req, res) {
    try {
        const id = req.params.id;
        const {
            username,
            password,
            email,
            role,
            active,
            allow,
            allowedRooms,
            subscriptionType,
            subscriptionStatus,
            subscriptionExpiresAt,
        } = req.body;
        const options = { returnDocument: 'after' };

        const user = await User.findById(id).select('email stripeCustomerId stripeSubscriptionId').lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isAdmin = await utils.isAdmin(req.user.email, req.user.username, req.user.password);

        if (!isAdmin && user.email !== req.user.email) {
            return res.status(403).json({ message: 'You can only update your own account' });
        }

        const updatedFields = {};

        // Username is allowed for both admin and self
        if (username !== undefined) updatedFields.username = username;

        // Password is allowed for both admin and self
        if (password) {
            updatedFields.password = await bcrypt.hash(password, 10);
            updatedFields.accountSetupPending = false;
            updatedFields.resetPasswordToken = undefined;
            updatedFields.resetPasswordExpires = undefined;
        }

        // Administrative fields
        if (isAdmin) {
            const hasSubscriptionUpdate =
                subscriptionType !== undefined ||
                subscriptionStatus !== undefined ||
                subscriptionExpiresAt !== undefined;
            if (hasSubscriptionUpdate && (user.stripeCustomerId || user.stripeSubscriptionId)) {
                return res.status(409).json({ message: 'Stripe-managed subscriptions must be changed through Stripe' });
            }
            if (email !== undefined) updatedFields.email = email;
            if (role !== undefined) updatedFields.role = role;
            if (active !== undefined) updatedFields.active = active;
            if (allow !== undefined) updatedFields.allow = allow;
            if (allowedRooms !== undefined) updatedFields.allowedRooms = allowedRooms;
            if (subscriptionType !== undefined) updatedFields.subscriptionType = subscriptionType;
            if (subscriptionStatus !== undefined) updatedFields.subscriptionStatus = subscriptionStatus;
            if (subscriptionExpiresAt !== undefined) updatedFields.subscriptionExpiresAt = subscriptionExpiresAt;
        }

        updatedFields.updatedAt = new Date().toISOString();

        log.debug('Updating user data', { id, updatedFields });
        const result = await User.findByIdAndUpdate(id, updatedFields, options);
        return res.send(result);
    } catch (error) {
        log.error('updateUser', error);
        res.status(400).json({ message: 'Error updating user' });
    }
}

async function userDelete(req, res) {
    try {
        const id = req.params.id;
        const dataUser = await User.findById(id);
        if (!dataUser) return res.status(404).json({ message: 'User not found' });

        const isAdmin = await utils.isAdmin(req.user.email, req.user.username, req.user.password);

        if (!isAdmin && dataUser.email !== req.user.email) {
            return res.status(403).json({ message: 'You can only delete your own account' });
        }

        const userId = String(dataUser._id);
        const [rooms, bookings, bookingProfiles, events, emailInvitations] = await Promise.all([
            Room.deleteMany({ userId }),
            Booking.deleteMany({ userId }),
            BookingProfile.deleteMany({ userId }),
            Event.deleteMany({ userId }),
            EmailInvitation.deleteMany({ userId }),
        ]);
        await stripeLib.cleanupUserBilling(dataUser);
        await User.findByIdAndDelete(id);

        const deleted = {
            rooms: rooms.deletedCount,
            bookings: bookings.deletedCount,
            bookingProfiles: bookingProfiles.deletedCount,
            events: events.deletedCount,
            emailInvitations: emailInvitations.deletedCount,
        };
        log.debug(`Deleted user ${userId} and associated data`, deleted);
        return res.json({
            message: `The user with id ${userId} and all associated data has been deleted`,
            deleted,
        });
    } catch (error) {
        log.error('deleteUser', error);
        res.status(400).json({ message: error.message });
    }
}

async function userDeleteRegularUsers(req, res) {
    try {
        const protectedAccounts = [
            ...(USER_DEMO.email ? [{ email: USER_DEMO.email }] : []),
            ...(USER_DEMO.username ? [{ username: USER_DEMO.username }] : []),
            ...(req.user?.email ? [{ email: req.user.email }] : []),
            { subscriptionStatus: 'active', subscriptionType: 'lifetime' },
            {
                subscriptionStatus: 'active',
                subscriptionType: { $in: ['monthly', 'yearly'] },
                subscriptionExpiresAt: { $gt: new Date() },
            },
        ];
        const query = {
            role: { $ne: 'admin' },
            $nor: protectedAccounts,
        };
        const users = await User.find(query);

        if (users.length === 0) {
            return res.json({ message: 'No users found to delete', deletedCount: 0 });
        }

        const userIds = users.map((user) => String(user._id));
        for (const user of users) {
            await stripeLib.cleanupUserBilling(user);
        }
        await Promise.all([
            Room.deleteMany({ userId: { $in: userIds } }),
            Booking.deleteMany({ userId: { $in: userIds } }),
            BookingProfile.deleteMany({ userId: { $in: userIds } }),
            Event.deleteMany({ userId: { $in: userIds } }),
            EmailInvitation.deleteMany({ userId: { $in: userIds } }),
        ]);
        const result = await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });

        return res.json({
            message: `${result.deletedCount} users and their associated data have been deleted`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        log.error('userDeleteRegularUsers', error);
        res.status(400).json({ message: error.message });
    }
}

async function userGetMe(req, res) {
    try {
        const { email, username } = req.user;
        const userFindOne = await User.findOne({
            $or: [{ email: email }, { username: username }],
        }).select('-password -resetPasswordToken -resetPasswordExpires');

        if (!userFindOne) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(userFindOne);
    } catch (error) {
        log.error('userGetMe', error);
        res.status(400).json({ message: error.message });
    }
}

async function userAdminCreate(req, res) {
    try {
        const { email, username, password, allow, allowedRooms, subscriptionType, subscriptionExpiresAt } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({ message: 'Email, username, and password are required' });
        }
        const normalizedSubscriptionType = subscriptionType === 'none' ? null : subscriptionType || null;
        if (normalizedSubscriptionType && !['monthly', 'yearly', 'lifetime'].includes(normalizedSubscriptionType)) {
            return res.status(400).json({ message: 'Invalid subscription type' });
        }

        let normalizedSubscriptionExpiry = null;
        if (['monthly', 'yearly'].includes(normalizedSubscriptionType)) {
            normalizedSubscriptionExpiry = new Date(subscriptionExpiresAt);
            if (Number.isNaN(normalizedSubscriptionExpiry.getTime()) || normalizedSubscriptionExpiry <= new Date()) {
                return res.status(400).json({ message: 'A future expiry date is required for recurring plans' });
            }
        }
        const userFindOne = await User.findOne({ email: email, username: username });
        if (!Object.is(userFindOne, null) && Object.keys(userFindOne).length > 0) {
            return res.status(409).json({ message: 'User already exist!' });
        }
        log.debug('Admin creating user directly (skip email verification)');
        const isUserAdmin = await utils.isAdmin(email, username, password);
        const encryptedPassword = await bcrypt.hash(password, 10);
        const payload = { username, email, password };
        const token = utils.tokenEncode(payload);
        const userData = new User({
            email: email,
            username: username,
            password: encryptedPassword,
            role: isUserAdmin ? 'admin' : 'guest',
            token: token,
            active: true,
            allow: Array.isArray(allow) && allow.length ? allow : ['ALL'],
            allowedRooms: Array.isArray(allowedRooms) && allowedRooms.length ? allowedRooms : ['*'],
            subscriptionType: normalizedSubscriptionType,
            subscriptionStatus: normalizedSubscriptionType ? 'active' : null,
            subscriptionExpiresAt: normalizedSubscriptionExpiry,
            createdAt: new Date().toISOString(),
        });
        const userSaveData = await userData.save();
        log.debug('Admin user create OK', userSaveData);
        const safeUser = userSaveData.toObject();
        delete safeUser.password;
        delete safeUser.token;
        delete safeUser.resetPasswordToken;
        delete safeUser.resetPasswordExpires;
        delete safeUser.stripeCustomerId;
        delete safeUser.stripeSubscriptionId;
        res.status(201).json(safeUser);
    } catch (error) {
        log.error('userAdminCreate', error);
        res.status(400).json({ message: error.message });
    }
}

async function sendInvitation(req, res) {
    try {
        const { email, username } = req.body;
        if (!email || !username) {
            return res.status(400).json({ message: 'Email and username are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase(), username });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const previousSetup = {
            token: user.resetPasswordToken,
            expires: user.resetPasswordExpires,
            pending: user.accountSetupPending === true,
        };
        const setupToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(setupToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000;
        user.accountSetupPending = true;
        await user.save();

        const setupUrl = `${process.env.SERVER_URL}/password-reset?token=${setupToken}&setup=1`;
        log.debug('Sending invitation email', { email, username });
        try {
            await nodemailer.sendInvitationEmail(username, email, setupUrl);
        } catch (emailError) {
            user.resetPasswordToken = previousSetup.token;
            user.resetPasswordExpires = previousSetup.expires;
            user.accountSetupPending = previousSetup.pending;
            await user.save();
            throw emailError;
        }
        res.status(200).json({ message: 'Secure account invitation sent successfully' });
    } catch (error) {
        log.error('sendInvitation', error);
        res.status(400).json({ message: 'Unable to send the account invitation' });
    }
}

module.exports = {
    userCreate,
    userAdminCreate,
    userLogin,
    userDemoConfig,
    userIsAuth,
    userRoomsAllowed,
    userIsRoomAllowed,
    userConfirmation,
    userResendConfirmation,
    userGetAll,
    userGet,
    userGetMe,
    userUpdate,
    userDelete,
    userDeleteRegularUsers,
    sendInvitation,
};
