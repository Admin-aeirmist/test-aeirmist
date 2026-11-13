# BOND & AEIRMIST — SECURITY REMEDIATION ROADMAP
**Document Reference:** SEC-ROADMAP-2026-PHASE4  
**Audit Target:** Prioritized Remediation Roadmap Preparing for Phase 5 to Phase 9  
**Auditor:** Senior Application Security Engineer & Backend Security Architect  

---

## 1. Roadmap Phasing Strategy

The security remediation is aligned with the controlled master engineering roadmap:

```
┌────────────────────────────────┐
│   Phase 4: Security Audit      │ ◄── Completed (5 Audit Documents Delivered)
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Phase 4.1: Remediation Patch  │ ◄── Apply P0 & P1 Security Fixes
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Phase 5: Entity Foundation    │ ◄── Group/Community/Team Lifecycle & DB Rules
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Phase 6: Messenger & Realtime │ ◄── Persistent Entity Conversations & Sync
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Phase 7: Dummy Data Cleanup   │ ◄── Seed & Mock Data Removal from UI
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Phase 8: Bonds Hub Features   │ ◄── Facebook-Style Full Lifecycle Views
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Phase 9: Production Release   │ ◄── Release Readiness Audit & aeirmist.com Push
└────────────────────────────────┘
```

---

## 2. Phase 4.1: Critical Security Remediation Action Items

### Remediation Item 1: PII Protection in User Profile Endpoint (P0)
- **Target File:** `backend/src/routes/user.routes.ts`
- **Action:** Convert `GET /api/v1/users/:identifier` output to an explicit public whitelist.
- **Verification Plan:**
  - Send unauthenticated `GET /api/v1/users/junaed_islam_jim9`.
  - Assert response does NOT contain `phoneNumber`, `personalEmail`, `recoveryEmail`, `dateOfBirth`.
  - Send authenticated `GET /api/v1/users/me` as the user.
  - Assert user can view their own private fields.

### Remediation Item 2: Notification Spoofing Prevention (P1)
- **Target File:** `backend/src/routes/notification.routes.ts`
- **Action:** Restrict `type: 'system'` and `type: 'verification'` in `POST /api/v1/notifications` to admin roles.
- **Verification Plan:**
  - Test regular user attempting `POST /api/v1/notifications` with `type: 'verification'`. Assert `403 Forbidden`.

### Remediation Item 3: Multer Memory Storage & Body Limit Remediation (P1)
- **Target Files:** `backend/src/routes/media.routes.ts`, `backend/src/index.ts`
- **Action:**
  - Enforce max file size: 100MB for video, 10MB for images.
  - Reduce `express.json` limit to `10mb`.
  - Use disk-based streaming or enforce upload chunking.
- **Verification Plan:**
  - Attempt payload > 10MB on JSON route -> verify `413 Payload Too Large`.
  - Test valid video upload within 100MB -> verify successful completion.

### Remediation Item 4: Production Fail-Fast on Insecure JWT Secret (P2)
- **Target File:** `backend/src/config/env.ts`
- **Action:**
  - Add validator asserting `JWT_SECRET` is defined, at least 32 characters, and not matching default string in production.

---

## 3. Pre-Requisites for Phase 5 (Entity Foundation & Membership Consistency)

Before proceeding to Phase 5:
1. All Phase 4.1 security patches verified and committed to repository.
2. PostgreSQL database tables for Bonds verified:
   - `entities` (Groups, Communities, Teams)
   - `entityMembers` (owner, admin, moderator, member, suspended, pending)
   - `entityPosts` (real posts, comments, likes)
3. Client-side identity resolution verified:
   - Deduplication in `GroupInfoPanel.tsx` confirmed (No duplicate member cards).
   - Real-time conversation sync in `MessagingService.ts` verified.

---

## 4. Release Criteria Gate for `aeirmist.com`

No production deployment will be triggered until:
- [x] Phase 4 Security Audit completed and documented.
- [ ] Phase 4.1 Security Remediation patches applied and tested.
- [ ] Phase 5 Entity Lifecycle and transactional consistency verified.
- [ ] Phase 6 Messenger synchronization verified across multi-user environments.
- [ ] Phase 7 Dummy/Seed data completely removed from production UI.
- [ ] Phase 8 Bonds Hub features tested with real data persistence.
- [ ] Phase 9 Release audit passed with formal user sign-off.
