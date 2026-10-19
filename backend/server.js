require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const connectDB = require('./db_config/mongodb_conn');
const User = require('./Modal/RegisterModal');
const Message = require('./Modal/Message');
const { checkCanChat } = require('./Controller/connenctonReq');

// Routes
const authRouter = require('./Router/authRouter');
const connectionRouter = require('./Router/connectionRouter');
const chatRouter = require('./Router/chatRouter');
const statusRouter = require('./Router/statusRouter');
const profileRouter = require('./Router/profileRouter');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Security & Utility Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow mobile apps to load uploaded images
  })
);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static upload directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io Setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
});

// Attach io instance to express app so controllers can access it
app.set('io', io);

// Store active users: userId -> socketId
const activeUsers = new Map();

// Socket.io Connection & Real-time Handlers
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || socket.handshake.auth?.userId;

  if (userId && userId !== 'undefined') {
    activeUsers.set(userId.toString(), socket.id);
    socket.userId = userId.toString();
    socket.join(userId.toString());

    // Update user status in DB
    User.findByIdAndUpdate(userId, {
      isOnline: true,
      socketId: socket.id,
    })
      .then(() => {
        // Broadcast online status to all connected users
        io.emit('user-status-changed', {
          userId: userId.toString(),
          isOnline: true,
          lastSeen: new Date(),
        });
        console.log(`🟢 User connected: ${userId} (Socket: ${socket.id})`);
      })
      .catch((err) => console.error('Error updating online status:', err));
  }

  // 1. Private Chat Message
  socket.on('send-message', async (data, callback) => {
    try {
      const { senderId, receiverId, content, messageType, mediaUrl } = data;

      if (!senderId || !receiverId) {
        if (callback) callback({ success: false, error: 'Sender and receiver are required.' });
        return;
      }

      // Security check: Must be accepted friends
      const canChat = await checkCanChat(senderId, receiverId);
      if (!canChat) {
        socket.emit('chat-error', {
          message: 'Chatting is disabled. You are not mutual friends or this user has unfollowed.',
        });
        if (callback) callback({ success: false, error: 'Chatting disabled with this user.' });
        return;
      }

      const isReceiverOnline = activeUsers.has(receiverId.toString());
      const status = isReceiverOnline ? 'delivered' : 'sent';
      const deliveredAt = isReceiverOnline ? new Date() : null;

      const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        content: content || '',
        messageType: messageType || (mediaUrl ? 'image' : 'text'),
        mediaUrl: mediaUrl || '',
        status,
        deliveredAt,
      });

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'fullName profilePic')
        .populate('receiver', 'fullName profilePic');

      // Send to recipient
      io.to(receiverId.toString()).emit('receive-message', populatedMessage);

      // Confirm to sender with delivery status
      socket.emit('message-sent-confirm', populatedMessage);

      if (callback) callback({ success: true, message: populatedMessage });
    } catch (err) {
      console.error('Socket send-message error:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 2. Mark Messages as Seen (Turns tick to GREEN)
  socket.on('mark-seen', async ({ senderId, receiverId }) => {
    try {
      if (!senderId || !receiverId) return;

      const now = new Date();
      await Message.updateMany(
        {
          sender: senderId,
          receiver: receiverId,
          status: { $ne: 'seen' },
        },
        {
          $set: { status: 'seen', seenAt: now },
        }
      );

      // Notify the sender that receiver has SEEN the messages (green tick!)
      io.to(senderId.toString()).emit('messages-seen', {
        byUserId: receiverId.toString(),
        seenAt: now,
      });
    } catch (err) {
      console.error('Socket mark-seen error:', err);
    }
  });

  // 3. Typing Status
  socket.on('typing', ({ senderId, receiverId, senderName }) => {
    io.to(receiverId.toString()).emit('user-typing', {
      senderId,
      senderName,
      isTyping: true,
    });
  });

  socket.on('stop-typing', ({ senderId, receiverId }) => {
    io.to(receiverId.toString()).emit('user-typing', {
      senderId,
      isTyping: false,
    });
  });

  // 4. Video / Audio Call Signaling (WebRTC)
  // Call User
  socket.on('call-user', async ({ userToCall, signalData, from, fromName, fromPic, callType }) => {
    // Security check: Must be accepted friends
    const canChat = await checkCanChat(from, userToCall);
    if (!canChat) {
      socket.emit('call-error', {
        message: 'Calling is not allowed because you are not mutual friends.',
      });
      return;
    }

    const recipientSocket = activeUsers.get(userToCall.toString());
    if (recipientSocket) {
      io.to(userToCall.toString()).emit('incoming-call', {
        signal: signalData,
        from,
        fromName,
        fromPic,
        callType: callType || 'video',
      });
    } else {
      socket.emit('call-failed', {
        message: 'User is currently offline.',
      });
    }
  });

  // Answer Call
  socket.on('answer-call', ({ to, signal }) => {
    io.to(to.toString()).emit('call-accepted', {
      signal,
    });
  });

  // ICE Candidate exchange
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to.toString()).emit('ice-candidate', {
      candidate,
    });
  });

  // End or Reject Call
  socket.on('end-call', async ({ to, callDuration, callType, callStatus }) => {
    io.to(to.toString()).emit('call-ended', {
      callDuration: callDuration || 0,
      callStatus: callStatus || 'completed',
    });

    // Optionally create a call log message
    if (socket.userId) {
      await Message.create({
        sender: socket.userId,
        receiver: to,
        messageType: callType === 'audio' ? 'audio_call_log' : 'video_call_log',
        callDuration: callDuration || 0,
        callStatus: callStatus || 'completed',
        content: `${callType === 'audio' ? 'Audio' : 'Video'} Call (${callStatus || 'completed'})`,
      }).catch((e) => console.error('Call log error:', e));
    }
  });

  socket.on('reject-call', ({ to }) => {
    io.to(to.toString()).emit('call-rejected', {
      message: 'Call declined by user.',
    });
  });

  // 5. Disconnect Handler
  socket.on('disconnect', async () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      const lastSeen = new Date();

      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen,
        socketId: null,
      }).catch((err) => console.error('Disconnect update error:', err));

      io.emit('user-status-changed', {
        userId: socket.userId,
        isOnline: false,
        lastSeen,
      });

      console.log(`🔴 User disconnected: ${socket.userId}`);
    }
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/connection', connectionRouter);
app.use('/api/chat', chatRouter);
app.use('/api/status', statusRouter);
app.use('/api/profile', profileRouter);

// Root health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'MyChat Secure Server is running!',
    timestamp: new Date(),
  });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MyChat Backend running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time messaging, status & video calling`);
});
