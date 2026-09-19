module.exports = {
    async up(db) {
        await db
            .collection('users')
            .updateMany({ accountSetupPending: { $exists: false } }, { $set: { accountSetupPending: false } });
    },
    async down(db) {
        await db.collection('users').updateMany({}, { $unset: { accountSetupPending: '' } });
    },
};
