module.exports = {
    async up(db, client) {
        await db.collection('rooms').updateMany({}, { $set: { phone: '[prefix][number]' } });
    },
    async down(db, client) {
        await db.collection('rooms').updateMany({}, { $unset: { phone: '' } });
    },
};
