import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from './config/env';
import { checkDatabaseHealth, pool } from './db';
import { redis, checkRedisHealth } from './db/redis';
import { UserDAL } from './dal/user.dal';

process.on('unhandledRejection', (reason: any) => {
  console.warn('⚠️ [Process] Unhandled Rejection intercepted:', reason?.message || reason);
});

process.on('uncaughtException', (err: any) => {
  console.error('🚨 [Process] Uncaught Exception intercepted:', err?.message || err);
});

const app = express();
const server = http.createServer(app);

// -------------------------------------------------------------
// Security & Middleware
// -------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, capacitor)
    if (!origin) return callback(null, true);

    let parsedHost: string;
    try {
      parsedHost = new URL(origin).hostname;
    } catch {
      return callback(new Error('Invalid Origin header'));
    }

    const isAllowed =
      env.CORS_ORIGINS.includes(origin) ||
      parsedHost === 'aeirmist.com' ||
      parsedHost === 'www.aeirmist.com' ||
      parsedHost.endsWith('.aeirmist.com') ||
      parsedHost === 'aeirmist-f0m.pages.dev' ||
      parsedHost === 'localhost' ||
      parsedHost === '127.0.0.1' ||
      origin.startsWith('capacitor://');

    if (isAllowed) {
      return callback(null, true);
    }
    console.warn(`[CORS Security] Denied unauthorized cross-origin request from: ${origin}`);
    return callback(new Error('Not allowed by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-User-Id', 'X-Profile-Id', 'Cache-Control', 'X-Session-Token', 'X-Device-Trust-Token', 'X-XSRF-TOKEN', 'X-CSRF-Token'],
  exposedHeaders: ['Authorization', 'Content-Disposition'],
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
app.use('/media', express.static(localUploadsPath, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (filePath.endsWith('.html') || filePath.endsWith('.htm') || filePath.endsWith('.svg') || filePath.endsWith('.xml')) {
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Content-Disposition', 'attachment');
    }
  }
}));

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
import storyRoutes from './routes/story.routes';
import adminRoutes from './routes/admin.routes';
import supportRoutes from './routes/support.routes';
import videoRoutes from './routes/video.routes';
import notesRoutes from './routes/notes.routes';
import vaultRoutes from './routes/vault.routes';
import callsRoutes from './routes/calls.routes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/stories', storyRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/notes', notesRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/calls', callsRoutes);

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

import { resolveUserFromCredentials } from './middleware/auth';
import { ChatDAL } from './dal/chat.dal';
import { resolveConversationId } from './routes/chat.routes';

// Socket.IO Authentication Middleware (Strict JWT Validation)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
                  (socket.handshake.headers['authorization']?.startsWith('Bearer ') ? socket.handshake.headers['authorization'].slice(7).trim() : null) ||
                  (socket.handshake.query?.token as string);

    if (!token || token === 'null' || token === 'undefined') {
      return next(new Error('Authentication failed: Missing token'));
    }

    const resolved = await resolveUserFromCredentials(token);
    if (!resolved || !resolved.userId) {
      console.warn(`🔌 [Socket.IO] Handshake rejected for socket ${socket.id}: token failed authentication or user resolution (token prefix: ${token.slice(0, 15)}...)`);
      return next(new Error('Authentication failed: Invalid or expired token'));
    }

    (socket as any).userId = resolved.userId;
    (socket as any).userRole = resolved.role;
    next();
  } catch (err: any) {
    console.warn(`🔌 [Socket.IO] Handshake exception for socket ${socket.id}:`, err?.message);
    next(new Error(`Authentication failed: ${err.message || 'Unauthorized'}`));
  }
});

io.on('connection', async (socket) => {
  const authedUserId = (socket as any).userId;
  if (!authedUserId) {
    socket.disconnect(true);
    return;
  }
  console.log(`🔌 [Socket.IO] Authenticated client connected: ${socket.id} (user: ${authedUserId})`);

  socket.join(`user:${authedUserId}`);
  try {
    const u = await UserDAL.findById(authedUserId);
    if (u?.firebaseUid) socket.join(`user:${u.firebaseUid}`);
    const p = await UserDAL.getProfileByUserId(authedUserId);
    if (p?.id) socket.join(`user:${p.id}`);
    if (p?.username) socket.join(`user:${p.username}`);
    await redis.sadd('online_users', authedUserId);
    if (u?.firebaseUid) await redis.sadd('online_users', u.firebaseUid);
    if (p?.id) await redis.sadd('online_users', p.id);
    if (p?.username) await redis.sadd('online_users', p.username);
    await redis.set(`last_seen:${authedUserId}`, Date.now());
    io.emit('user_status', { 
      userId: authedUserId, 
      firebaseUid: u?.firebaseUid,
      profileId: p?.id,
      username: p?.username,
      status: 'online' 
    });
  } catch {}

  // User identification ACK (Strict: NEVER allow client to switch identity or join foreign channels)
  socket.on('identify_user', async (_clientSuppliedId: string, ack?: (res: any) => void) => {
    socket.emit('user_identified', { userId: authedUserId });
    if (typeof ack === 'function') ack({ success: true, userId: authedUserId });
  });

  // Fetch all online users from Redis
  socket.on('get_online_users', async () => {
    try {
      const users = await redis.smembers('online_users');
      socket.emit('online_users_list', { users });
    } catch (err) {}
  });


  // Room management for chats (Authorized participants only)
  socket.on('join_room', async (roomId: string, ack?: (res: any) => void) => {
    if (!roomId || typeof roomId !== 'string') {
      if (typeof ack === 'function') ack({ success: false, error: 'Invalid room' });
      return;
    }

    const cleanId = roomId.startsWith('conv:') ? roomId.replace(/^conv:/, '') : roomId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    let canonicalConvId = cleanId;
    if (!isUuid) {
      try {
        canonicalConvId = await resolveConversationId(cleanId, authedUserId);
      } catch (err: any) {
        console.warn(`🔒 [Socket.IO] Access denied: Could not resolve room ${roomId} for user ${authedUserId}: ${err?.message}`);
        if (typeof ack === 'function') ack({ success: false, error: 'Access denied: Invalid room ID' });
        return;
      }
    }

    const isMember = await ChatDAL.isParticipant(canonicalConvId, authedUserId);
    if (!isMember) {
      console.warn(`🔒 [Socket.IO] Access denied: User ${authedUserId} attempted to join unauthorized room ${canonicalConvId}`);
      if (typeof ack === 'function') ack({ success: false, error: 'Access denied: Not a participant' });
      return;
    }

    socket.join(canonicalConvId);
    socket.join(`conv:${canonicalConvId}`);
    if (cleanId !== canonicalConvId) {
      socket.join(cleanId);
      socket.join(`conv:${cleanId}`);
    }
    if (typeof ack === 'function') ack({ success: true, room: canonicalConvId });
  });

  socket.on('leave_room', (roomId: string) => {
    if (!roomId || typeof roomId !== 'string') return;
    socket.leave(roomId);
    if (!roomId.startsWith('conv:')) {
      socket.leave(`conv:${roomId}`);
    }
  });

  // Real-time Typing Indicators
  socket.on('typing_start', async (data: { conversationId: string }) => {
    if (!authedUserId || !data?.conversationId) return;
    try {
      const canonicalConvId = await resolveConversationId(data.conversationId, authedUserId);
      const userProfile = await UserDAL.getProfileByUserId(authedUserId);
      const userDoc = await UserDAL.findById(authedUserId);
      const payload = {
        conversationId: canonicalConvId,
        rawConversationId: data.conversationId,
        userId: authedUserId,
        profileId: userProfile?.id,
        username: userProfile?.username,
        firebaseUid: userDoc?.firebaseUid,
      };
      socket.to(`conv:${canonicalConvId}`).emit('user_typing', payload);
      if (data.conversationId !== canonicalConvId) {
        socket.to(`conv:${data.conversationId}`).emit('user_typing', payload);
      }
    } catch {}
  });

  socket.on('typing_stop', async (data: { conversationId: string }) => {
    if (!authedUserId || !data?.conversationId) return;
    try {
      const canonicalConvId = await resolveConversationId(data.conversationId, authedUserId);
      const userProfile = await UserDAL.getProfileByUserId(authedUserId);
      const userDoc = await UserDAL.findById(authedUserId);
      const payload = {
        conversationId: canonicalConvId,
        rawConversationId: data.conversationId,
        userId: authedUserId,
        profileId: userProfile?.id,
        username: userProfile?.username,
        firebaseUid: userDoc?.firebaseUid,
      };
      socket.to(`conv:${canonicalConvId}`).emit('user_stop_typing', payload);
      if (data.conversationId !== canonicalConvId) {
        socket.to(`conv:${data.conversationId}`).emit('user_stop_typing', payload);
      }
    } catch {}
  });

  // Raw socket send_message is disabled in favor of authenticated POST /api/v1/chat/conversations/:id/messages
  socket.on('send_message', (_data: any, ack?: (res: any) => void) => {
    console.warn(`⚠️ [Socket.IO] Raw socket send_message rejected. Use POST /api/v1/chat/conversations/:id/messages`);
    if (typeof ack === 'function') {
      ack({ success: false, error: 'Use REST API to send messages' });
    }
  });

  // WebRTC Calling Signaling Gateway (Ultra Low-Latency)
  socket.on('call_user', async (data: { targetUserId: string; signalData: any; callerInfo: any; callType: 'audio' | 'video' }) => {
    if (!authedUserId || !data?.targetUserId) return;

    if (data.signalData?.callId) {
      socket.join(`call:${data.signalData.callId}`);
    }

    const payload = {
      fromSocketId: socket.id,
      signalData: data.signalData,
      callerInfo: {
        ...(data.callerInfo || {}),
        userId: authedUserId,
      },
      callType: data.callType,
    };

    io.to(`user:${data.targetUserId}`).emit('incoming_call', payload);

    // Also resolve aliases to ensure deliverability across UUID/Firebase UID/Profile ID
    try {
      const resolved = await UserDAL.resolveToUserId(data.targetUserId);
      if (resolved && resolved !== data.targetUserId) {
        io.to(`user:${resolved}`).emit('incoming_call', payload);
      }
      const u = await UserDAL.findById(data.targetUserId) || (resolved ? await UserDAL.findById(resolved) : null);
      if (u?.firebaseUid && u.firebaseUid !== data.targetUserId) {
        io.to(`user:${u.firebaseUid}`).emit('incoming_call', payload);
      }
    } catch {}
  });

  socket.on('accept_call', (data: { toSocketId?: string; callId?: string; signalData: any }) => {
    const callId = data.callId || data.signalData?.callId;
    if (callId) {
      socket.join(`call:${callId}`);
      socket.to(`call:${callId}`).emit('call_accepted', { signalData: data.signalData });
    }
    if (data.toSocketId) {
      io.to(data.toSocketId).emit('call_accepted', { signalData: data.signalData });
    }
  });

  socket.on('reject_call', (data: { toSocketId?: string; callId?: string }) => {
    if (data.callId) {
      socket.to(`call:${data.callId}`).emit('call_rejected');
    }
    if (data.toSocketId) {
      io.to(data.toSocketId).emit('call_rejected');
    }
  });

  socket.on('ice_candidate', (data: { toSocketId?: string; callId?: string; candidate: any }) => {
    if (data.callId) {
      socket.to(`call:${data.callId}`).emit('ice_candidate', { candidate: data.candidate, callId: data.callId });
    }
    if (data.toSocketId) {
      io.to(data.toSocketId).emit('ice_candidate', { candidate: data.candidate, callId: data.callId });
    }
  });

  socket.on('end_call', (data: { toSocketId?: string; callId?: string }) => {
    if (data.callId) {
      socket.to(`call:${data.callId}`).emit('call_ended');
    }
    if (data.toSocketId) {
      io.to(data.toSocketId).emit('call_ended');
    }
  });

  socket.on('renegotiate_offer', (data: { callId: string; offer: any; toSocketId?: string }) => {
    if (data.callId) {
      socket.to(`call:${data.callId}`).emit('renegotiate_signal', data);
    }
    if (data.toSocketId) {
      io.to(data.toSocketId).emit('renegotiate_signal', data);
    }
  });

  socket.on('renegotiate_answer', (data: { callId: string; answer: any; toSocketId?: string }) => {
    if (data.callId) {
      socket.to(`call:${data.callId}`).emit('renegotiate_signal', data);
    }
    if (data.toSocketId) {
      io.to(data.toSocketId).emit('renegotiate_signal', data);
    }
  });

  socket.on('disconnect', async () => {
    const userId = (socket as any).userId;
    if (userId) {
      try {
        // Only mark offline if no remaining active sockets exist for this user (handles transport upgrade & multi-tab)
        const remainingSockets = await io.in(`user:${userId}`).fetchSockets();
        if (remainingSockets && remainingSockets.length > 0) {
          return;
        }

        await redis.srem('online_users', userId);
        const u = await UserDAL.findById(userId);
        if (u?.firebaseUid) await redis.srem('online_users', u.firebaseUid);
        const p = await UserDAL.getProfileByUserId(userId);
        if (p?.id) await redis.srem('online_users', p.id);
        if (p?.username) await redis.srem('online_users', p.username);
        const now = Date.now();
        await redis.set(`last_seen:${userId}`, now);
        if (u?.firebaseUid) await redis.set(`last_seen:${u.firebaseUid}`, now);
        if (p?.id) await redis.set(`last_seen:${p.id}`, now);
        io.emit('user_status', { 
          userId, 
          firebaseUid: u?.firebaseUid,
          profileId: p?.id,
          username: p?.username,
          status: 'offline', 
          lastSeen: now 
        });
      } catch (err) {}
    }
  });
});

// -------------------------------------------------------------
// Serve Frontend SPA Build from dist (Unified Full-Stack Deployment)
// -------------------------------------------------------------
const candidateDistPaths = [
  process.env.DIST_PATH,
  path.resolve(__dirname, '../../dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(process.cwd(), '../dist'),
  path.resolve(process.cwd(), 'dist'),
  '/app/dist',
  'D:\\Aeirmist\\dist'
].filter(Boolean) as string[];
const effectiveDistPath = candidateDistPaths.find(p => {
  try {
    return fs.existsSync(path.join(p, 'index.html'));
  } catch {
    return false;
  }
});

if (effectiveDistPath) {
  const indexHtmlPath = path.join(effectiveDistPath, 'index.html');
  app.use(express.static(effectiveDistPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') || 
      req.path.startsWith('/media') || 
      req.path.startsWith('/health') || 
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    res.sendFile(indexHtmlPath);
  });
  console.log(`🌐 [Frontend SPA] Serving client interface from ${effectiveDistPath}`);
} else {
  console.warn('⚠️ [Frontend SPA] Could not find dist/index.html in candidate paths!');
}

// -------------------------------------------------------------
// Start Server
// -------------------------------------------------------------
const PORT = env.PORT;
server.listen(PORT, async () => {
  console.log(`🚀 [Aeirmist API] Server listening on port ${PORT} (${env.NODE_ENV})`);
  console.log(`📡 [Health Check] http://localhost:${PORT}/health`);
  console.log(`📁 [Storage Driver] ${env.STORAGE_DRIVER.toUpperCase()} -> ${env.STORAGE_PATH}`);

  // Purge any ghost/stale online users left from previous crashes or restarts
  try {
    await redis.del('online_users');
    console.log('🧹 [Presence] Cleared stale online_users cache on startup');
  } catch {}
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
