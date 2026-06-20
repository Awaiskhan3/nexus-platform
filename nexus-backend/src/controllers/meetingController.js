const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMeetingNotificationEmail } = require('../utils/email');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendForbidden, sendServerError } = require('../utils/response');

// Helper: create notification + email
const notifyUser = async (io, userId, senderId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({ recipient: userId, sender: senderId, type, title, message, data });

    // Real-time notification via socket
    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }

    // Email notification (non-blocking)
    const recipient = await User.findById(userId);
    if (recipient && data.meeting) {
      sendMeetingNotificationEmail(recipient.email, recipient.name, data.meeting, type.replace('meeting_', '')).catch(
        () => {}
      );
    }
  } catch (err) {
    console.error('Notification error (non-fatal):', err.message);
  }
};

/**
 * @route   POST /api/meetings
 * @desc    Schedule a new meeting
 * @access  Private
 */
const scheduleMeeting = async (req, res) => {
  try {
    const { attendeeId, title, description, scheduledAt, duration, meetingType, agenda } = req.body;

    if (!attendeeId || !title || !scheduledAt || !duration) {
      return sendError(res, 'attendeeId, title, scheduledAt, and duration are required', 400);
    }

    // Validate scheduled time is in the future
    if (new Date(scheduledAt) <= new Date()) {
      return sendError(res, 'Meeting must be scheduled in the future', 400);
    }

    // Confirm attendee exists
    const attendee = await User.findById(attendeeId);
    if (!attendee) return sendNotFound(res, 'Attendee not found');
    if (attendeeId === req.user._id.toString()) {
      return sendError(res, 'You cannot schedule a meeting with yourself', 400);
    }

    // Check for scheduling conflicts – organizer
    const organizerConflict = await Meeting.checkConflict(req.user._id, scheduledAt, duration);
    if (organizerConflict) {
      return sendError(res, 'You already have a meeting scheduled during this time slot', 409);
    }

    // Check for scheduling conflicts – attendee
    const attendeeConflict = await Meeting.checkConflict(attendeeId, scheduledAt, duration);
    if (attendeeConflict) {
      return sendError(res, 'The attendee already has a meeting scheduled during this time slot', 409);
    }

    // Generate a video call link (placeholder – integrate Jitsi/Daily.co in production)
    const meetingLink =
      meetingType === 'video_call'
        ? `https://meet.jit.si/nexus-${Math.random().toString(36).substr(2, 9)}`
        : '';

    const meeting = await Meeting.create({
      title,
      description,
      organizer: req.user._id,
      attendee: attendeeId,
      scheduledAt,
      duration,
      meetingType: meetingType || 'video_call',
      meetingLink,
      agenda,
    });

    await meeting.populate(['organizer', 'attendee']);

    // Notify attendee
    const io = req.app.get('io');
    await notifyUser(io, attendeeId, req.user._id, 'meeting_scheduled',
      'New Meeting Request',
      `${req.user.name} has requested a meeting: "${title}"`,
      { meetingId: meeting._id, meeting }
    );

    return sendCreated(res, { meeting }, 'Meeting scheduled successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/meetings
 * @desc    Get all meetings for current user
 * @access  Private
 */
const getMeetings = async (req, res) => {
  try {
    const { status, upcoming, page = 1, limit = 20 } = req.query;

    const query = {
      $or: [{ organizer: req.user._id }, { attendee: req.user._id }],
    };

    if (status) query.status = status;
    if (upcoming === 'true') {
      query.scheduledAt = { $gte: new Date() };
      query.status = { $in: ['pending', 'accepted'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [meetings, total] = await Promise.all([
      Meeting.find(query)
        .populate('organizer', 'name avatarUrl role email')
        .populate('attendee', 'name avatarUrl role email')
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Meeting.countDocuments(query),
    ]);

    return sendSuccess(res, {
      meetings,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/meetings/:id
 * @desc    Get single meeting by ID
 * @access  Private
 */
const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name avatarUrl role email')
      .populate('attendee', 'name avatarUrl role email');

    if (!meeting) return sendNotFound(res, 'Meeting not found');

    const isParticipant =
      meeting.organizer._id.toString() === req.user._id.toString() ||
      meeting.attendee._id.toString() === req.user._id.toString();

    if (!isParticipant) return sendForbidden(res, 'Access denied');

    return sendSuccess(res, { meeting });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PATCH /api/meetings/:id/respond
 * @desc    Accept or reject a meeting request
 * @access  Private (attendee only)
 */
const respondToMeeting = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return sendError(res, 'Status must be "accepted" or "rejected"', 400);
    }

    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name email avatarUrl')
      .populate('attendee', 'name email avatarUrl');

    if (!meeting) return sendNotFound(res, 'Meeting not found');

    // Only the attendee can respond
    if (meeting.attendee._id.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the invited attendee can respond to this meeting');
    }

    if (meeting.status !== 'pending') {
      return sendError(res, `Cannot respond to a meeting that is already ${meeting.status}`, 400);
    }

    meeting.status = status;
    if (rejectionReason) meeting.rejectionReason = rejectionReason;
    await meeting.save();

    // Notify organizer
    const io = req.app.get('io');
    const notifType = status === 'accepted' ? 'meeting_accepted' : 'meeting_rejected';
    const notifTitle = status === 'accepted' ? 'Meeting Accepted' : 'Meeting Declined';
    const notifMsg =
      status === 'accepted'
        ? `${req.user.name} accepted your meeting request: "${meeting.title}"`
        : `${req.user.name} declined your meeting request: "${meeting.title}"`;

    await notifyUser(io, meeting.organizer._id, req.user._id, notifType, notifTitle, notifMsg, { meetingId: meeting._id, meeting });

    return sendSuccess(res, { meeting }, `Meeting ${status} successfully`);
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PATCH /api/meetings/:id/cancel
 * @desc    Cancel a meeting
 * @access  Private (organizer only)
 */
const cancelMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name email')
      .populate('attendee', 'name email');

    if (!meeting) return sendNotFound(res, 'Meeting not found');

    if (meeting.organizer._id.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the organizer can cancel this meeting');
    }

    if (['completed', 'cancelled'].includes(meeting.status)) {
      return sendError(res, `Meeting is already ${meeting.status}`, 400);
    }

    meeting.status = 'cancelled';
    await meeting.save();

    // Notify attendee
    const io = req.app.get('io');
    await notifyUser(io, meeting.attendee._id, req.user._id, 'meeting_cancelled',
      'Meeting Cancelled',
      `${req.user.name} has cancelled the meeting: "${meeting.title}"`,
      { meetingId: meeting._id }
    );

    return sendSuccess(res, { meeting }, 'Meeting cancelled successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PUT /api/meetings/:id
 * @desc    Update meeting details (organizer only, before meeting starts)
 * @access  Private
 */
const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return sendNotFound(res, 'Meeting not found');

    if (meeting.organizer.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the organizer can update this meeting');
    }

    if (['completed', 'cancelled'].includes(meeting.status)) {
      return sendError(res, `Cannot update a ${meeting.status} meeting`, 400);
    }

    const allowedUpdates = ['title', 'description', 'scheduledAt', 'duration', 'agenda', 'meetingLink', 'notes'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) meeting[field] = req.body[field];
    });

    // If time changed, re-check conflicts
    if (req.body.scheduledAt || req.body.duration) {
      const orgConflict = await Meeting.checkConflict(req.user._id, meeting.scheduledAt, meeting.duration, meeting._id);
      if (orgConflict) return sendError(res, 'Updated time conflicts with another meeting', 409);

      const attConflict = await Meeting.checkConflict(meeting.attendee, meeting.scheduledAt, meeting.duration, meeting._id);
      if (attConflict) return sendError(res, "Updated time conflicts with the attendee's schedule", 409);
    }

    await meeting.save();
    await meeting.populate(['organizer', 'attendee']);

    return sendSuccess(res, { meeting }, 'Meeting updated successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { scheduleMeeting, getMeetings, getMeeting, respondToMeeting, cancelMeeting, updateMeeting };
