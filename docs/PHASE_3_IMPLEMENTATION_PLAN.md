# BOND — PHASE 3B IMPLEMENTATION PLAN
**Document:** PHASE_3_IMPLEMENTATION_PLAN.md  
**Version:** 3.0.0 (Phase 3A Implementation Blueprint)  
**Target Platform:** BOND (A Connected Global Digital Ecosystem)  
**Status:** Implementation Blueprint (Awaiting User Approval Before Execution)  

---

## 1. Overview & Incremental Execution Strategy

Phase 3B will execute the highest-priority, verified architectural requirements in small, independently verifiable increments.

Each task adheres strictly to the **12-Point Implementation Specification**:

---

## 2. Priority Increments Breakdown

### Increment P0-1: Financial Idempotency & Order Ledger Protection
1. **Objective:** Enforce unique idempotency keys on payment transactions to eliminate duplicate billing on network retries.
2. **Existing Files Affected:** `backend/src/db/schema.ts`, `backend/src/routes/marketplace.routes.ts`, `src/services/api/client.ts`.
3. **Dependencies:** Redis client, PostgreSQL database.
4. **Database Impact:** Additive `idempotency_key VARCHAR(128) UNIQUE NULL` on `marketplace_orders`.
5. **API Impact:** Support optional `Idempotency-Key` header on checkout and order creation.
6. **UI Impact:** None (Zero visual changes; existing checkout modal remains 100% identical).
7. **Security Considerations:** Prevents double-spend and race conditions during payment processing.
8. **Backward Compatibility:** Requests omitting the header generate an internal hash from the user ID and timestamp.
9. **Test & Acceptance Criteria:** Concurrent identical requests return the original order without duplicate DB rows.
10. **Rollback Procedure:** Remove column constraint; revert route handler commit.
11. **Estimated Complexity:** Low (1 day).
12. **Required Approval:** User explicit confirmation.

---

### Increment P0-2: Era AI Human-in-the-Loop Action Confirmation Gate
1. **Objective:** Prevent Era AI from executing state-mutating actions (updating profile, deleting items) without interactive user confirmation.
2. **Existing Files Affected:** `functions/api/[[route]].ts`, `backend/src/routes/ai.routes.ts`, `src/components/era/EraAIChatModal.tsx`.
3. **Dependencies:** Authentication middleware.
4. **Database Impact:** None.
5. **API Impact:** Mutating tools require signed `approval_token` payload.
6. **UI Impact:** Renders an interactive confirmation card inside Era AI chat when a mutating tool is requested.
7. **Security Considerations:** Eliminates prompt injection risk for user data mutations.
8. **Backward Compatibility:** Read-only queries execute without prompt.
9. **Test & Acceptance Criteria:** AI tool requests for data mutations stall until the user clicks "Approve".
10. **Rollback Procedure:** Revert middleware verification to autonomous tool execution.
11. **Estimated Complexity:** Medium (2 days).
12. **Required Approval:** User explicit confirmation.

---

### Increment P1-1: User Skills & Experience History Additive Schema
1. **Objective:** Move unstructured JSON skills and experience into dedicated, indexable relational tables.
2. **Existing Files Affected:** `backend/src/db/schema.ts`, `backend/src/dal/user.dal.ts`, `backend/src/routes/user.routes.ts`.
3. **Dependencies:** `users`, `profiles` tables.
4. **Database Impact:** Additive tables: `user_skills`, `user_experiences`. Existing `profiles` columns left untouched.
5. **API Impact:** New additive routes: `GET/POST /api/v1/profiles/me/skills`, `GET/POST /api/v1/profiles/me/experiences`.
6. **UI Impact:** None to existing layout; enhances Profile modal with dedicated experience cards.
7. **Security Considerations:** User can only edit skills and experiences belonging to their authenticated profile.
8. **Backward Compatibility:** Legacy profile endpoints continue returning existing JSON fields.
9. **Test & Acceptance Criteria:** Adding a skill records in `user_skills` and reflects in profile queries.
10. **Rollback Procedure:** Revert route registration; schema addition is non-destructive.
11. **Estimated Complexity:** Medium (2 days).
12. **Required Approval:** User explicit confirmation.

---

### Increment P1-2: Spaces & Communities Multi-Channel Extension
1. **Objective:** Support distinct topic channels inside Team & Community spaces.
2. **Existing Files Affected:** `backend/src/dal/chat.dal.ts`, `src/components/messenger/GroupInfoPanel.tsx`.
3. **Dependencies:** `conversations`, `conversation_members`.
4. **Database Impact:** Additive column `parent_conversation_id UUID NULL REFERENCES conversations(id)` on `conversations`.
5. **API Impact:** `GET /api/v1/spaces/:id/channels`, `POST /api/v1/spaces/:id/channels`.
6. **UI Impact:** Extends Group Details side panel with a channel list tab using existing Aeirmist styling.
7. **Security Considerations:** Membership in parent space gates access to sub-channels.
8. **Backward Compatibility:** All existing 1-on-1 and group chats have `parent_conversation_id = null`.
9. **Test & Acceptance Criteria:** Sub-channels appear nested within their parent space.
10. **Rollback Procedure:** Ignore `parent_conversation_id` in application queries.
11. **Estimated Complexity:** Medium (3 days).
12. **Required Approval:** User explicit confirmation.

---

## 3. Recommended First Task for Phase 3B

> [!IMPORTANT]
> **Recommended First Task:** **Increment P0-1: Financial Idempotency & Order Ledger Protection** followed immediately by **P0-2: Era AI Human Approval Gate**.  
> This secures the foundational transaction and AI boundaries before any new ecosystem tables are created.
