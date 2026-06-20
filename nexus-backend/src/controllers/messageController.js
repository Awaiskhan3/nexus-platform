const Message = require('../models/Message');
const User = require('../models/User');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendForbidden, sendServerError } = require('../utils/response');

/**
 * @route   GET /api/messages/conversations
 * @desc    Get all conversations for current user
 * @access  Private
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate to get latest message per conversation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
          isDeleted: false,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$isRead', false] }] }, 1, 0],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    // Populate other user details
    const populated = await Promise.all(
      conversations.map(async (conv) => {
        const msg = conv.lastMessage;
        const otherUserId = msg.sender.toString() === userId.toString() ? msg.receiver : msg.sender;
        const otherUser = await User.findById(otherUserId).select('name avatarUrl isOnline lastSeen role');
        return {
          conversationId: conv._id,
          otherUser,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
            sender: msg.sender,
          },
          unreadCount: conv.unreadCount,
        };
      })
    );

    return sendSuccess(res, { conversations: populated });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/messages/:userId
 * @desc    Get message thread with a specific user
 * @access  Private
 */
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const otherUser = await User.findById(userId);
    if (!otherUser) return sendNotFound(res, 'User not found');

    const conversationId = Message.getConversationId(req.user._id, userId);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [messages, total] = await Promise.all([
      Message.find({ conversationId, isDeleted: false })
        .populate('sender', 'name avatarUrl')
        .populate('receiver', 'name avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments({ conversationId, isDeleted: false }),
    ]);

    // Mark messages as read
    await Message.updateMany(
      { conversationId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Emit read receipt via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('messages_read', { conversationId, readBy: req.user._id });
    }

    return sendSuccess(res, {
      messages: messages.reverse(), // Chronological order
      otherUser: otherUser.toPublicJSON(),
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/messages/:userId
 * @desc    Send a message to a user
 * @access  Private
 */
const sendMessage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) return sendError(res, 'Message content is required', 400);
    if (userId === req.user._id.toString()) return sendError(res, 'Cannot message yourself', 400);

    const receiver = await User.findById(userId);
    if (!receiver) return sendNotFound(res, 'Recipient not found');

    const conversationId = Message.getConversationId(req.user._id, userId);

    const message = await Message.create({
      conversationId,
      sender: req.user._id,
      receiver: userId,
      content: content.trim(),
    });

    await message.populate([
      { path: 'sender', select: 'name avatarUrl' },
      { path: 'receiver', select: 'name avatarUrl' },
    ]);

    // Real-time delivery via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('new_message', message);
      io.to(`user:${req.user._id}`).emit('new_message', message);
    }

    return sendCreated(res, { message }, 'Message sent');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete own message
 * @access  Private
 */
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return sendNotFound(res, 'Message not found');
    if (message.sender.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'You can only delete your own messages');
    }
    message.isDeleted = true;
    message.content = '[Message deleted]';
    await message.save();
    return sendSuccess(res, {}, 'Message deleted');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { getConversations, getMessages, sendMessage, deleteMessage };
