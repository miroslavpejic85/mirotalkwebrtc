module.exports = {
    async up(db, client) {
        await db
            .collection('users')
            .updateMany(
                { subscriptionCancelAtPeriodEnd: { $exists: false } },
                { $set: { subscriptionCancelAtPeriodEnd: false } }
            );
    },

    async down(db, client) {
        await db.collection('users').updateMany({}, { $unset: { subscriptionCancelAtPeriodEnd: '' } });
    },
};
