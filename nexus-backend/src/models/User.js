const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries
    },
    role: {
      type: String,
      enum: ['entrepreneur', 'investor'],
      required: [true, 'Role is required'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Entrepreneur-specific fields
    startupName: { type: String, default: '' },
    pitchSummary: { type: String, default: '' },
    fundingNeeded: { type: String, default: '' },
    industry: { type: String, default: '' },
    location: { type: String, default: '' },
    foundedYear: { type: Number },
    teamSize: { type: Number, default: 1 },
    website: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },

    // Investor-specific fields
    investmentInterests: [{ type: String }],
    investmentStage: [{ type: String }],
    portfolioCompanies: [{ type: String }],
    totalInvestments: { type: Number, default: 0 },
    minimumInvestment: { type: String, default: '' },
    maximumInvestment: { type: String, default: '' },
    firmName: { type: String, default: '' },

    // Auth tokens
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    refreshToken: { type: String, select: false },

    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for faster queries
userSchema.index({ role: 1 });
userSchema.index({ industry: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: get public profile (no sensitive data)
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.refreshToken;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
