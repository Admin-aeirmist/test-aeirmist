# Project Rules & Persistent Instructions

## Firebase Project Configuration
- **Active Project ID**: `aeirmist-d4dd8`
- **Auth Domain**: `aeirmist-d4dd8.firebaseapp.com`
- **Storage Bucket**: `aeirmist-d4dd8.firebasestorage.app`
- Do NOT overwrite or reset `firebase-applet-config.json` to any generic/temporary project ID. Always maintain synchronization with `aeirmist-d4dd8`.

## UI Badges
- For verified badges, always use the `<ShieldCheck />` icon (e.g. `<ShieldCheck className="text-aeirmist-cyan shrink-0" />`) instead of a text badge like 'VERIFIED NODE'. This applies to both mobile and desktop UIs whenever an ID is verified.

## Migration: Firebase -> PostgreSQL + Redis + File Storage
- **CRITICAL RULE**: NEVER hardcode any host, port, path, URL, or secret in project code. Everything must come from environment variables (`.env`).
- **Never use localhost directly in app logic**: Read all endpoints from environment variables (e.g. `VITE_API_URL`, `DATABASE_URL`, `PUBLIC_MEDIA_URL`).
- **Database Migrations as Code**: Schema changes ONLY through migration files in `backend/db/migrations` or ORM migrations. Never edit tables by hand.
- **Data Access Layer (DAL)**: All database access goes through a repository / DAL layer. Routes/UI never run raw queries.
- **Parameterized Queries Only**: Always use parameterized SQL queries or type-safe query builders (e.g., Drizzle). No string interpolation in SQL.
- **File Storage**: All file handling goes through the unified storage module (`put`, `delete`, `getPublicUrl`). The database stores only relative file KEYS (e.g. `posts/2026/10/uuid.webp`), NEVER full URLs or disk paths.
- **Server Authorization**: Firestore security rules become strict server-side API authorization checks. Never trust the client.
- **Realtime**: WebSockets (Socket.IO) + Redis Pub/Sub for chat and live presence.
- **Safety**: Do NOT delete or break old Firebase code until the replacement is tested and verified. Work in small incremental steps.
