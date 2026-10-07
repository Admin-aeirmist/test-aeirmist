import { io, Socket } from 'socket.io-client';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('🔌 [Socket.IO] Connected to backend gateway:', socketInstance?.id);
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
