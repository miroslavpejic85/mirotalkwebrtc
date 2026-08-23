'use strict';

const { buildLegacyCalendarUid } = require('../../backend/common/calendar');

module.exports = {
    async up(db) {
        const rooms = db.collection('rooms');
        const invitations = db.collection('emailinvitations');
        const operations = [];
        const cursor = rooms.find(
            { calendarUid: { $exists: false } },
            { projection: { room: 1, date: 1, time: 1, startAt: 1 } }
        );

        for await (const room of cursor) {
            const matchingInvitation = await invitations.findOne(
                {
                    roomId: String(room._id),
                    kind: 'invitation',
                    status: 'sent',
                    date: room.date,
                    time: room.time,
                },
                { sort: { createdAt: 1 }, projection: { room: 1, date: 1, time: 1, startAt: 1 } }
            );
            const uidSource = matchingInvitation || room;
            operations.push({
                updateOne: {
                    filter: { _id: room._id },
                    update: {
                        $set: {
                            calendarUid: buildLegacyCalendarUid(
                                uidSource.room,
                                uidSource.startAt,
                                uidSource.date,
                                uidSource.time
                            ),
                            calendarSequence: 0,
                            calendarRecipients: [],
                        },
                    },
                },
            });
            if (operations.length === 500) {
                await rooms.bulkWrite(operations, { ordered: false });
                operations.length = 0;
            }
        }
        if (operations.length > 0) await rooms.bulkWrite(operations, { ordered: false });
        await rooms.createIndex({ calendarUid: 1 });

        const invitationOperations = [];
        const invitationCursor = invitations.find(
            { calendarUid: { $exists: false } },
            { projection: { room: 1, date: 1, time: 1, startAt: 1 } }
        );
        for await (const invitation of invitationCursor) {
            invitationOperations.push({
                updateOne: {
                    filter: { _id: invitation._id },
                    update: {
                        $set: {
                            calendarUid: buildLegacyCalendarUid(
                                invitation.room,
                                invitation.startAt,
                                invitation.date,
                                invitation.time
                            ),
                            calendarSequence: 0,
                        },
                    },
                },
            });
            if (invitationOperations.length === 500) {
                await invitations.bulkWrite(invitationOperations, { ordered: false });
                invitationOperations.length = 0;
            }
        }
        if (invitationOperations.length > 0) {
            await invitations.bulkWrite(invitationOperations, { ordered: false });
        }
        await invitations.createIndex({ roomId: 1, recipient: 1, calendarUid: 1, calendarSequence: 1 });
    },

    async down(db) {
        const rooms = db.collection('rooms');
        await rooms.dropIndex('calendarUid_1').catch(() => {});
        await rooms.updateMany({}, { $unset: { calendarUid: '', calendarSequence: '', calendarRecipients: '' } });
        await db
            .collection('emailinvitations')
            .dropIndex('roomId_1_recipient_1_calendarUid_1_calendarSequence_1')
            .catch(() => {});
        await db.collection('emailinvitations').updateMany({}, { $unset: { calendarUid: '', calendarSequence: '' } });
    },
};
