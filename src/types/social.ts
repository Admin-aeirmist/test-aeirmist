export type Timestamp = Date | string | number;
export type FirestoreTimestamp = Timestamp;

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string;
  type: 'image' | 'video';
  createdAt: Date | string | number;
  expiresAt: Date | string | number;
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
  createdAt: Date | string | number;
  location?: string;
  tags?: string[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: Date | string | number;
}
