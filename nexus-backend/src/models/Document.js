const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    originalName: { type: String, default: '' },
    fileType: {
      type: String,
      required: true,
    },
    mimeType: { type: String, default: '' },
    size: {
      type: Number, // in bytes
      required: true,
    },
    url: {
      type: String,
      required: [true, 'File URL is required'],
    },
    publicId: {
      type: String, // Cloudinary public ID for deletion
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedWith: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        permission: {
          type: String,
          enum: ['view', 'download'],
          default: 'view',
        },
        sharedAt: { type: Date, default: Date.now },
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      enum: ['pitch_deck', 'financials', 'legal', 'market_research', 'business_plan', 'other'],
      default: 'other',
    },
    description: { type: String, default: '' },
    downloadCount: { type: Number, default: 0 },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: human-readable size
documentSchema.virtual('formattedSize').get(function () {
  const bytes = this.size;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
});

documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ 'sharedWith.user': 1 });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
