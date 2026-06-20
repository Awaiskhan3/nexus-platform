require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const meetingRoutes = require('./routes/meetings');
const collaborationRoutes = require('./routes/collaborations');
const messageRoutes = require('./routes/messages');
const documentRoutes = require('./routes/documents');
const notificationRoutes = require('./routes/notifications');

// Connect to MongoDB before starting the server
const app = express();
const httpServer = http.createServer(app);

const startServer = async () => {
  await connectDB();

  // ─── Socket.io Setup ───────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach io to app so controllers can access it via req.app.get('io')
  app.set('io', io);

  // Socket.io auth middleware
  const { verifyAccessToken } = require('./utils/jwt');
  const User = require('./models/User');

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('name role isActive');
      if (!user || !user.isActive) return next(new Error('User not found'));
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 User connected: ${socket.user.name} (${userId})`);

    console.log('🔍 socket rooms on connect:', [...socket.rooms]);

    // Join personal room for targeted notifications/messages
    socket.join(`user:${userId}`);
    console.log(`🔔 socket joined personal room: user:${userId}`);

    // Update online status
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }).catch(() => {});
    io.emit('user_online', { userId });

    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.name}`);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).catch(() => {});
      io.emit('user_offline', { userId });
    });

    // User is typing in a conversation
    socket.on('typing_start', ({ receiverId }) => {
      socket.to(`user:${receiverId}`).emit('typing_start', { senderId: userId });
    });

    socket.on('typing_stop', ({ receiverId }) => {
      socket.to(`user:${receiverId}`).emit('typing_stop', { senderId: userId });
    });

    // Join a meeting room
    socket.on('join_meeting', ({ meetingId }) => {
      socket.join(`meeting:${meetingId}`);
      socket.to(`meeting:${meetingId}`).emit('user_joined_meeting', { userId, user: socket.user });
    });

    socket.on('leave_meeting', ({ meetingId }) => {
      socket.leave(`meeting:${meetingId}`);
      socket.to(`meeting:${meetingId}`).emit('user_left_meeting', { userId });
    });

    // ─── WebRTC Video Call Signaling ────────────────────────────────────────────

    // Caller initiates a call to a specific user
    socket.on('call:initiate', async ({ targetUserId, roomId, callerInfo }, callback) => {
      const targetRoomName = `user:${targetUserId}`;
      const targetSockets = await io.in(targetRoomName).allSockets();
      console.log(`📞 call:initiate from ${userId} to ${targetUserId} room=${roomId} targetRoom=${targetRoomName} sockets=${[...targetSockets].join(',')}`);

      if (targetSockets.size === 0) {
        return callback?.({ success: false, message: 'Target user is not currently online' });
      }

      io.to(targetRoomName).emit('call:incoming', {
        roomId,
        callerId: userId,
        callerInfo,
      });

      console.log(`📨 emitted call:incoming to ${targetRoomName} (roomId=${roomId})`);

      callback?.({ success: true });
    });

    // Callee accepts the call
    socket.on('call:accept', ({ roomId, callerId }) => {
      console.log(`📞 call:accept from ${userId} for room=${roomId} to caller=${callerId}`);
      socket.join(`call:${roomId}`);
      socket.to(`user:${callerId}`).emit('call:accepted', { roomId, acceptedBy: userId });
    });

    // Callee rejects the call
    socket.on('call:reject', ({ roomId, callerId }) => {
      console.log(`📞 call:reject from ${userId} for room=${roomId} to caller=${callerId}`);
      socket.to(`user:${callerId}`).emit('call:rejected', { roomId, rejectedBy: userId });
    });

    // Join an already-accepted call room
    socket.on('call:join', ({ roomId }, callback) => {
      socket.join(`call:${roomId}`);
      socket.to(`call:${roomId}`).emit('call:peer_joined', { userId, user: socket.user });
      callback?.({ success: true });
    });

    // WebRTC offer
    socket.on('call:offer', ({ roomId, offer }) => {
      socket.to(`call:${roomId}`).emit('call:offer', { offer, fromUserId: userId });
    });

    // WebRTC answer
    socket.on('call:answer', ({ roomId, answer }) => {
      socket.to(`call:${roomId}`).emit('call:answer', { answer, fromUserId: userId });
    });

    // ICE candidate exchange
    socket.on('call:ice_candidate', ({ roomId, candidate }) => {
      socket.to(`call:${roomId}`).emit('call:ice_candidate', { candidate, fromUserId: userId });
    });

    // End / leave call
    socket.on('call:end', ({ roomId }) => {
      socket.to(`call:${roomId}`).emit('call:ended', { endedBy: userId });
      socket.leave(`call:${roomId}`);
    });

    // Toggle audio/video state — broadcast to room peers
    socket.on('call:toggle_media', ({ roomId, audio, video }) => {
      socket.to(`call:${roomId}`).emit('call:peer_media_toggle', { userId, audio, video });
    });
  });

  app.set('io', io);

  // ─── Express Middleware ────────────────────────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Global rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Stricter rate limit for auth routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many auth attempts, please try again in 15 minutes.' },
  });

  app.use('/api/', limiter);
  app.use('/api/auth', authLimiter);

  // ─── Health Check ─────────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Nexus API is running',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/meetings', meetingRoutes);
  app.use('/api/collaborations', collaborationRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/notifications', notificationRoutes);

  // ─── Error Handling ─────────────────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  // ─── Start Server ─────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Nexus backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`📡 Socket.io ready`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
  });
};

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
