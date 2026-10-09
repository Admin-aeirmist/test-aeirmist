export type FirestoreTimestamp = string | number | { seconds: number; nanoseconds: number };

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string;
  type: 'image' | 'video';
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;
  viewers: string[];
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video';
  likes: string[];
  comments: Comment[];
  createdAt: FirestoreTimestamp;
  location?: string;
  tags?: string[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: FirestoreTimestamp;
}
