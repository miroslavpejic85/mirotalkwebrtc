'use strict';

const Room = require('../models/room');
const User = require('../models/users');
const utils = require('../common/utils');
const logs = require('../common/logs');

const log = new logs('Controllers-dashboard');

async function getDashboardStats(req, res) {
    try {
        const { email, username, password } = req.user;
        const isAdmin = utils.isAdmin(email, username, password);
        const today = new Date().toISOString().split('T')[0];

        if (isAdmin) {
            const [
                totalUsers,
                activeUsers,
                adminCount,
                totalRooms,
                roomsByType,
                upcomingRooms,
                todayRooms,
                latestUser,
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ active: true }),
                User.countDocuments({ role: 'admin' }),
                Room.countDocuments(),
                Room.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
                Room.countDocuments({ date: { $gte: today } }),
                Room.countDocuments({ date: today }),
                User.findOne().sort({ createdAt: -1 }).select('username createdAt').lean(),
            ]);

            const typeCounts = { P2P: 0, SFU: 0, C2C: 0, BRO: 0 };
            roomsByType.forEach((r) => {
                if (typeCounts.hasOwnProperty(r._id)) {
                    typeCounts[r._id] = r.count;
                }
            });

            return res.status(200).json({
                isAdmin: true,
                totalUsers,
                activeUsers,
                inactiveUsers: totalUsers - activeUsers,
                adminCount,
                guestCount: totalUsers - adminCount,
                totalRooms,
                roomsByType: typeCounts,
                upcomingRooms,
                todayRooms,
                latestUser: latestUser ? latestUser.username : '-',
                latestUserDate: latestUser ? latestUser.createdAt : null,
            });
        }

        // Guest: personal stats only
        const userDoc = await User.findOne({ email });
        if (!userDoc) {
            return res.status(404).json({ message: 'User not found' });
        }

        const uId = userDoc._id.toString();

        const [myRooms, myRoomsByType, myUpcomingRooms, myTodayRooms] = await Promise.all([
            Room.countDocuments({ userId: uId }),
            Room.aggregate([{ $match: { userId: uId } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
            Room.countDocuments({ userId: uId, date: { $gte: today } }),
            Room.countDocuments({ userId: uId, date: today }),
        ]);

        const typeCounts = { P2P: 0, SFU: 0, C2C: 0, BRO: 0 };
        myRoomsByType.forEach((r) => {
            if (typeCounts.hasOwnProperty(r._id)) {
                typeCounts[r._id] = r.count;
            }
        });

        return res.status(200).json({
            isAdmin: false,
            myRooms,
            myRoomsByType: typeCounts,
            myUpcomingRooms,
            myTodayRooms,
            memberSince: userDoc.createdAt,
        });
    } catch (error) {
        log.error('Dashboard stats error', error);
        res.status(400).json({ message: error.message });
    }
}

module.exports = { getDashboardStats };
