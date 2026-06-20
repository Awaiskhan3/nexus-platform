const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Meeting date and time is required'],
    },
    duration: {
      type: Number, // in minutes
      required: [true, 'Duration is required'],
      default: 30,
      min: [15, 'Minimum duration is 15 minutes'],
      max: [480, 'Maximum duration is 8 hours'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    meetingType: {
      type: String,
      enum: ['video_call', 'phone_call', 'in_person'],
      default: 'video_call',
    },
    meetingLink: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    agenda: {
      type: String,
      default: '',
    },
    notes: {
      type: String, // Post-meeting notes
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: endTime computed from scheduledAt + duration
meetingSchema.virtual('endTime').get(function () {
  if (this.scheduledAt && this.duration) {
    return new Date(this.scheduledAt.getTime() + this.duration * 60000);
  }
  return null;
});

// Index for conflict detection queries
meetingSchema.index({ organizer: 1, scheduledAt: 1 });
meetingSchema.index({ attendee: 1, scheduledAt: 1 });
meetingSchema.index({ status: 1 });

// Static: check for scheduling conflicts
meetingSchema.statics.checkConflict = async function (userId, scheduledAt, duration, excludeId = null) {
  const startTime = new Date(scheduledAt);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  const query = {
    $or: [{ organizer: userId }, { attendee: userId }],
    status: { $in: ['pending', 'accepted'] },
    $and: [
      { scheduledAt: { $lt: endTime } },
      {
        $expr: {
          $gt: [
            { $add: ['$scheduledAt', { $multiply: ['$duration', 60000] }] },
            startTime,
          ],
        },
      },
    ],
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await this.findOne(query);
  return conflict;
};

const Meeting = mongoose.model('Meeting', meetingSchema);
module.exports = Meeting;
