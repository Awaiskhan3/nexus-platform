const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: [
        'collaboration_request',
        'collaboration_accepted',
        'collaboration_rejected',
        'meeting_scheduled',
        'meeting_accepted',
        'meeting_rejected',
        'meeting_cancelled',
        'meeting_reminder',
        'new_message',
        'document_shared',
        'profile_viewed',
        'system',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed, // Extra context (meetingId, requestId, etc.)
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
