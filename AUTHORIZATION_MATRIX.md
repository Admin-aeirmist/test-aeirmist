# BOND & AEIRMIST — AUTHORIZATION MATRIX
**Document Reference:** SEC-AUTHZ-2026-PHASE4  
**Audit Target:** Endpoint-by-Endpoint Access Control, Role Hierarchy, and Privacy Scopes  
**Auditor:** Senior Application Security Engineer & Backend Security Architect  

---

## 1. Role Hierarchy Definition

The platform defines the following hierarchical authorization tiers:

1. **`public` / `anonymous`**: Unauthenticated internet clients.
2. **`user`**: Authenticated account holder in good standing (`isBanned === false`, `status === 'ACTIVE'`).
3. **`member`**: Authenticated user with confirmed membership in an entity (Group, Community, Team, or Conversation).
4. **`moderator`**: Designated entity moderator or platform moderator.
5. **`admin`**: Entity administrator or platform admin (`users.role === 'admin'`).
6. **`super_admin` / `owner`**: Supreme system administrator (`users.role === 'super_admin'`) or entity creator/owner.

---

## 2. Endpoint Authorization Matrix

### Module: Authentication (`/api/v1/auth`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `POST` | `/api/v1/auth/register` | No | Public | Registration schema validated | Secure |
| `POST` | `/api/v1/auth/login` | No | Public | Returns scoped JWT access/refresh token | Secure |
| `POST` | `/api/v1/auth/refresh` | No | Public | Requires valid unrevoked refresh token | Secure |
| `POST` | `/api/v1/auth/logout` | Yes | User | Invalidates active user session | Secure |
| `POST` | `/api/v1/auth/forgot-password`| No | Public | Opaque status response | Secure |
| `POST` | `/api/v1/auth/reset-password` | No | Public | Validates single-use reset token | Secure |

---

### Module: Users & Profiles (`/api/v1/users`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/users/suggestions` | No | Public | Non-sensitive profile projection | Secure |
| `GET` | `/api/v1/users/me` | Yes | User | Returns caller's full profile + private PII | Secure |
| `GET` | `/api/v1/users/:identifier` | No | Public | **VULN-01:** Returns `phoneNumber`, `personalEmail`, `recoveryEmail`, `dateOfBirth` | **VULNERABLE (P0)** |
| `PATCH`| `/api/v1/users/me` | Yes | User | Caller can only update own profile | Secure |
| `POST` | `/api/v1/users/presence` | Yes | User | Updates online status for caller | Secure |

---

### Module: Bonds — Entities & Lifecycle (`/api/v1/bonds`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/bonds/discover/trending`| No | Public | Public entities only | Secure |
| `GET` | `/api/v1/bonds/entities` | Optional | Public/User | Public entities + private entities caller belongs to | Secure |
| `POST`| `/api/v1/bonds/entities` | Yes | User | Sets caller as entity `owner` in transaction | Secure |
| `GET` | `/api/v1/bonds/entities/:id` | Optional | Public/User | Verifies entity privacy (Private requires membership) | Secure |
| `PATCH`| `/api/v1/bonds/entities/:id`| Yes | Admin/Owner | Only entity owner or admin can edit settings | Secure |
| `DELETE`| `/api/v1/bonds/entities/:id`| Yes | Owner | Entity owner or Super Admin only | Secure |

---

### Module: Bonds — Memberships (`/api/v1/bonds/entities/:id`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `.../members` | Optional | Public/Member| Public for open entities; Member-only for private | Secure |
| `POST`| `.../join` | Yes | User | Handles auto-join for public, creates request for private | Secure |
| `POST`| `.../leave` | Yes | Member | Disallows owner abandonment without transfer | Secure |
| `POST`| `.../requests/:reqId/approve`| Yes| Admin | Admin/Owner approves pending membership | Secure |
| `POST`| `.../requests/:reqId/reject` | Yes| Admin | Admin/Owner rejects pending membership | Secure |
| `PATCH`| `.../members/:memId/role`| Yes | Owner/Admin | Enforces role hierarchy (Cannot promote above self) | Secure |

---

### Module: Bonds — Posts & Content (`/api/v1/bonds`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/bonds/entities/:id/posts`| Optional | Public/Member| Public for open entities; Member-only for private | Secure |
| `POST`| `/api/v1/bonds/entities/:id/posts`| Yes | Member | **Enforces active entity membership prior to insert** | Secure |
| `PATCH`| `/api/v1/bonds/posts/:id` | Yes | Author/Admin | Author can edit post; Admin can moderate/pin | Secure |
| `DELETE`| `/api/v1/bonds/posts/:id`| Yes | Author/Admin | Author can delete; Admin/Moderator can delete | Secure |
| `POST`| `/api/v1/bonds/posts/:id/like` | Yes | Member | Toggles like with atomic counter sync | Secure |
| `POST`| `/api/v1/bonds/posts/:id/comments`| Yes | Member | Adds threaded comment on entity post | Secure |

---

### Module: Messenger & Chat (`/api/v1/chat`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/chat/conversations` | Yes | User | Returns only conversations caller participates in | Secure |
| `POST`| `/api/v1/chat/conversations/direct`| Yes| User | Validates recipient existence, prevents self-chat | Secure |
| `POST`| `/api/v1/chat/conversations/group` | Yes| User | Creates group and persists initial memberships | Secure |
| `POST`| `/api/v1/chat/conversations/:id/members`| Yes| Member/Admin| Caller must be active member to add other users | Secure |
| `GET` | `/api/v1/chat/conversations/:id/messages`| Yes| Member | Enforces `ChatDAL.isParticipant(convId, userId)` | Secure |
| `POST`| `/api/v1/chat/conversations/:id/messages`| Yes| Member | Enforces membership before persisting message | Secure |
| `POST`| `/api/v1/chat/conversations/:id/clear` | Yes | Member | Supports clear for 'me' or 'both' (Admins only) | Secure |

---

### Module: Media & Files (`/api/v1/media`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `POST`| `/api/v1/media/upload` | Yes | User | **VULN-03:** In-memory upload without file size bounds | **VULNERABLE (P1)** |
| `GET` | `/media/*` | No | Public | Static media delivery via local storage or CDN | Secure |

---

### Module: Notifications (`/api/v1/notifications`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/notifications` | Yes | User | Returns notifications addressed to caller | Secure |
| `POST`| `/api/v1/notifications` | Yes | User | **VULN-02:** Permits arbitrary notification injection & push | **VULNERABLE (P1)** |
| `PATCH`| `/api/v1/notifications/read` | Yes | User | Caller marks own notifications as read | Secure |

---

### Module: Administration & Platform Governance (`/api/v1/admin` & `/api/v1/bonds/admin`)

| Method | Path | Auth Required | Minimum Role | Data Privacy & Scope | Audit Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/admin/stats` | Yes | Admin | Platform-wide user, entity, and volume analytics | Secure |
| `GET` | `/api/v1/admin/users` | Yes | Admin | User listing with moderation status | Secure |
| `POST`| `/api/v1/admin/users/:id/ban` | Yes | Super Admin | Suspends user and revokes active sessions | Secure |
| `POST`| `/api/v1/bonds/admin/entities/:id/status`| Yes | Admin | Updates entity approval/suspension status | Secure |
| `POST`| `/api/v1/bonds/admin/entities/:id/verify`| Yes | Admin | Grants or revokes official verification badge | Secure |
| `DELETE`| `/api/v1/bonds/admin/entities/:id`| Yes | Super Admin | Hard deletes entity and associated content | Secure |
