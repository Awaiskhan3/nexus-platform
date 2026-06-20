const mongoose = require('mongoose');

const collaborationRequestSchema = new mongoose.Schema(
  {
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    entrepreneur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'A message is required'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    investmentAmount: {
      type: String,
      default: '',
    },
    responseMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate requests
collaborationRequestSchema.index(
  { investor: 1, entrepreneur: 1, status: 1 },
  { unique: false }
);

const CollaborationRequest = mongoose.model('CollaborationRequest', collaborationRequestSchema);
module.exports = CollaborationRequest;
