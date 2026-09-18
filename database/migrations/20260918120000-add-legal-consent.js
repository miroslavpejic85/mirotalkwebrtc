module.exports = {
    async up(db) {
        await db.collection('users').updateMany(
            { termsAcceptedAt: { $exists: false } },
            {
                $set: {
                    termsAcceptedAt: null,
                    termsVersion: null,
                    privacyPolicyVersion: null,
                },
            }
        );
    },

    async down(db) {
        await db.collection('users').updateMany(
            {},
            {
                $unset: {
                    termsAcceptedAt: '',
                    termsVersion: '',
                    privacyPolicyVersion: '',
                },
            }
        );
    },
};
