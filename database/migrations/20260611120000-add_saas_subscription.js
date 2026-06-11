module.exports = {
    async up(db, client) {
        await db.collection('users').updateMany(
            {},
            {
                $set: {
                    subscriptionType: null,
                    subscriptionStatus: null,
                    stripeCustomerId: undefined,
                    stripeSubscriptionId: undefined,
                    subscriptionExpiresAt: null,
                },
            }
        );
    },
    async down(db, client) {
        await db.collection('users').updateMany(
            {},
            {
                $unset: {
                    subscriptionType: '',
                    subscriptionStatus: '',
                    stripeCustomerId: '',
                    stripeSubscriptionId: '',
                    subscriptionExpiresAt: '',
                },
            }
        );
    },
};
