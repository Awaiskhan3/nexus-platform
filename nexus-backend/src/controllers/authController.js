const crypto = require('crypto');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, generateRandomToken } = require('../utils/jwt');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/email');
const { sendSuccess, sendCreated, sendError, sendUnauthorized, sendNotFound, sendServerError } = require('../utils/response');
const { validationResult } = require('express-validator');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (entrepreneur or investor)
 * @access  Public
 */
const register = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'Validation failed', 400, errors.array());
    }

    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 'An account with this email already exists', 409);
    }

    // Generate email verification token
    const emailVerificationToken = generateRandomToken();

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      emailVerificationToken,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=256`,
    });

    // Send verification email (non-blocking)
    try {
      await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    } catch (emailErr) {
      console.error('Verification email failed (non-fatal):', emailErr.message);
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return sendCreated(res, {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken,
    }, 'Account created successfully');
  } catch (error) {
    console.error('Register error:', error);
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return tokens
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'Validation failed', 400, errors.array());
    }

    const { email, password, role } = req.body;

    // Find user with password (select: false by default)
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      role,
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return sendUnauthorized(res, 'Invalid email, password, or role');
    }

    if (!user.isActive) {
      return sendError(res, 'Your account has been deactivated. Contact support.', 403);
    }

    // Update online status and last seen
    user.isOnline = true;
    user.lastSeen = new Date();

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken,
    }, 'Logged in successfully');
  } catch (error) {
    console.error('Login error:', error);
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user – clear refresh token
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
      refreshToken: null,
    });
    return sendSuccess(res, {}, 'Logged out successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Get new access token using refresh token
 * @access  Public
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return sendUnauthorized(res, 'Refresh token required');

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return sendUnauthorized(res, 'Invalid or expired refresh token');
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return sendUnauthorized(res, 'Invalid or expired refresh token');
  }
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return sendSuccess(res, {}, 'If an account exists with this email, a reset link has been sent');
    }

    const resetToken = generateRandomToken();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return sendError(res, 'Failed to send reset email. Please try again.', 500);
    }

    return sendSuccess(res, {}, 'Password reset link sent to your email');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendError(res, 'Token and new password are required', 400);
    }
    if (newPassword.length < 8) {
      return sendError(res, 'Password must be at least 8 characters', 400);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return sendError(res, 'Invalid or expired reset token', 400);
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = null; // Invalidate all sessions
    await user.save();

    return sendSuccess(res, {}, 'Password reset successfully. Please log in with your new password.');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    return sendSuccess(res, { user: req.user.toPublicJSON() });
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current and new passwords are required', 400);
    }
    if (newPassword.length < 8) {
      return sendError(res, 'New password must be at least 8 characters', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return sendError(res, 'Current password is incorrect', 400);
    }

    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (error) {
    return sendServerError(res, error.message);
  }
};

module.exports = { register, login, logout, refreshToken, forgotPassword, resetPassword, getMe, changePassword };
