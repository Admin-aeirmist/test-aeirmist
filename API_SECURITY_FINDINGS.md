# BOND & AEIRMIST — DETAILED API SECURITY FINDINGS
**Document Reference:** SEC-FINDINGS-2026-PHASE4  
**Audit Target:** In-depth Technical Vulnerability Analysis & Code Traces  
**Auditor:** Senior Application Security Engineer & Backend Security Architect  

---

## 1. Vulnerability Registry

### [VULN-01] Critical PII Exposure on Public User Profile Endpoint
- **Severity:** P0 — Critical (CVSS 8.6)
- **CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor), CWE-359 (Exposure of Private Personal Information)
- **Affected File:** `backend/src/routes/user.routes.ts`
- **Code Trace:**
  ```typescript
  // Lines 34-45 in backend/src/routes/user.routes.ts:
  const user = await UserDAL.findByIdentifier(identifier);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Current sanitation:
  const sanitized = { ...user };
  delete (sanitized as any).email;
  delete (sanitized as any).firebaseUid;
  // FLAW: phoneNumber, personalEmail, recoveryEmail, recoveryPhone,
  // dateOfBirth, and internal flags remain in the sanitized object!
  res.json({ user: sanitized });
  ```
- **Exploitation Scenario:**
  An unauthenticated attacker scripts sequential requests to `/api/v1/users/<id>` or username endpoints to harvest complete phone numbers, personal/recovery emails, and birthdates of all registered members.
- **Remediation Specification:**
  Replace blocklist-based deletion with an explicit **allowlist projection**:
  ```typescript
  const publicProfile = {
    id: user.id,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarKey: user.avatarKey,
    bannerKey: user.bannerKey,
    bio: user.bio,
    badge: user.badge,
    isVerified: Boolean(user.isVerified),
    followersCount: user.followersCount || 0,
    followingCount: user.followingCount || 0,
    createdAt: user.createdAt,
  };
  ```
  Sensitive fields (`email`, `phoneNumber`, `personalEmail`, `recoveryEmail`, `dateOfBirth`) must be returned **only** if `req.user && req.user.userId === user.id`.

---

### [VULN-02] Unrestricted Notification & Web Push Injection
- **Severity:** P1 — High (CVSS 7.4)
- **CWE:** CWE-284 (Improper Access Control), CWE-269 (Improper Privilege Management)
- **Affected File:** `backend/src/routes/notification.routes.ts`
- **Code Trace:**
  ```typescript
  // backend/src/routes/notification.routes.ts:
  router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { recipientId, type, title, body, data } = req.body;
    // FLAW: Any authenticated user can set type = 'system' or 'verification'
    // and deliver push notifications to any recipientId without authorization!
    await NotificationDAL.createNotification({ recipientId, type, title, body, data });
  });
  ```
- **Exploitation Scenario:**
  A regular user calls `POST /api/v1/notifications` with `type: 'verification'`, `title: 'Account Verified'`, and `recipientId: <victim_id>`, spoofing administrative actions and misleading victims.
- **Remediation Specification:**
  1. Enforce that `type: 'system'` or `type: 'verification'` can only be created by `req.user.role === 'admin' || req.user.role === 'super_admin'`.
  2. For user-to-user notification types (`'mention'`, `'reaction'`, `'message'`), verify that `req.user.userId` has a valid interaction context with `recipientId`.

---

### [VULN-03] Denial of Service via Multer Memory Storage & 2GB JSON Limit
- **Severity:** P1 — High (CVSS 7.5)
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-770 (Allocation of Resources Without Limits)
- **Affected Files:** `backend/src/routes/media.routes.ts`, `backend/src/index.ts`
- **Code Trace:**
  ```typescript
  // backend/src/routes/media.routes.ts:
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fieldSize: Infinity,
      fileSize: Infinity, // FLAW: Buffers entire stream into RAM
    },
  });

  // backend/src/index.ts:
  app.use(express.json({ limit: '2048mb' })); // FLAW: 2GB JSON body limit!
  ```
- **Exploitation Scenario:**
  Uploading three concurrent 500MB videos rapidly allocates >1.5GB of heap memory, triggering Node.js V8 heap out-of-memory fatal crash and killing the backend daemon.
- **Remediation Specification:**
  1. Set bounded limits:
     - Images: Max 10MB
     - Videos: Max 100MB
     - Documents/Audio: Max 25MB
  2. Switch from `multer.memoryStorage()` to `multer.diskStorage()` with temporary directory cleanup, or stream directly to disk/S3.
  3. Reduce `express.json({ limit: '10mb' })`.

---

### [VULN-04] Insecure Default Fallback Secret for `JWT_SECRET`
- **Severity:** P2 — Medium (CVSS 6.8)
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-1188 (Insecure Default Initialization)
- **Affected File:** `backend/src/config/env.ts`
- **Code Trace:**
  ```typescript
  JWT_SECRET: process.env.JWT_SECRET || 'aeirmist_default_jwt_secret_change_in_production'
  ```
- **Exploitation Scenario:**
  If an environment variable injection fails in production, the application silently falls back to the hardcoded string, allowing attackers to sign arbitrary valid JWT tokens as `super_admin`.
- **Remediation Specification:**
  ```typescript
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('default') || process.env.JWT_SECRET.length < 32) {
      throw new Error('FATAL: A strong, unguessable JWT_SECRET (>= 32 chars) is required in production.');
    }
  }
  ```

---

### [VULN-05] Cross-Origin Resource Sharing (CORS) Scope
- **Severity:** P3 — Low (CVSS 4.2)
- **CWE:** CWE-942 (Overly Permissive Cross-Domain Whitelist)
- **Affected File:** `backend/src/index.ts`
- **Finding:**
  CORS currently allows wildcard localhost ports in development. While functional for local Vite testing, in production only `https://aeirmist.com` and its explicit subdomains must be permitted.
