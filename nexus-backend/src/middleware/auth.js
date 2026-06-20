const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { sendUnauthorized, sendForbidden } = require('../utils/response');

/**
 * Protect routes – verify JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendUnauthorized(res, 'Access token required. Please log in.');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from DB (exclude password)
    const user = await User.findById(decoded.id).select('-password -refreshToken -passwordResetToken -emailVerificationToken');

    if (!user) {
      return sendUnauthorized(res, 'User no longer exists.');
    }

    if (!user.isActive) {
      return sendForbidden(res, 'Your account has been deactivated. Please contact support.');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Invalid token. Please log in again.');
    }
    if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token expired. Please log in again.');
    }
    return sendUnauthorized(res, 'Authentication failed.');
  }
};

/**
 * Restrict access to specific roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendForbidden(res, `Access denied. This route is for ${roles.join(', ')} only.`);
    }
    next();
  };
};

/**
 * Optional auth – attach user if token exists, but don't block if missing
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (_) {
    // Ignore token errors for optional auth
  }
  next();
};

module.exports = { protect, restrictTo, optionalAuth };
