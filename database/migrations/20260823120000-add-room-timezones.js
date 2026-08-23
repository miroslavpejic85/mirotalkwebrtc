'use strict';

const { normalizeTimezone, zonedDateTimeToUtc } = require('../../backend/common/schedule');

module.exports = {
    async up(db) {
        const rooms = db.collection('rooms');
        const operations = [];
        const cursor = rooms.find({}, { projection: { date: 1, time: 1, timezone: 1, 'reminder.timezone': 1 } });

        for await (const room of cursor) {
            const timezone = normalizeTimezone(room.timezone || (room.reminder && room.reminder.timezone)) || 'UTC';
            const startAt = zonedDateTimeToUtc(room.date, room.time, timezone);
            const update = { $set: { timezone } };
            if (startAt) update.$set.startAt = startAt;
            else update.$unset = { startAt: '' };
            operations.push({ updateOne: { filter: { _id: room._id }, update } });

            if (operations.length === 500) {
                await rooms.bulkWrite(operations, { ordered: false });
                operations.length = 0;
            }
        }
        if (operations.length > 0) await rooms.bulkWrite(operations, { ordered: false });
        await rooms.createIndex({ startAt: 1 });
    },

    async down(db) {
        const rooms = db.collection('rooms');
        await rooms.dropIndex('startAt_1').catch(() => {});
        await rooms.updateMany({}, { $unset: { timezone: '', startAt: '' } });
    },
};
