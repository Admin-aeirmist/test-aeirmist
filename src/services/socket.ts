import { io, Socket } from 'socket.io-client';
import { resolveApiBase, getFreshToken, getAuthToken, setAuthToken } from './api/client';
import { auth } from '../lib/firebase';

let socketInstance: Socket | null = null;
const identifiedUserIds = new Set<string>();
const activeRooms = new Set<string>();
const roomRefCounts = new Map<string, number>();
let isRefreshingSocketToken = false;

function resolveSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const customApi = localStorage.getItem('aeirmist_backend_url');
    if (customApi) return customApi.replace(/\/+$/, '');
  }
  const base = resolveApiBase();
  if (base) return base;
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:4000';
}

export function getSocket(): Socket {
  if (!socketInstance) {
    const endpoint = resolveSocketUrl();
    socketInstance = io(endpoint, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: async (cb: (data: any) => void) => {
        try {
          const token = await getFreshToken();
          cb({ token: token || getAuthToken() });
        } catch {
          cb({ token: getAuthToken() });
        }
      },
    });

    socketInstance.on('connect', () => {
      console.log('🔌 [Socket.IO] Connected to backend gateway at', endpoint, '| socketId:', socketInstance?.id);
      identifiedUserIds.forEach((id) => {
        socketInstance?.emit('identify_user', id);
      });
      activeRooms.forEach((room) => {
        socketInstance?.emit('join_room', room);
      });
    });

    socketInstance.on('connect_error', async (err: any) => {
      const errMsg = err?.message || String(err);
      console.warn('🔌 [Socket.IO Diagnostics] Connection error to endpoint:', endpoint, '| reason:', errMsg);

      const isAuthErr = errMsg.toLowerCase().includes('auth') ||
                        errMsg.toLowerCase().includes('token') ||
                        errMsg.toLowerCase().includes('unauthorized') ||
                        errMsg.toLowerCase().includes('jwt');

      if (isAuthErr && !isRefreshingSocketToken) {
        isRefreshingSocketToken = true;
        console.warn('🔌 [Socket.IO Diagnostics] Auth failure detected. Requesting Firebase force token refresh...');
        try {
          if (auth && auth.currentUser) {
            const fresh = await auth.currentUser.getIdToken(true);
            if (fresh) {
              setAuthToken(fresh);
              updateSocketAuth(fresh);
            }
          }
        } catch (refreshErr: any) {
          console.warn('🔌 [Socket.IO Diagnostics] Automatic token refresh failed:', refreshErr?.message || 'Session expired');
        } finally {
          isRefreshingSocketToken = false;
        }
      }
    });

    socketInstance.on('reconnect_attempt', async (attempt) => {
      const currentToken = await getFreshToken();
      if (socketInstance) {
        socketInstance.auth = { token: currentToken || getAuthToken() };
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

  if (typeof window !== 'undefined') {
    (window as any).__aeirmistSocket = socketInstance;
  }

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    try {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    } catch {}
    socketInstance = null;
  }
  if (typeof window !== 'undefined') {
    delete (window as any).__aeirmistSocket;
  }
}

export function updateSocketAuth(token?: string): void {
  const authToken = token !== undefined ? token : getAuthToken();
  if (socketInstance) {
    const currentToken = typeof socketInstance.auth === 'object' && socketInstance.auth !== null ? (socketInstance.auth as any).token : null;
    if (currentToken === authToken && socketInstance.connected) {
      return;
    }
    socketInstance.auth = { token: authToken };
    if (!socketInstance.connected) {
      socketInstance.connect();
    } else {
      socketInstance.disconnect().connect();
    }
  }
}

export function identifyUserSocket(userId: string): void {
  if (!userId) return;
  identifiedUserIds.add(userId);
  if (socketInstance && socketInstance.connected) {
    socketInstance.emit('identify_user', userId);
  }
}

export function joinChatRoom(roomId: string): void {
  if (!roomId) return;
  const current = roomRefCounts.get(roomId) || 0;
  roomRefCounts.set(roomId, current + 1);
  if (current === 0) {
    activeRooms.add(roomId);
    if (socketInstance && socketInstance.connected) {
      socketInstance.emit('join_room', roomId);
    }
  }
}

export function leaveChatRoom(roomId: string): void {
  if (!roomId) return;
  const current = roomRefCounts.get(roomId) || 0;
  if (current <= 1) {
    roomRefCounts.delete(roomId);
    activeRooms.delete(roomId);
    if (socketInstance && socketInstance.connected) {
      socketInstance.emit('leave_room', roomId);
    }
  } else {
    roomRefCounts.set(roomId, current - 1);
  }
}

export function sendTypingStart(conversationId: string, userId: string, username?: string): void {
  if (socketInstance && socketInstance.connected) {
    socketInstance.emit('typing_start', { conversationId, userId, username });
  }
}

export function sendTypingStop(conversationId: string, userId: string): void {
  if (socketInstance && socketInstance.connected) {
    socketInstance.emit('typing_stop', { conversationId, userId });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('aeirmist_auth_changed', (e: any) => {
    const token = e?.detail?.token;
    if (token) {
      updateSocketAuth(token);
    } else {
      disconnectSocket();
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'aeirmist_auth_token' || e.key === 'auth_token') {
      const newToken = e.newValue;
      if (newToken) {
        updateSocketAuth(newToken);
      } else {
        disconnectSocket();
      }
    }
  });
}
