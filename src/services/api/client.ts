/**
 * Aeirmist Universal API Client Bridge
 * Reads endpoint dynamically from VITE_API_URL (Zero Hardcoding!)
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('aeirmist_auth_token');
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('aeirmist_auth_token', token);
  } else {
    localStorage.removeItem('aeirmist_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Health
  checkHealth: () => request<{ status: string; services: Record<string, string> }>('/health'),

  // Auth
  auth: {
    register: (data: { email: string; password: string; username: string; displayName: string }) =>
      request<{ token: string; user: any }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (dataOrEmail: { email?: string; identifier?: string; password?: string } | string, maybePass?: string) => {
      const payload = typeof dataOrEmail === 'string'
        ? { email: dataOrEmail, identifier: dataOrEmail, password: maybePass || '' }
        : { email: dataOrEmail.email || dataOrEmail.identifier, identifier: dataOrEmail.identifier || dataOrEmail.email, password: dataOrEmail.password || '' };
      return request<{ token: string; user: any }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    me: () => request<{ user: any }>('/api/v1/auth/me'),
    forgotPassword: (email: string) =>
      request<{ success: boolean; message: string; resetToken?: string }>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (data: { token: string; newPassword: string }) =>
      request<{ success: boolean; message: string }>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    changePassword: (dataOrCurrent: { currentPassword?: string; newPassword?: string } | string, maybeNew?: string) => {
      const payload = typeof dataOrCurrent === 'string'
        ? { currentPassword: dataOrCurrent, newPassword: maybeNew || '' }
        : dataOrCurrent;
      return request<{ success: boolean; message: string }>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    changeEmail: (data: { currentPassword?: string; newEmail: string }) =>
      request<{ success: boolean; message: string }>('/api/v1/auth/change-email', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Feed & Posts
  posts: {
    getFeed: (limit = 20, offset = 0) =>
      request<{ posts: any[] }>(`/api/v1/posts?limit=${limit}&offset=${offset}`),
    getById: (id: string) => request<{ post: any }>(`/api/v1/posts/${id}`),
    create: (data: { content: string; mediaKeys?: string[]; mediaType?: string; tags?: string[]; pollData?: any }) =>
      request<{ post: any }>('/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    toggleLike: (id: string) =>
      request<{ liked: boolean; likesCount: number }>(`/api/v1/posts/${id}/like`, { method: 'POST' }),
    toggleBookmark: (id: string) =>
      request<{ bookmarked: boolean }>(`/api/v1/posts/${id}/bookmark`, { method: 'POST' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/v1/posts/${id}`, { method: 'DELETE' }),
    getComments: (postId: string) =>
      request<{ comments: any[] }>(`/api/v1/posts/${postId}/comments`),
    addComment: (postId: string, content: string, parentId?: string) =>
      request<{ comment: any }>(`/api/v1/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId }),
      }),
    getUserPosts: (userId: string, limit = 50, offset = 0) =>
      request<{ posts: any[] }>(`/api/v1/posts/user/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`),
    votePoll: (postId: string, optionIndex: number) =>
      request<{ success?: boolean; alreadyVoted?: boolean; pollData: any }>(`/api/v1/posts/${postId}/poll/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      }),
  },

  // Users & Profiles
  users: {
    getProfile: (identifier: string) =>
      request<{ profile: any }>(`/api/v1/users/${encodeURIComponent(identifier)}`),
    updateProfile: (data: {
      displayName?: string;
      bio?: string;
      location?: string;
      avatarKey?: string;
      bannerKey?: string;
      socialLinks?: any;
      privacySettings?: any;
    }) =>
      request<{ profile: any }>('/api/v1/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    toggleFollow: (targetUserId: string) =>
      request<{ following: boolean }>(`/api/v1/users/${targetUserId}/follow`, {
        method: 'POST',
      }),
    search: (query: string, limit = 20) =>
      request<{ users: any[] }>(`/api/v1/users/search?q=${encodeURIComponent(query)}&limit=${limit}`),
    getSuggestions: (limit = 20) =>
      request<{ users: any[] }>(`/api/v1/users/suggestions?limit=${limit}`),
    deactivate: () =>
      request<{ success: boolean }>('/api/v1/users/deactivate', {
        method: 'POST',
      }),
  },

  // Notifications
  notifications: {
    get: (limit = 30) =>
      request<{ notifications: any[]; unreadCount: number }>(`/api/v1/notifications?limit=${limit}`),
    getAll: (limit = 30) =>
      request<{ notifications: any[]; unreadCount: number }>(`/api/v1/notifications?limit=${limit}`),
    create: (data: { recipientId: string; type?: string; title?: string; body?: string; actionUrl?: string; metadata?: any }) =>
      request<{ notification: any }>('/api/v1/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    markRead: (id: string) =>
      request<{ success: boolean }>(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
      }),
    markAllRead: () =>
      request<{ success: boolean }>('/api/v1/notifications/read-all', {
        method: 'POST',
      }),
  },

  // Messenger & Chat
  chat: {
    getConversations: () => request<{ conversations: any[] }>('/api/v1/chat/conversations'),
    getMessages: (conversationId: string, limit = 50, before?: string) =>
      request<{ messages: any[] }>(
        `/api/v1/chat/conversations/${conversationId}/messages?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      ),
    sendMessage: (
      conversationId: string,
      data: {
        content?: string;
        type?: string;
        mediaKey?: string;
        fileName?: string;
        fileSize?: number;
        duration?: number;
        replyToId?: string;
        metadata?: any;
      }
    ) =>
      request<{ message: any; conversationId: string }>(`/api/v1/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    startDirect: (participantId: string) =>
      request<{ conversationId: string }>('/api/v1/chat/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ participantId }),
      }),
    markSeen: (conversationId: string) =>
      request<{ success: boolean }>(`/api/v1/chat/conversations/${conversationId}/seen`, {
        method: 'POST',
      }),
    createGroup: (title: string, memberIds: string[], avatarKey?: string) =>
      request<{ conversation: any }>('/api/v1/chat/conversations/group', {
        method: 'POST',
        body: JSON.stringify({ title, memberIds, avatarKey }),
      }),
    editMessage: (messageId: string, content: string) =>
      request<{ message: any }>(`/api/v1/chat/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    deleteMessage: (messageId: string) =>
      request<{ success: boolean }>(`/api/v1/chat/messages/${messageId}`, {
        method: 'DELETE',
      }),
  },

  // Videos & Video Creator Studio
  videos: {
    getFeed: (limit = 20, offset = 0) =>
      request<{ videos: any[] }>(`/api/v1/videos/feed?limit=${limit}&offset=${offset}`),
    getById: (id: string) =>
      request<{ video: any }>(`/api/v1/videos/${id}`),
    create: (data: {
      title: string;
      description?: string;
      videoUrl: string;
      thumbnailUrl?: string;
      mediaKey?: string;
      duration?: number;
      category?: string;
      tags?: string[];
    }) =>
      request<{ video: any }>('/api/v1/videos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    like: (id: string) =>
      request<{ success: boolean; isLiked: boolean }>(`/api/v1/videos/${id}/like`, { method: 'POST' }),
    unlike: (id: string) =>
      request<{ success: boolean; isLiked: boolean }>(`/api/v1/videos/${id}/like`, { method: 'DELETE' }),
    recordView: (id: string) =>
      request<{ success: boolean }>(`/api/v1/videos/${id}/view`, { method: 'POST' }),
    getComments: (id: string, limit = 50, offset = 0) =>
      request<{ comments: any[] }>(`/api/v1/videos/${id}/comments?limit=${limit}&offset=${offset}`),
    addComment: (id: string, content: string) =>
      request<{ comment: any }>(`/api/v1/videos/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/v1/videos/${id}`, { method: 'DELETE' }),
  },

  // 24h Notes
  notes: {
    getActive: () => request<{ notes: any[] }>('/api/v1/notes'),
    setNote: (text: string, emoji?: string) =>
      request<{ note: any }>('/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({ text, emoji }),
      }),
    deleteNote: () =>
      request<{ success: boolean }>('/api/v1/notes', { method: 'DELETE' }),
  },

  // Vault Items
  vault: {
    getItems: (folder?: string) =>
      request<{ items: any[] }>(`/api/v1/vault${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`),
    addItem: (data: {
      type: 'photo' | 'video' | 'note' | 'document';
      title?: string;
      content?: string;
      mediaKey?: string;
      mediaUrl?: string;
      folder?: string;
      isEncrypted?: boolean;
    }) =>
      request<{ item: any }>('/api/v1/vault', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteItem: (id: string) =>
      request<{ success: boolean }>(`/api/v1/vault/${id}`, { method: 'DELETE' }),
  },

  // Calls
  calls: {
    getHistory: (limit = 50) =>
      request<{ calls: any[] }>(`/api/v1/calls/history?limit=${limit}`),
    logCall: (data: { receiverId: string; type: 'audio' | 'video'; status?: string; duration?: number }) =>
      request<{ call: any }>('/api/v1/calls/log', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string, duration?: number) =>
      request<{ call: any }>(`/api/v1/calls/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, duration }),
      }),
  },

  // Marketplace
  marketplace: {
    getItems: (category?: string, limit = 20, offset = 0) =>
      request<{ items: any[] }>(
        `/api/v1/marketplace/items?limit=${limit}&offset=${offset}${category ? `&category=${encodeURIComponent(category)}` : ''}`
      ),
    createItem: (data: any) =>
      request<{ item: any }>('/api/v1/marketplace/items', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getById: (id: string) => request<{ item: any }>(`/api/v1/marketplace/items/${id}`),
    updateStatus: (id: string, status: string) =>
      request<{ item: any }>(`/api/v1/marketplace/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    deleteItem: (id: string) =>
      request<{ success: boolean }>(`/api/v1/marketplace/items/${id}`, {
        method: 'DELETE',
      }),
    createStore: (data: any) =>
      request<{ store: any }>('/api/v1/marketplace/stores', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getStore: (handle: string) =>
      request<{ store: any }>(`/api/v1/marketplace/stores/${encodeURIComponent(handle)}`),
    getMyStore: () =>
      request<{ store: any }>('/api/v1/marketplace/my-store'),
    createOrder: (data: any) =>
      request<{ order: any }>('/api/v1/marketplace/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getMyOrders: () =>
      request<{ orders: any[] }>('/api/v1/marketplace/orders/my'),
  },

  // Media
  media: {
    upload: async (file: File, folder = 'general') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      return request<{ key: string; url: string; sizeBytes: number; mimeType: string }>(
        '/api/v1/media/upload',
        {
          method: 'POST',
          body: formData,
        }
      );
    },
  },

  // Stories
  stories: {
    getFeed: () => request<{ stories: any[] }>('/api/v1/stories'),
    getArchive: () => request<{ stories: any[] }>('/api/v1/stories/archive'),
    create: (data: { mediaUrl: string; thumbnailUrl?: string; mediaType?: string; caption?: string; audience?: string }) =>
      request<{ story: any }>('/api/v1/stories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    view: (id: string) =>
      request<{ success: boolean }>(`/api/v1/stories/${id}/view`, { method: 'POST' }),
    getHighlights: (userId: string) =>
      request<{ highlights: any[] }>(`/api/v1/stories/highlights/${encodeURIComponent(userId)}`),
    createHighlight: (data: { title: string; coverUrl?: string; storyIds: string[] }) =>
      request<{ highlight: any }>('/api/v1/stories/highlights', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteHighlight: (id: string) =>
      request<{ success: boolean }>(`/api/v1/stories/highlights/${id}`, { method: 'DELETE' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/v1/stories/${id}`, { method: 'DELETE' }),
  },

  // Admin
  admin: {
    getStats: () => request<{ stats: any }>('/api/v1/admin/stats'),
    banUser: (id: string, ban: boolean, reason?: string) =>
      request<{ success: boolean; status: string }>(`/api/v1/admin/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ ban, reason }),
      }),
    getAuditLogs: () => request<{ logs: any[] }>('/api/v1/admin/audit-logs'),
    getTickets: () => request<{ tickets: any[] }>('/api/v1/admin/tickets'),
    updateTicket: (id: string, data: { status?: string; reply?: string }) =>
      request<{ ticket: any }>(`/api/v1/admin/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getReports: () => request<{ reports: any[] }>('/api/v1/admin/reports'),
    updateReport: (id: string, data: { status?: string; resolution?: string }) =>
      request<{ report: any }>(`/api/v1/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Support & Reports
  support: {
    createTicket: (data: { type: string; message: string; area?: string | null; attachmentUrl?: string | null }) =>
      request<{ success: boolean; ticket: any }>('/api/v1/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getMyTickets: () =>
      request<{ tickets: any[] }>('/api/v1/support/tickets/my'),
    createReport: (data: {
      reportedUid: string;
      targetType: string;
      targetId: string;
      reason: string;
      description?: string;
      attachmentUrl?: string | null;
    }) =>
      request<{ success: boolean; report: any }>('/api/v1/support/reports', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
