module.exports = {
    async up(db) {
        // Initialize recurring subdocument on existing rooms (idempotent).
        await db
            .collection('rooms')
            .updateMany({ recurring: { $exists: false } }, { $set: { recurring: { enabled: false } } });
        // Index used by the recurring scheduler poll to scan enabled rooms.
        await db
            .collection('rooms')
            .createIndex({ 'recurring.enabled': 1 })
            .catch(() => {});
    },
    async down(db) {
        await db
            .collection('rooms')
            .dropIndex('recurring.enabled_1')
            .catch(() => {});
        await db.collection('rooms').updateMany({}, { $unset: { recurring: '' } });
    },
};
