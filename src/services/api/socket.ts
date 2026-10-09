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
      reconnectionAttempts: 5,
      auth: { token },
    });

    socketInstance.on('connect', () => {
      console.log('🔌 [Socket.IO] Connected to backend gateway:', socketInstance?.id);
      identifiedUserIds.forEach((id) => {
        socketInstance?.emit('identify_user', id);
      });
    });

    socketInstance.on('reconnect_attempt', () => {
      if (socketInstance) {
        socketInstance.auth = { token: getAuthToken() };
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO] Disconnected:', reason);
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
