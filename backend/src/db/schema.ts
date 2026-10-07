import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  numeric,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -------------------------------------------------------------
// 1. Users & Profiles
// -------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  passwordSalt: varchar('password_salt', { length: 255 }),
  passwordAlgorithm: varchar('password_algorithm', { length: 32 }).default('bcrypt').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  role: varchar('role', { length: 32 }).default('user').notNull(),
  status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
  banReason: text('ban_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_firebase_uid').on(table.firebaseUid),
]);

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  username: varchar('username', { length: 32 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  avatarKey: varchar('avatar_key', { length: 512 }),
  bannerKey: varchar('banner_key', { length: 512 }),
  website: varchar('website', { length: 255 }),
  location: varchar('location', { length: 100 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  badge: varchar('badge', { length: 64 }),
  creatorTier: varchar('creator_tier', { length: 64 }).default('EXPLORER').notNull(),
  points: bigint('points', { mode: 'number' }).default(0).notNull(),
  followersCount: integer('followers_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  postsCount: integer('posts_count').default(0).notNull(),
  socialLinks: jsonb('social_links').default({}).notNull(),
  privacySettings: jsonb('privacy_settings').default({ privateAccount: false, showOnlineStatus: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_profiles_username').on(table.username),
  index('idx_profiles_user_id').on(table.userId),
]);

export const loginSessions = pgTable('login_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  deviceName: varchar('device_name', { length: 100 }),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sessions_user').on(table.userId),
]);

// -------------------------------------------------------------
// 2. Social Graph (Follows & Blocks)
// -------------------------------------------------------------
export const follows = pgTable('follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).default('ACCEPTED').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_follows_follower').on(table.followerId),
  index('idx_follows_following').on(table.followingId),
]);

export const blocks = pgTable('blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_blocks_blocker').on(table.blockerId),
]);

// -------------------------------------------------------------
// 3. Posts, Likes & Comments
// -------------------------------------------------------------
export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  mediaKeys: text('media_keys').array().default([]).notNull(),
  mediaType: varchar('media_type', { length: 16 }).default('none').notNull(),
  visibility: varchar('visibility', { length: 16 }).default('public').notNull(),
  likesCount: integer('likes_count').default(0).notNull(),
  commentsCount: integer('comments_count').default(0).notNull(),
  sharesCount: integer('shares_count').default(0).notNull(),
  viewsCount: integer('views_count').default(0).notNull(),
  pollData: jsonb('poll_data'),
  tags: text('tags').array().default([]).notNull(),
  location: varchar('location', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_posts_user_id').on(table.userId),
  index('idx_posts_created_at').on(table.createdAt),
]);

export const postLikes = pgTable('post_likes', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.userId] }),
  index('idx_post_likes_user').on(table.userId),
]);

export const postBookmarks = pgTable('post_bookmarks', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.userId] }),
  index('idx_post_bookmarks_user').on(table.userId),
]);

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  likesCount: integer('likes_count').default(0).notNull(),
  repliesCount: integer('replies_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_comments_post').on(table.postId),
]);

export const commentLikes = pgTable('comment_likes', {
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.commentId, table.userId] }),
]);

// -------------------------------------------------------------
// 4. Conversations & Messages
// -------------------------------------------------------------
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 16 }).default('direct').notNull(),
  title: varchar('title', { length: 128 }),
  avatarKey: varchar('avatar_key', { length: 512 }),
  themeSettings: jsonb('theme_settings').default({}).notNull(),
  isVanishMode: boolean('is_vanish_mode').default(false).notNull(),
  lastMessagePreview: text('last_message_preview'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_conversations_updated').on(table.updatedAt),
]);

export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).default('member').notNull(),
  nickname: varchar('nickname', { length: 64 }),
  unreadCount: integer('unread_count').default(0).notNull(),
  isMuted: boolean('is_muted').default(false).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.conversationId, table.userId] }),
  index('idx_conv_members_user').on(table.userId),
]);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).default('text').notNull(),
  content: text('content'),
  mediaKey: varchar('media_key', { length: 512 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),
  fileType: varchar('file_type', { length: 64 }),
  duration: integer('duration'),
  replyToId: uuid('reply_to_id'),
  metadata: jsonb('metadata').default({}).notNull(),
  isDelivered: boolean('is_delivered').default(false).notNull(),
  isSeen: boolean('is_seen').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_messages_conversation').on(table.conversationId, table.createdAt),
  index('idx_messages_sender').on(table.senderId),
]);

export const messageReactions = pgTable('message_reactions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
]);

// -------------------------------------------------------------
// 5. Media Assets, Notifications & Audit Logs
// -------------------------------------------------------------
export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 512 }).notNull().unique(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  originalName: varchar('original_name', { length: 255 }),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  width: integer('width'),
  height: integer('height'),
  storageDriver: varchar('storage_driver', { length: 32 }).default('local').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_media_key').on(table.key),
  index('idx_media_owner').on(table.ownerId),
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  actionUrl: varchar('action_url', { length: 512 }),
  metadata: jsonb('metadata').default({}).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_notifications_recipient').on(table.recipientId, table.createdAt),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 128 }).notNull(),
  targetType: varchar('target_type', { length: 64 }),
  targetId: varchar('target_id', { length: 128 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  details: jsonb('details').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_logs_actor').on(table.actorId),
  index('idx_audit_logs_created').on(table.createdAt),
]);

export const marketplaceItems = pgTable('marketplace_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 8 }).default('BDT').notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  condition: varchar('condition', { length: 32 }).default('used').notNull(),
  mediaKeys: text('media_keys').array().default([]).notNull(),
  location: varchar('location', { length: 128 }),
  status: varchar('status', { length: 16 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_marketplace_seller').on(table.sellerId),
  index('idx_marketplace_category').on(table.category),
  index('idx_marketplace_status').on(table.status),
]);

export const stories = pgTable('stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mediaUrl: text('media_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  mediaType: varchar('media_type', { length: 32 }).default('image').notNull(),
  caption: text('caption'),
  audience: varchar('audience', { length: 32 }).default('public').notNull(),
  viewers: jsonb('viewers').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('idx_stories_user_id').on(table.userId),
  index('idx_stories_expires_at').on(table.expiresAt),
]);

// -------------------------------------------------------------
// Drizzle Relations
// -------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  posts: many(posts),
  comments: many(comments),
  sessions: many(loginSessions),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
  likes: many(postLikes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
}));
