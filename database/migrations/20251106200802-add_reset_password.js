module.exports = {
    async up(db, client) {
        await db.collection('users').updateMany(
            {},
            {
                $set: {
                    resetPasswordToken: undefined,
                    resetPasswordExpires: undefined,
                },
            }
        );
    },
    async down(db, client) {
        await db.collection('users').updateMany(
            {},
            {
                $unset: {
                    resetPasswordToken: '',
                    resetPasswordExpires: '',
                },
            }
        );
    },
};
