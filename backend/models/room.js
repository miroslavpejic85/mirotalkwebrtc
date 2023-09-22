'use-strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    userId: { type: String, unique: false },
    room: { type: String },
    type: { type: String, enum: ['P2P', 'SFU', 'C2C', 'BRO'] },
    hostUserID: [{ type: String, required: true, ref: 'creatorPublicSchema' }],
    clientUserID: [{ type: String, required: true, ref: 'consumerSchema' }],
    startDateTime: { type: String, required: true },
    endDateTime: { type: String, required: true },
    status: { type: String, required: true },
});

module.exports = mongoose.model('Room', roomSchema);

// var one_to_one_bookings = new Schema({
//     host: [
//       { type: Schema.Types.ObjectId, required: true, ref: "creatorPublicSchema" },
//     ],
//     client: [
//       { type: Schema.Types.ObjectId, required: true, ref: "consumerSchema" },
//     ],
//     meeting_link: { type: String, required: true },
//     start_time: { type: Date, required: true },
//     end_time: { type: Date, required: true },
//     expiryMeetingLinkDate: { type: Date, required: true },
//     isExpired: { type: Boolean, required: true },
//   });
