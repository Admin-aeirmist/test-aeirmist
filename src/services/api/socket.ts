import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './client';

function resolveSocketBase(): string {
  if (typeof window !== 'undefined') {
    const customApi = localStorage.getItem('aeirmist_backend_url');
    if (customApi) return customApi.replace(/\/+$/, '');

    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || 
                    hostname === '127.0.0.1' ||
                    hostname.startsWith('192.168.') ||
                    hostname.startsWith('10.') ||
                    hostname.endsWith('.local');
    if (isLocal) {
      if (window.location.port === '4000') return window.location.origin;
      return `${window.location.protocol}//${hostname}:4000`;
    }

    if (window.location.protocol === 'https:') {
      return window.location.origin;
    }
  }
  return (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

let socketInstance: Socket | null = null;
const identifiedUserIds = new Set<string>();
let isRefreshingSocketToken = false;

export function identifyUserSocket(userId: string): void {
  if (!userId) return;
  identifiedUserIds.add(userId);
  if (socketInstance && socketInstance.connected) {
    socketInstance.emit('identify_user', userId);
  }
}

export function updateSocketAuth(token?: string): void {
  const authToken = token || getAuthToken();
  if (socketInstance) {
    socketInstance.auth = { token: authToken };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'aeirmist_auth_token' || e.key === 'auth_token') {
      updateSocketAuth();
    }
  });
}

export function getSocket(): Socket {
  if (!socketInstance) {
    const endpoint = resolveSocketBase();
    const token = getAuthToken();
    socketInstance = io(endpoint, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: { token },
    });

    socketInstance.on('connect', () => {
      console.log('🔌 [Socket.IO] Connected to backend gateway at', endpoint, '| socketId:', socketInstance?.id);
      identifiedUserIds.forEach((id) => {
        socketInstance?.emit('identify_user', id);
      });
    });

    socketInstance.on('connect_error', async (err: any) => {
      const errMsg = err?.message || String(err);
      console.warn('🔌 [Socket.IO Diagnostics] Connection error to endpoint:', endpoint, '| reason:', errMsg);
      
      const isAuthErr = errMsg.toLowerCase().includes('auth') || 
                        errMsg.toLowerCase().includes('credentials') || 
                        errMsg.toLowerCase().includes('unauthorized') ||
                        errMsg.toLowerCase().includes('token');

      if (isAuthErr && !isRefreshingSocketToken) {
        isRefreshingSocketToken = true;
        console.warn('🔌 [Socket.IO Diagnostics] Auth failure detected. Requesting server token refresh...');
        try {
          const { api } = await import('./client');
          const refreshRes = await api.auth.refresh();
          if (refreshRes && refreshRes.token) {
            console.log('🔌 [Socket.IO Diagnostics] Fresh JWT acquired. Updating socket credentials.');
            updateSocketAuth(refreshRes.token);
          }
        } catch (refreshErr) {
          console.warn('🔌 [Socket.IO Diagnostics] Automatic token refresh failed:', (refreshErr as any)?.message || 'Session expired');
        } finally {
          isRefreshingSocketToken = false;
        }
      }
    });

    socketInstance.on('reconnect_attempt', (attempt) => {
      const currentToken = getAuthToken();
      if (socketInstance) {
        socketInstance.auth = { token: currentToken };
      }
      console.log(`🔌 [Socket.IO Diagnostics] Reconnecting (attempt ${attempt}) to ${endpoint}...`);
    });

    socketInstance.on('reconnect_failed', () => {
      console.warn(`🔌 [Socket.IO Diagnostics] Reconnect failed to ${endpoint} after all attempts`);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO Diagnostics] Disconnected from endpoint:', endpoint, '| reason:', reason);
    });
  }
  return socketInstance;
}

export function joinChatRoom(roomId: string): void {
  const socket = getSocket();
  socket.emit('join_room', roomId);
}

export function leaveChatRoom(roomId: string): void {
  const socket = getSocket();
  socket.emit('leave_room', roomId);
}

export function sendTypingStart(conversationId: string, userId: string, username?: string): void {
  const socket = getSocket();
  socket.emit('typing_start', { conversationId, userId, username });
}

export function sendTypingStop(conversationId: string, userId: string): void {
  const socket = getSocket();
  socket.emit('typing_stop', { conversationId, userId });
}
