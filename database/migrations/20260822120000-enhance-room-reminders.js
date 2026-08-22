module.exports = {
    async up(db) {
        await db
            .collection('rooms')
            .updateMany(
                { 'reminder.enabled': true, 'reminder.status': { $exists: false } },
                { $set: { 'reminder.status': 'scheduled', 'reminder.attempts': 0 } }
            );
        await db
            .collection('emailinvitations')
            .createIndex({ deliveryId: 1 })
            .catch(() => {});
    },
    async down(db) {
        await db
            .collection('emailinvitations')
            .dropIndex('deliveryId_1')
            .catch(() => {});
        await db.collection('rooms').updateMany(
            {},
            {
                $unset: {
                    'reminder.status': '',
                    'reminder.attempts': '',
                    'reminder.queuedAt': '',
                    'reminder.deliveryId': '',
                    'reminder.timezone': '',
                },
            }
        );
    },
};
