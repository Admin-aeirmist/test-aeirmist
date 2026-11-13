# BOND & AEIRMIST — AUTHENTICATION FLOW AUDIT
**Document Reference:** SEC-AUTH-2026-PHASE4  
**Audit Target:** All Authentication Mechanisms, Session Handling, Token Lifecycles, and Credential Storage  
**Auditor:** Senior Application Security Engineer & Backend Security Architect  

---

## 1. Authentication Architecture Overview

Aeirmist utilizes a hybrid dual-engine authentication architecture designed to support both local PostgreSQL accounts and federated Google/Firebase accounts:

```
                      ┌────────────────────────────────────────┐
                      │            Client Request              │
                      └──────────────────┬─────────────────────┘
                                         │ Authorization: Bearer <token>
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    authenticateToken() Middleware      │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼ (HS256 with JWT_SECRET)                       ▼ (RS256 with Google JWKS)
      ┌─────────────────────────┐                     ┌─────────────────────────┐
      │   Native Backend JWT    │                     │   Firebase / Google ID  │
      └──────────┬──────────────┘                     └──────────┬──────────────┘
                 │                                               │
                 │ payload.userId                                │ payload.sub / uid
                 ▼                                               ▼
      ┌─────────────────────────┐                     ┌─────────────────────────┐
      │  SELECT FROM users      │                     │  Resolve or provision   │
      │  WHERE id = payload.id  │                     │  user in PostgreSQL     │
      └──────────┬──────────────┘                     └──────────┬──────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                              req.user = { userId, role, email }
```

---

## 2. Deep Dive: Authentication Flows

### Flow 1: Registration (`POST /api/v1/auth/register`)
- **Password Security:** Passwords hashed with `bcrypt` (10 rounds). Plaintext passwords are never logged or stored.
- **Normalization:** Usernames and emails are stripped of whitespace and normalized to lowercase.
- **Transactional Atomicity:** User record in `users` and primary profile in `profiles` are created within a single database transaction. If profile creation fails, the user record is rolled back.
- **Audit Finding:** Password complexity requirements (minimum length 8, mix of upper/lower/numbers) should be enforced via strict schema validation at the gateway.

### Flow 2: Password Login (`POST /api/v1/auth/login`)
- **Verification:** Lookup by normalized email or username, followed by `bcrypt.compare`.
- **Timing Attacks:** Mitigated by generic error message (`"Invalid email or password"`) for both missing users and invalid hashes.
- **Token Generation:**
  - `accessToken`: 7-day expiration (`HS256`, signed with `JWT_SECRET`).
  - `refreshToken`: 30-day expiration, stored in PostgreSQL `refreshTokens` table.
- **Audit Finding:** 7-day access token lifetime is excessively long for high-security environments. Recommended: 15-minute access tokens with silent refresh token rotation.

### Flow 3: Google & Firebase OAuth Verification
- **Verification Logic:** Implemented in `backend/src/middleware/auth.ts` (`verifyFirebaseToken`).
- **Signature Verification:** Downloads official Google x509 public certificates from `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com` and verifies RS256 signature, expiry, and issuer (`https://securetoken.google.com/<projectId>`).
- **Identity Resolution:** Resolves Firebase `sub` / `uid` to the canonical PostgreSQL `users.id`.
- **Verdict:** Cryptographically sound. Does not rely on client claims or unverified token decoding.

### Flow 4: Session Lifecycle & Token Refresh (`POST /api/v1/auth/refresh`)
- **Token Storage:** Refresh tokens are tracked in PostgreSQL with `userId`, `expiresAt`, and `revoked` state.
- **Rotation:** Successful refresh issues a new access token and updates the refresh token timestamp.
- **Revocation:** Logout endpoint sets `revoked = true` on all active refresh tokens for the user session.

### Flow 5: Logout & Session Invalidation (`POST /api/v1/auth/logout`)
- **Server-Side Invalidation:** Revokes database refresh token.
- **Client-Side Invalidation:** Purges `aeirmist_session`, `aeirmist_auth_token`, and cached credentials from localStorage.
- **Socket Disconnect:** Terminates active WebSocket connection for the logged-out identity.

### Flow 6: Account Recovery & Password Reset
- **Verification Mechanism:** Generates a cryptographically random numeric OTP or secure reset token stored with a 15-minute expiration timestamp.
- **One-Time Use:** Upon successful reset, the token/OTP is invalidated immediately to prevent replay attacks.
- **Audit Finding:** Add rate-limiting on the password reset initiation endpoint to prevent email bombing / notification flood attacks.

---

## 3. Account Enumeration & Brute-Force Analysis

| Endpoint | Protection Measure | Current Status | Risk Level |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/login` | Generic error messages | Implemented | Low |
| `/api/v1/auth/register` | Unique username check | Discloses existing username | Low (Standard social UX) |
| `/api/v1/auth/forgot-password` | Opaque response | Implemented | Low |
| IP-based Rate Limiter | Express Rate Limit (`100 req/15 min`) | Configured in `server.ts` | Medium (Needs stricter threshold for auth) |

---

## 4. Recommendations for Phase 5 & Production

1. **Shorten Access Token Lifespan:** Reduce `accessToken` validity from 7 days to 15-30 minutes, relying on the HTTP-only refresh token flow.
2. **Strict Auth Rate Limiter:** Add a dedicated rate-limiter for `/api/v1/auth/login` allowing max 5 failed attempts per IP/account per 10 minutes.
3. **Mandatory Production JWT Secret:** Disallow runtime execution if `JWT_SECRET` matches fallback patterns or is under 32 characters in production.
