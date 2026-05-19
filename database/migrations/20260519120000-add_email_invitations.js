module.exports = {
    async up(db) {
        await db.createCollection('emailinvitations').catch(() => {});
        await db.collection('emailinvitations').createIndex({ status: 1, nextAttemptAt: 1 });
        await db.collection('emailinvitations').createIndex({ userId: 1, createdAt: 1 });
    },
    async down(db) {
        await db
            .collection('emailinvitations')
            .dropIndex('status_1_nextAttemptAt_1')
            .catch(() => {});
        await db
            .collection('emailinvitations')
            .dropIndex('userId_1_createdAt_1')
            .catch(() => {});
        // Optional — uncomment for a full rollback:
        // await db.collection('emailinvitations').drop().catch(() => {});
    },
};
