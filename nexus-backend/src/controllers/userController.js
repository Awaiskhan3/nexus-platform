const User = require('../models/User');
const { uploadAvatar, uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');
const { sendSuccess, sendError, sendNotFound, sendServerError } = require('../utils/response');

/**
 * @route   GET /api/users/profile/:id
 * @desc    Get any user's public profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.isActive) {
      return sendNotFound(res, 'User not found');
    }
    return sendSuccess(res, { user: user.toPublicJSON() });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'name', 'bio', 'location', 'website', 'linkedinUrl',
      // Entrepreneur fields
      'startupName', 'pitchSummary', 'fundingNeeded', 'industry', 'foundedYear', 'teamSize',
      // Investor fields
      'investmentInterests', 'investmentStage', 'portfolioCompanies',
      'minimumInvestment', 'maximumInvestment', 'firmName',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No valid fields provided for update', 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, { user: user.toPublicJSON() }, 'Profile updated successfully');
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
      return sendError(res, 'Validation failed', 400, errors);
    }
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/users/avatar
 * @desc    Upload/update avatar
 * @access  Private
 */
const uploadUserAvatar = (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) return sendError(res, err.message, 400);
    if (!req.file) return sendError(res, 'No file uploaded', 400);

    try {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'nexus/avatars',
        transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }],
        resourceType: 'image',
      });

      // Delete old avatar from Cloudinary if it exists
      const user = await User.findById(req.user._id);
      if (user.avatarPublicId) {
        await deleteFromCloudinary(user.avatarPublicId, 'image').catch(() => {});
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { avatarUrl: result.secure_url, avatarPublicId: result.public_id },
        { new: true }
      );

      return sendSuccess(res, { avatarUrl: result.secure_url, user: updatedUser.toPublicJSON() }, 'Avatar updated');
    } catch (uploadError) {
      return sendServerError(res, 'Image upload failed: ' + uploadError.message);
    }
  });
};

/**
 * @route   GET /api/users/entrepreneurs
 * @desc    List all entrepreneurs with optional filters
 * @access  Private
 */
const getEntrepreneurs = async (req, res) => {
  try {
    const { industry, location, search, page = 1, limit = 12 } = req.query;
    const query = { role: 'entrepreneur', isActive: true };

    if (industry) query.industry = { $regex: industry, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { startupName: { $regex: search, $options: 'i' } },
        { pitchSummary: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [entrepreneurs, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return sendSuccess(res, {
      entrepreneurs: entrepreneurs.map((u) => u.toPublicJSON()),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/users/investors
 * @desc    List all investors with optional filters
 * @access  Private
 */
const getInvestors = async (req, res) => {
  try {
    const { interests, stage, search, page = 1, limit = 12 } = req.query;
    const query = { role: 'investor', isActive: true };

    if (interests) query.investmentInterests = { $in: [new RegExp(interests, 'i')] };
    if (stage) query.investmentStage = { $in: [new RegExp(stage, 'i')] };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { firmName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [investors, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return sendSuccess(res, {
      investors: investors.map((u) => u.toPublicJSON()),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   DELETE /api/users/account
 * @desc    Deactivate (soft-delete) own account
 * @access  Private
 */
const deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false, isOnline: false, refreshToken: null });
    return sendSuccess(res, {}, 'Account deactivated successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { getProfile, updateProfile, uploadUserAvatar, getEntrepreneurs, getInvestors, deactivateAccount };
