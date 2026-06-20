const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendNotFound, sendServerError } = require('../utils/response');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    const { isRead, page = 1, limit = 20 } = req.query;

    const query = { recipient: req.user._id };
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'name avatarUrl role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    return sendSuccess(res, {
      notifications,
      unreadCount,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark single notification as read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return sendNotFound(res, 'Notification not found');
    return sendSuccess(res, { notification }, 'Marked as read');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return sendSuccess(res, {}, 'All notifications marked as read');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    if (!notification) return sendNotFound(res, 'Notification not found');
    return sendSuccess(res, {}, 'Notification deleted');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
