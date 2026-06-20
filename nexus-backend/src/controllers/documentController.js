const Document = require('../models/Document');
const User = require('../models/User');
const { uploadDocument, uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendForbidden, sendServerError } = require('../utils/response');

/**
 * @route   POST /api/documents/upload
 * @desc    Upload a document
 * @access  Private
 */
const uploadDoc = (req, res) => {
  uploadDocument(req, res, async (err) => {
    if (err) return sendError(res, err.message, 400);
    if (!req.file) return sendError(res, 'No file provided', 400);

    try {
      const { name, category, description } = req.body;

      // Upload to Cloudinary
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: `nexus/documents/${req.user._id}`,
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true,
      });

      const extension = req.file.originalname.split('.').pop().toUpperCase();

      const document = await Document.create({
        name: name || req.file.originalname,
        originalName: req.file.originalname,
        fileType: extension,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: result.secure_url,
        publicId: result.public_id,
        owner: req.user._id,
        category: category || 'other',
        description,
      });

      return sendCreated(res, { document }, 'Document uploaded successfully');
    } catch (uploadError) {
      return sendServerError(res, 'Upload failed: ' + uploadError.message);
    }
  });
};

/**
 * @route   GET /api/documents
 * @desc    Get all documents owned by or shared with current user
 * @access  Private
 */
const getDocuments = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const query = {
      $or: [
        { owner: req.user._id },
        { 'sharedWith.user': req.user._id },
        { isPublic: true },
      ],
    };

    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('owner', 'name avatarUrl role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Document.countDocuments(query),
    ]);

    return sendSuccess(res, {
      documents,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/documents/:id
 * @desc    Get single document (with access check)
 * @access  Private
 */
const getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('owner', 'name avatarUrl');
    if (!document) return sendNotFound(res, 'Document not found');

    const isOwner = document.owner._id.toString() === req.user._id.toString();
    const isShared = document.sharedWith.some((s) => s.user.toString() === req.user._id.toString());

    if (!isOwner && !isShared && !document.isPublic) {
      return sendForbidden(res, 'Access denied');
    }

    return sendSuccess(res, { document });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/documents/:id/share
 * @desc    Share a document with another user
 * @access  Private (owner only)
 */
const shareDocument = async (req, res) => {
  try {
    const { userId, permission = 'view' } = req.body;

    const document = await Document.findById(req.params.id);
    if (!document) return sendNotFound(res, 'Document not found');

    if (document.owner.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the document owner can share it');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return sendNotFound(res, 'User to share with not found');

    // Avoid duplicate shares
    const alreadyShared = document.sharedWith.some((s) => s.user.toString() === userId);
    if (alreadyShared) {
      // Update permission
      document.sharedWith = document.sharedWith.map((s) =>
        s.user.toString() === userId ? { ...s.toObject(), permission } : s
      );
    } else {
      document.sharedWith.push({ user: userId, permission });
    }

    await document.save();

    // Notify recipient
    const Notification = require('../models/Notification');
    const io = req.app.get('io');
    const notification = await Notification.create({
      recipient: userId,
      sender: req.user._id,
      type: 'document_shared',
      title: 'Document Shared With You',
      message: `${req.user.name} shared a document with you: "${document.name}"`,
      data: { documentId: document._id },
    });
    if (io) io.to(`user:${userId}`).emit('notification', notification);

    return sendSuccess(res, { document }, 'Document shared successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document
 * @access  Private (owner only)
 */
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return sendNotFound(res, 'Document not found');

    if (document.owner.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'Only the document owner can delete it');
    }

    // Delete from Cloudinary
    if (document.publicId) {
      await deleteFromCloudinary(document.publicId, 'raw').catch(() => {});
    }

    await document.deleteOne();
    return sendSuccess(res, {}, 'Document deleted successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PATCH /api/documents/:id/download
 * @desc    Track download + return URL
 * @access  Private
 */
const downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return sendNotFound(res, 'Document not found');

    const isOwner = document.owner.toString() === req.user._id.toString();
    const isShared = document.sharedWith.some((s) => s.user.toString() === req.user._id.toString());

    if (!isOwner && !isShared && !document.isPublic) {
      return sendForbidden(res, 'Access denied');
    }

    document.downloadCount += 1;
    await document.save();

    return sendSuccess(res, { url: document.url, name: document.originalName || document.name });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { uploadDoc, getDocuments, getDocument, shareDocument, deleteDocument, downloadDocument };
