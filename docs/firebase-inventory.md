# Firebase Inventory — Aeirmist Platform
Generated: 2026-10-07 | Status: Complete & Verified

This document lists every Firebase feature, collection, subcollection, authentication method, storage path, and real-time listener currently used across the Aeirmist client and functions codebase.

---

## 1. Firebase Authentication
Config file: `src/lib/firebase.ts`, `firebase-applet-config.json`
Project ID: `aeirmist-d4dd8`

### Methods Used:
- `createUserWithEmailAndPassword(auth, email, password)` — New account registration
- `signInWithEmailAndPassword(auth, email, password)` — Email/password login
- `signInWithPopup(auth, provider)` / `signInWithRedirect` — OAuth (Google)
- `signInWithCustomToken(auth, token)` — Mobile/Session custom token
- `signOut(auth)` — Logout
- `onAuthStateChanged(auth, callback)` — Client session observer
- `sendPasswordResetEmail(auth, email, actionCodeSettings)` — Password recovery
- `updateProfile(auth.currentUser, { displayName, photoURL })` — Profile sync
- `updatePassword(auth.currentUser, newPassword)` — Password change
- `deleteUser(auth.currentUser)` — Account deletion

### Password Hash Migration:
- Firebase uses modified **scrypt** (`signerKey`, `saltSeparator`, `rounds`, `memCost`).
- Using `firebase auth:export --format=json` or Firebase Admin SDK, password hashes will be exported and verified on the new API backend without forcing password resets on existing users.

---

## 2. Firestore Collections & Subcollections

| # | Collection / Subcollection | Description & Key Fields | Access Pattern |
|---|----------------------------|--------------------------|----------------|
| 1 | `users` | Core user account: `uid`, `email`, `role`, `status`, `isBanned`, `createdAt`, `security` | Private (Owner + Admin) |
| 2 | `profiles` | Public profile: `uid`, `username`, `displayName`, `avatarUrl`, `bio`, `followersCount`, `followingCount`, `badge`, `social` | Public read, Owner write |
| 3 | `profiles/{id}/vault` | Private media vault: encrypted files, notes, folders | Owner read/write only |
| 4 | `usernames` | Unique username reservation registry (`uid`, `claimedAt`) | Read-all, System write |
| 5 | `posts` | Feed posts: `userId`, `content`, `mediaUrls`, `mediaType`, `likesCount`, `commentsCount`, `poll`, `createdAt` | Public read, Owner write |
| 6 | `feed_comments` / `comments` | Post comments: `postId`, `userId`, `text`, `createdAt`, `replyCount`, `parentId` | Public read, Owner write |
| 7 | `post_insights` / `post_views` | Analytics: views, shares, engagement metrics | Owner/Author read |
| 8 | `conversations` | Chat threads: `participants`, `profileIds`, `lastMessage`, `unreadCount`, `themeSettings`, `updatedAt` | Participants only |
| 9 | `conversations/{id}/messages` | Chat messages: `senderId`, `text`, `type`, `mediaUrl`, `timestamp`, `reactions`, `status` | Participants only (Realtime) |
| 10 | `chat_settings` | Custom nicknames, wallpaper per conversation | Participants only |
| 11 | `typing_indicators` | Live typing state: `userId`, `chatId`, `updatedAt` | Participants (Realtime) |
| 12 | `calls` / `callHistory` | WebRTC audio/video call signaling: `callerUid`, `receiverUid`, `status`, `offer`, `answer`, `candidates` | Callers only |
| 13 | `stories` / `highlights` | 24h ephemeral stories: `userId`, `mediaUrl`, `type`, `expiresAt`, `viewers` | Followers/Public read |
| 14 | `videos` | Long-form and short video feed: `creatorId`, `videoURL`, `caption`, `duration`, `views`, `likes` | Public read, Creator write |
| 15 | `video_comments` | Video comments & threaded replies | Public read, Author write |
| 16 | `notifications` | User alerts: `userId`, `type`, `title`, `content`, `isRead`, `priority`, `metadata` | Recipient only |
| 17 | `marketplace_items` / `products` | E-commerce items: `sellerId`, `title`, `price`, `images`, `category`, `status` | Public read, Seller write |
| 18 | `orders` / `transactions` | Purchases: `buyerId`, `sellerId`, `items`, `total`, `status`, `paymentInfo` | Buyer, Seller, Admin |
| 19 | `stores` / `store_posts` | Merchant storefronts and reviews | Public read, Merchant write |
| 20 | `login_sessions` / `login_history` | Active devices, IP addresses, user agents, revocation status | User & Admin |
| 21 | `reports` / `appeals` / `moderationLogs` | Trust & Safety reports, user bans, appeal workflows | User (own), Staff/Admins |
| 22 | `admins` / `role_policies` / `audit_logs` | RBAC governance, policy definitions, audit trails | Admins only |
| 23 | `verificationApplications` | Blue checkmark / creator tier applications | User (own), Admins |
| 24 | `ngl_messages` | Anonymous Q&A messages sent to creators | Creator read, Public write |

---

## 3. Firebase Storage (Media & Assets)
Bucket: `aeirmist-d4dd8.firebasestorage.app`

### Storage Paths Identified:
- `avatars/{uid}/{fileName}` — Profile pictures
- `banners/{uid}/{fileName}` — Profile cover photos
- `posts/{year}/{month}/{uid}_{uuid}.{ext}` — Post images and videos
- `stories/{uid}/{uuid}.{ext}` — Ephemeral story media
- `chat/{conversationId}/{uuid}.{ext}` — Chat attachments (images, voice notes, documents)
- `videos/{creatorId}/{uuid}.{ext}` — Video platform uploads
- `marketplace/{sellerId}/{uuid}.{ext}` — Product photos
- `vault/{uid}/{uuid}.{ext}` — Encrypted private vault media

### Replacement:
- Abstract `StorageService` module supporting `STORAGE_DRIVER=local` and `STORAGE_DRIVER=s3`.
- Database stores only the relative path/key: e.g. `avatars/user123/avatar.webp`.
- Public media served through `PUBLIC_MEDIA_URL` (local dev: `http://localhost:4000/media/...`; production: Cloudflare R2 / S3 CDN).

---

## 4. Real-time Listeners (`onSnapshot`)
Identified throughout `src/components/`:
- `Messenger.tsx` & `DockedChatWindow.tsx`: `conversations`, `messages`, `typing_indicators`
- `NotificationBell.tsx`: `notifications` (unread count and incoming toast alerts)
- `HomeFeedSystem.tsx`: `posts` (live updates on new posts & like counts)
- `AdminPanel.tsx`: `reports`, `audit_logs`, `profiles`, `appeals`
- `CallsService.ts`: `calls` signaling doc for WebRTC peer negotiation

### Replacement:
- Real-time WebSockets powered by **Socket.IO** + **Redis Pub/Sub**.
- Client subscribes to rooms (e.g. `user:${userId}`, `chat:${conversationId}`, `call:${callId}`).
- Zero Firestore connection fees or snapshot listeners overhead.

---

## 5. Security Rules (`firestore.rules`)
1183 lines of declarative security rules in `firestore.rules` enforcing:
- Signed-in verification (`isSignedIn`)
- Owner identity checks (`request.auth.uid == userId`)
- Role-based Access Control (RBAC): `isOwnerAccount`, `isSuperAdmin`, `isAdmin`, `isModerator`, `isSupport`, `isMarketplaceModerator`
- Conversation & Call participant authorization
- Engagement counter integrity (preventing client counter manipulation)
- Immutable fields (`createdAt`, `uid`, `role`, `status`)

### Replacement:
- Replaced 1-to-1 with strict Node.js Express/Fastify server-side middleware and Data Access Layer (DAL) authorization checks.
