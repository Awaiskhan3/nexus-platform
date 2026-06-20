const CollaborationRequest = require('../models/CollaborationRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendForbidden, sendServerError } = require('../utils/response');

/**
 * @route   POST /api/collaborations
 * @desc    Send a collaboration request (investor → entrepreneur)
 * @access  Private (investor)
 */
const sendRequest = async (req, res) => {
  try {
    if (req.user.role !== 'investor') {
      return sendForbidden(res, 'Only investors can send collaboration requests');
    }

    const { entrepreneurId, message, investmentAmount } = req.body;

    if (!entrepreneurId || !message) {
      return sendError(res, 'entrepreneurId and message are required', 400);
    }

    const entrepreneur = await User.findById(entrepreneurId);
    if (!entrepreneur || entrepreneur.role !== 'entrepreneur') {
      return sendNotFound(res, 'Entrepreneur not found');
    }

    // Check for existing pending request
    const existing = await CollaborationRequest.findOne({
      investor: req.user._id,
      entrepreneur: entrepreneurId,
      status: 'pending',
    });

    if (existing) {
      return sendError(res, 'You already have a pending collaboration request with this entrepreneur', 409);
    }

    const request = await CollaborationRequest.create({
      investor: req.user._id,
      entrepreneur: entrepreneurId,
      message,
      investmentAmount,
    });

    await request.populate([
      { path: 'investor', select: 'name avatarUrl role firmName' },
      { path: 'entrepreneur', select: 'name avatarUrl role startupName' },
    ]);

    // Notify entrepreneur
    const io = req.app.get('io');
    const notification = await Notification.create({
      recipient: entrepreneurId,
      sender: req.user._id,
      type: 'collaboration_request',
      title: 'New Collaboration Request',
      message: `${req.user.name} is interested in collaborating with your startup`,
      data: { requestId: request._id },
    });

    if (io) io.to(`user:${entrepreneurId}`).emit('notification', notification);

    return sendCreated(res, { request }, 'Collaboration request sent successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/collaborations
 * @desc    Get collaboration requests (sent or received) for current user
 * @access  Private
 */
const getRequests = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;

    let query = {};
    if (req.user.role === 'investor') {
      query.investor = req.user._id;
    } else {
      query.entrepreneur = req.user._id;
    }

    // type=sent|received filter for investors
    if (type === 'sent' && req.user.role === 'investor') query.investor = req.user._id;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [requests, total] = await Promise.all([
      CollaborationRequest.find(query)
        .populate('investor', 'name avatarUrl role firmName investmentInterests')
        .populate('entrepreneur', 'name avatarUrl role startupName industry fundingNeeded')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CollaborationRequest.countDocuments(query),
    ]);

    return sendSuccess(res, {
      requests,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PATCH /api/collaborations/:id/respond
 * @desc    Accept or reject a collaboration request (entrepreneur only)
 * @access  Private (entrepreneur)
 */
const respondToRequest = async (req, res) => {
  try {
    const { status, responseMessage } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return sendError(res, 'Status must be accepted or rejected', 400);
    }

    const request = await CollaborationRequest.findById(req.params.id)
      .populate('investor', 'name email avatarUrl')
      .populate('entrepreneur', 'name email avatarUrl startupName');

    if (!request) return sendNotFound(res, 'Collaboration request not found');

    if (request.entrepreneur._id.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the entrepreneur can respond to this request');
    }

    if (request.status !== 'pending') {
      return sendError(res, `Request has already been ${request.status}`, 400);
    }

    request.status = status;
    if (responseMessage) request.responseMessage = responseMessage;
    await request.save();

    // Notify investor
    const io = req.app.get('io');
    const notifType = status === 'accepted' ? 'collaboration_accepted' : 'collaboration_rejected';
    const notification = await Notification.create({
      recipient: request.investor._id,
      sender: req.user._id,
      type: notifType,
      title: status === 'accepted' ? 'Collaboration Request Accepted!' : 'Collaboration Request Declined',
      message:
        status === 'accepted'
          ? `${request.entrepreneur.name} accepted your collaboration request for ${request.entrepreneur.startupName}`
          : `${request.entrepreneur.name} declined your collaboration request`,
      data: { requestId: request._id },
    });

    if (io) io.to(`user:${request.investor._id}`).emit('notification', notification);

    return sendSuccess(res, { request }, `Request ${status} successfully`);
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   DELETE /api/collaborations/:id
 * @desc    Withdraw/delete a pending request (investor only)
 * @access  Private (investor)
 */
const withdrawRequest = async (req, res) => {
  try {
    const request = await CollaborationRequest.findById(req.params.id);
    if (!request) return sendNotFound(res, 'Request not found');

    if (request.investor.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the investor who sent the request can withdraw it');
    }

    if (request.status !== 'pending') {
      return sendError(res, 'Only pending requests can be withdrawn', 400);
    }

    await request.deleteOne();
    return sendSuccess(res, {}, 'Request withdrawn successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { sendRequest, getRequests, respondToRequest, withdrawRequest };
