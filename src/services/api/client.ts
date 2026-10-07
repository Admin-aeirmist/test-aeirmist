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
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: any }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<{ user: any }>('/api/v1/auth/me'),
  },

  // Feed & Posts
  posts: {
    getFeed: (limit = 20, offset = 0) =>
      request<{ posts: any[] }>(`/api/v1/posts?limit=${limit}&offset=${offset}`),
    getById: (id: string) => request<{ post: any }>(`/api/v1/posts/${id}`),
    create: (data: { content: string; mediaKeys?: string[]; mediaType?: string; tags?: string[] }) =>
      request<{ post: any }>('/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    toggleLike: (id: string) =>
      request<{ liked: boolean }>(`/api/v1/posts/${id}/like`, { method: 'POST' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/v1/posts/${id}`, { method: 'DELETE' }),
    getComments: (postId: string) =>
      request<{ comments: any[] }>(`/api/v1/posts/${postId}/comments`),
    addComment: (postId: string, content: string, parentId?: string) =>
      request<{ comment: any }>(`/api/v1/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId }),
      }),
  },

  // Messenger & Chat
  chat: {
    getConversations: () => request<{ conversations: any[] }>('/api/v1/chat/conversations'),
    getMessages: (conversationId: string, limit = 50, before?: string) =>
      request<{ messages: any[] }>(
        `/api/v1/chat/conversations/${conversationId}/messages?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      ),
    sendMessage: (conversationId: string, data: { content?: string; type?: string; mediaKey?: string }) =>
      request<{ message: any }>(`/api/v1/chat/conversations/${conversationId}/messages`, {
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
};
