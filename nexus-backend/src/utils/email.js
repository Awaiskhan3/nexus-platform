const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Nexus Platform" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Reset Your Nexus Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reset Your Password</h2>
        <p>Hi ${name},</p>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 16px 0;
        ">Reset Password</a>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">Nexus Platform – Connecting Investors & Entrepreneurs</p>
      </div>
    `,
  });
};

/**
 * Send email verification
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Nexus Platform" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Verify Your Nexus Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Nexus!</h2>
        <p>Hi ${name},</p>
        <p>Thanks for signing up. Please verify your email address to get started:</p>
        <a href="${verifyUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 16px 0;
        ">Verify Email</a>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">Nexus Platform – Connecting Investors & Entrepreneurs</p>
      </div>
    `,
  });
};

/**
 * Send meeting notification email
 */
const sendMeetingNotificationEmail = async (email, name, meetingDetails, type) => {
  const subjects = {
    scheduled: 'New Meeting Request on Nexus',
    accepted: 'Your Meeting Has Been Accepted',
    rejected: 'Your Meeting Request Was Declined',
    reminder: 'Upcoming Meeting Reminder',
  };

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Nexus Platform" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: subjects[type] || 'Meeting Update on Nexus',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${subjects[type]}</h2>
        <p>Hi ${name},</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Meeting:</strong> ${meetingDetails.title}</p>
          <p><strong>Date:</strong> ${new Date(meetingDetails.scheduledAt).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${meetingDetails.duration} minutes</p>
          ${meetingDetails.meetingLink ? `<p><strong>Link:</strong> <a href="${meetingDetails.meetingLink}">${meetingDetails.meetingLink}</a></p>` : ''}
        </div>
        <a href="${process.env.FRONTEND_URL}/meetings" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        ">View Meeting</a>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">Nexus Platform</p>
      </div>
    `,
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendMeetingNotificationEmail,
};
