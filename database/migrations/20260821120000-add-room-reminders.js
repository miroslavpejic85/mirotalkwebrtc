module.exports = {
    async up(db) {
        await db
            .collection('rooms')
            .updateMany({ reminder: { $exists: false } }, { $set: { reminder: { enabled: false } } });
        await db
            .collection('rooms')
            .createIndex({ 'reminder.enabled': 1, 'reminder.scheduledFor': 1 })
            .catch(() => {});
    },
    async down(db) {
        await db
            .collection('rooms')
            .dropIndex('reminder.enabled_1_reminder.scheduledFor_1')
            .catch(() => {});
        await db.collection('rooms').updateMany({}, { $unset: { reminder: '' } });
    },
};
