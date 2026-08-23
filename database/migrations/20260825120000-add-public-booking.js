module.exports = {
    async up(db) {
        await db.collection('bookingprofiles').createIndex({ userId: 1 }, { unique: true });
        await db.collection('bookingprofiles').createIndex({ slug: 1 }, { unique: true });
        await db
            .collection('bookings')
            .createIndex(
                { profileId: 1, occupiedStarts: 1 },
                { unique: true, partialFilterExpression: { status: 'confirmed' } }
            );
        await db.collection('bookings').createIndex({ userId: 1, startAt: 1 });
        await db.collection('bookings').createIndex({ cancelTokenHash: 1 }, { unique: true });
    },

    async down(db) {
        await db
            .collection('bookings')
            .drop()
            .catch(() => {});
        await db
            .collection('bookingprofiles')
            .drop()
            .catch(() => {});
    },
};
