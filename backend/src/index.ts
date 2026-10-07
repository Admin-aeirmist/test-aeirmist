import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from './config/env';
import { checkDatabaseHealth, pool } from './db';
import { redis, checkRedisHealth } from './db/redis';

const app = express();
const server = http.createServer(app);

// -------------------------------------------------------------
// Security & Middleware
// -------------------------------------------------------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, capacitor)
    if (!origin) return callback(null, true);
    if (env.CORS_ORIGINS.includes(origin) || env.CORS_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    // Allow all local dev origins
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// -------------------------------------------------------------
// Serve Static Media in Local Mode (Local Storage Driver)
// -------------------------------------------------------------
const localUploadsPath = path.resolve(process.cwd(), env.STORAGE_PATH);
app.use('/media', express.static(localUploadsPath));

// -------------------------------------------------------------
// Production / Health Endpoint
// -------------------------------------------------------------
app.get('/health', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const status = dbOk ? 'healthy' : 'degraded';
  const statusCode = dbOk ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      storageDriver: env.STORAGE_DRIVER,
    },
  });
});

app.get('/api/v1/ping', (_req, res) => {
  res.json({ message: 'Aeirmist Universal API is online', version: '1.0.0' });
});

// -------------------------------------------------------------
// Mount Universal API Routes
// -------------------------------------------------------------
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import chatRoutes from './routes/chat.routes';
import mediaRoutes from './routes/media.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// -------------------------------------------------------------
// Socket.IO Setup with Redis Pub/Sub & WebRTC Signaling
// -------------------------------------------------------------
export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Wire Redis Adapter if Redis is reachable
try {
  const pubClient = redis;
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  console.log('✅ [Socket.IO] Redis pub/sub adapter attached');
} catch (err: any) {
  console.warn('⚠️ [Socket.IO] Running with local memory adapter:', err.message);
}

io.on('connection', (socket) => {
  console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

  // User identification for personal notifications & Redis Presence
  socket.on('identify_user', async (userId: string) => {
    socket.join(`user:${userId}`);
    (socket as any).userId = userId;
    console.log(`👤 [Socket.IO] User ${userId} joined personal channel`);
    try {
      await redis.sadd('online_users', userId);
      io.emit('user_status', { userId, status: 'online' });
    } catch (err) {
      console.warn('⚠️ [Redis] Presence update failed:', err);
    }
  });

  // Fetch all online users from Redis
  socket.on('get_online_users', async () => {
    try {
      const users = await redis.smembers('online_users');
      socket.emit('online_users_list', { users });
    } catch (err) {}
  });

  // Typing indicators
  socket.on('typing_start', (data: { conversationId: string; userId: string; username?: string }) => {
    if (data?.conversationId) {
      socket.to(`conv:${data.conversationId}`).emit('user_typing', data);
    }
  });

  socket.on('typing_stop', (data: { conversationId: string; userId: string }) => {
    if (data?.conversationId) {
      socket.to(`conv:${data.conversationId}`).emit('user_stop_typing', data);
    }
  });

  // Room management for chats
  socket.on('join_room', (roomId: string) => {
    socket.join(roomId);
  });

  socket.on('leave_room', (roomId: string) => {
    socket.leave(roomId);
  });

  // Real-time chat message broadcast
  socket.on('send_message', (data: { conversationId: string; content?: string; type?: string; mediaUrl?: string }) => {
    if (data?.conversationId) {
      socket.to(`conv:${data.conversationId}`).emit('new_message', data);
    }
  });

  // WebRTC Calling Signaling Gateway (Ultra Low-Latency)
  socket.on('call_user', (data: { targetUserId: string; signalData: any; callerInfo: any; callType: 'audio' | 'video' }) => {
    io.to(`user:${data.targetUserId}`).emit('incoming_call', {
      fromSocketId: socket.id,
      signalData: data.signalData,
      callerInfo: data.callerInfo,
      callType: data.callType,
    });
  });

  socket.on('accept_call', (data: { toSocketId: string; signalData: any }) => {
    io.to(data.toSocketId).emit('call_accepted', { signalData: data.signalData });
  });

  socket.on('reject_call', (data: { toSocketId: string }) => {
    io.to(data.toSocketId).emit('call_rejected');
  });

  socket.on('ice_candidate', (data: { toSocketId: string; candidate: any }) => {
    io.to(data.toSocketId).emit('ice_candidate', { candidate: data.candidate });
  });

  socket.on('end_call', (data: { toSocketId: string }) => {
    io.to(data.toSocketId).emit('call_ended');
  });

  socket.on('disconnect', async () => {
    const userId = (socket as any).userId;
    if (userId) {
      try {
        await redis.srem('online_users', userId);
        io.emit('user_status', { userId, status: 'offline', lastSeen: Date.now() });
      } catch (err) {}
    }
  });
});

// -------------------------------------------------------------
// Start Server
// -------------------------------------------------------------
const PORT = env.PORT;
server.listen(PORT, () => {
  console.log(`🚀 [Aeirmist API] Server listening on port ${PORT} (${env.NODE_ENV})`);
  console.log(`📡 [Health Check] http://localhost:${PORT}/health`);
  console.log(`📁 [Storage Driver] ${env.STORAGE_DRIVER.toUpperCase()} -> ${env.STORAGE_PATH}`);
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 [${signal}] Gracefully shutting down...`);
  server.close(async () => {
    try {
      await pool.end();
      redis.disconnect();
      console.log('🔒 Connections closed cleanly. Goodbye!');
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
