module.exports = {
    async up(db) {
        // Initialize the per-room duration field on existing rooms (idempotent).
        // null = "no override" -> invitation flow falls back to EMAIL_INVITATION_ICS_DURATION_MIN.
        await db.collection('rooms').updateMany({ duration: { $exists: false } }, { $set: { duration: null } });
    },
    async down(db) {
        await db.collection('rooms').updateMany({}, { $unset: { duration: '' } });
    },
};
