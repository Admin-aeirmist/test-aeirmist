# PostgreSQL 16 Relational Schema Specification — Aeirmist
Generated: 2026-10-07 | Status: Verified Normalized Design

This document details the normalized relational database schema replacing Firebase Firestore.
Target DBMS: **PostgreSQL 16** with **Drizzle ORM**.

---

## 1. Schema Principles
1. **Normalization over Denormalization**: Clean Foreign Keys (`REFERENCES ... ON DELETE CASCADE`), Unique Constraints, and explicit Data Types instead of unstructured NoSQL maps.
2. **Never Store Full URLs**: Store relative file keys only (e.g. `avatars/uid/avatar.webp`). URLs are resolved via `PUBLIC_MEDIA_URL`.
3. **Soft Deletes**: Critical content (`posts`, `comments`, `messages`, `users`, `marketplace_items`) includes `deleted_at TIMESTAMP WITH TIME ZONE NULL`.
4. **Auditability**: Every table has `created_at` and `updated_at` timestamps with UTC timezones.
5. **Full-Text Search Built-in**: `GIN` indexes on `to_tsvector` for usernames, post captions, and marketplace listings (eliminating any third-party search dependencies).

---

## 2. Table Definitions

### 2.1 Identity & Access (`users`, `profiles`, `sessions`)

```sql
-- Users (Authentication & Core Account)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE, -- Used for migration mapping & backwards compatibility
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),       -- bcrypt or migrated scrypt hash
    password_salt VARCHAR(255),       -- required for Firebase scrypt verification
    password_algorithm VARCHAR(32) DEFAULT 'bcrypt', -- 'bcrypt' | 'firebase_scrypt'
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    role VARCHAR(32) DEFAULT 'user' NOT NULL, -- 'user' | 'moderator' | 'support' | 'admin' | 'super_admin' | 'owner'
    status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED'
    is_banned BOOLEAN DEFAULT FALSE NOT NULL,
    ban_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_status ON users(status);

-- Profiles (Public Social Profile)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_key VARCHAR(512),
    banner_key VARCHAR(512),
    website VARCHAR(255),
    location VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    badge VARCHAR(64),
    creator_tier VARCHAR(64) DEFAULT 'EXPLORER' NOT NULL,
    points BIGINT DEFAULT 0 NOT NULL,
    followers_count INTEGER DEFAULT 0 NOT NULL,
    following_count INTEGER DEFAULT 0 NOT NULL,
    posts_count INTEGER DEFAULT 0 NOT NULL,
    social_links JSONB DEFAULT '{}'::jsonb NOT NULL,
    privacy_settings JSONB DEFAULT '{"privateAccount": false, "showOnlineStatus": true}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_search ON profiles USING gin(to_tsvector('simple', username || ' ' || display_name));

-- Login Sessions (Refresh Tokens & Device Audit)
CREATE TABLE login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_name VARCHAR(100),
    is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_sessions_user ON login_sessions(user_id);
CREATE INDEX idx_sessions_token ON login_sessions(refresh_token_hash);
```

---

### 2.2 Social Graph (`follows`, `blocks`)

```sql
-- Follows & Follow Requests
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(16) DEFAULT 'ACCEPTED' NOT NULL, -- 'ACCEPTED' | 'PENDING'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_follows UNIQUE(follower_id, following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Blocks
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_blocks UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
```

---

### 2.3 Posts, Comments & Engagement

```sql
-- Feed Posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_keys TEXT[] DEFAULT '{}'::text[] NOT NULL,
    media_type VARCHAR(16) DEFAULT 'none' NOT NULL, -- 'none' | 'image' | 'video' | 'collage'
    visibility VARCHAR(16) DEFAULT 'public' NOT NULL, -- 'public' | 'followers' | 'private'
    likes_count INTEGER DEFAULT 0 NOT NULL,
    comments_count INTEGER DEFAULT 0 NOT NULL,
    shares_count INTEGER DEFAULT 0 NOT NULL,
    views_count INTEGER DEFAULT 0 NOT NULL,
    poll_data JSONB, -- { "question": string, "options": [{ "id": 1, "text": string, "votes": 0 }] }
    tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    location VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_content_search ON posts USING gin(to_tsvector('english', content));

-- Post Likes
CREATE TABLE post_likes (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY(post_id, user_id)
);

CREATE INDEX idx_post_likes_user ON post_likes(user_id);

-- Post Bookmarks / Saved Posts
CREATE TABLE post_bookmarks (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY(post_id, user_id)
);

CREATE INDEX idx_post_bookmarks_user ON post_bookmarks(user_id);

-- Comments (Threaded / Replies supported)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0 NOT NULL,
    replies_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);

-- Comment Likes
CREATE TABLE comment_likes (
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY(comment_id, user_id)
);
```

---

### 2.4 Messenger & Realtime Chat (`conversations`, `messages`)

```sql
-- Conversations (Direct Chats & Groups)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(16) DEFAULT 'direct' NOT NULL, -- 'direct' | 'group'
    title VARCHAR(128),
    avatar_key VARCHAR(512),
    theme_settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_vanish_mode BOOLEAN DEFAULT FALSE NOT NULL,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- Conversation Members
CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) DEFAULT 'member' NOT NULL, -- 'member' | 'admin' | 'owner'
    nickname VARCHAR(64),
    unread_count INTEGER DEFAULT 0 NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY(conversation_id, user_id)
);

CREATE INDEX idx_conv_members_user ON conversation_members(user_id);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(32) DEFAULT 'text' NOT NULL, -- 'text' | 'image' | 'video' | 'voice' | 'file' | 'location' | 'call_history' | 'poll'
    content TEXT,
    media_key VARCHAR(512),
    file_name VARCHAR(255),
    file_size INTEGER,
    file_type VARCHAR(64),
    duration INTEGER, -- duration in seconds for voice/video
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_delivered BOOLEAN DEFAULT FALSE NOT NULL,
    is_seen BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Message Reactions
CREATE TABLE message_reactions (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY(message_id, user_id, emoji)
);
```

---

### 2.5 Media Assets (`media_assets`)

```sql
-- Central Media Assets Table
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(512) UNIQUE NOT NULL, -- relative storage path, e.g. posts/2026/10/uuid.webp
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    storage_driver VARCHAR(32) DEFAULT 'local' NOT NULL, -- 'local' | 's3' | 'r2'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_media_key ON media_assets(key);
CREATE INDEX idx_media_owner ON media_assets(owner_id);
```

---

### 2.6 Notifications & Audit Logs

```sql
-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(64) NOT NULL, -- 'like' | 'comment' | 'follow' | 'message' | 'call' | 'system'
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(512),
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE is_read = FALSE;

-- System Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(128),
    ip_address VARCHAR(45),
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```
