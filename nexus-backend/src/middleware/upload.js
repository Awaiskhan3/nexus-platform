const multer = require('multer');
const path = require('path');

// Use memory storage so we can stream to Cloudinary
const storage = multer.memoryStorage();

// File filter – allowed types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Allowed types: PDF, Word, Excel, PowerPoint, images.`), false);
  }
};

// Upload single document (max 10MB)
const uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single('document');

// Upload avatar (max 2MB, images only)
const uploadAvatar = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'), false);
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single('avatar');

/**
 * Upload buffer to Cloudinary
 * Call this after multer has processed the file
 */
const uploadToCloudinary = async (fileBuffer, options = {}) => {
  // Dynamic import to avoid issues if cloudinary not configured
  const cloudinary = require('cloudinary').v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'nexus',
        resource_type: options.resourceType || 'auto',
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete from Cloudinary by public_id
 */
const deleteFromCloudinary = async (publicId, resourceType = 'raw') => {
  const cloudinary = require('cloudinary').v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = {
  uploadDocument,
  uploadAvatar,
  uploadToCloudinary,
  deleteFromCloudinary,
};
