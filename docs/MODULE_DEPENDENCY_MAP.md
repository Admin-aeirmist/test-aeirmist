# BOND — MODULE DEPENDENCY MAP & INTERFACE CONTRACTS
**Document:** MODULE_DEPENDENCY_MAP.md  
**Version:** 2.0.0 (Phase 2 Architectural Baseline)  
**Target Platform:** BOND (A Connected Global Digital Ecosystem)  
**Classification:** Inter-Service Dependency & Fault-Isolation Topology  
**Status:** Architecture Design (Planning Only — Zero Source Code Mutations)  

---

## 1. Executive Summary & Coupling Principles

To achieve high agility without microservice operational complexity, BOND employs a **Modular Monolith Architecture** with strictly enforced interface contracts:
- **Loose Coupling:** Modules interact via clearly defined internal service interfaces or asynchronous events. Direct arbitrary imports across domain boundaries are forbidden.
- **Fail-Safe Isolation:** A failure in an ancillary module (e.g. Era AI model timeout, video transcoding backlog) must never crash or block critical user workflows (authentication, messaging, profile inspection).

---

## 2. Global Module Dependency Graph

```mermaid
flowchart TD
    subgraph FoundationTier ["Foundation & Identity Tier (Zero Downstream Dependencies)"]
        AUTH["1. Auth Service"]
        AUTHZ["2. Authorization (RBAC/ABAC)"]
        PROF["3. User Profile Service"]
        AUDIT["4. Audit & Logging Service"]
    end

    subgraph CoreProductTier ["Core Communication & Social Tier"]
        FEED["5. Social Feed Service"]
        SEARCH["6. Discovery & Search Service"]
        SPACES["7. Team & Community Service"]
        CHAT["8. Messaging & WebRTC"]
        NOTIF["9. Notification Service"]
        MEDIA["10. Media Processing Service"]
    end

    subgraph EcosystemTier ["Business, Talent & Capital Tier"]
        PROJ["11. Project Management"]
        TALENT["12. Hiring & Jobs"]
        CAPITAL["13. Investor & Sponsor Service"]
        BILLING["14. Payment & Billing"]
        KNOW["15. Learning & Knowledge"]
        EVENTS["16. Events & Ticketing"]
    end

    subgraph IntelligencePlatformTier ["Intelligence & Developer Extensibility Tier"]
        DEV["17. Developer Platform"]
        AI["18. Era AI Gateway"]
        ADMIN["19. Enterprise Control Center"]
    end

    AUTH --> AUTHZ
    AUTHZ --> PROF
    PROF --> AUDIT

    PROF --> FEED
    PROF --> SPACES
    PROF --> CHAT
    MEDIA --> FEED
    MEDIA --> CHAT
    FEED --> NOTIF
    CHAT --> NOTIF
    SPACES --> CHAT

    PROF --> PROJ
    SPACES --> PROJ
    PROF --> TALENT
    PROJ --> CAPITAL
    BILLING --> CAPITAL
    BILLING --> EVENTS
    BILLING --> TALENT

    AUTHZ --> ADMIN
    AUDIT --> ADMIN
    PROF --> DEV
    PROF --> AI
    PROJ --> AI
    FEED --> AI
```

---

## 3. Detailed Service Dependency & Communication Matrix

| Service | Primary Inbound Dependencies | Outbound Dependencies | Communication Style | Isolation Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | Client Login/Register, Developer OAuth | Database (`users`, `sessions`), Redis | Synchronous HTTP | Fails closed; Rate limited in Redis |
| **Authorization** | All Protected Endpoints | Database (`roles`), In-Memory Bitmask | Synchronous In-Process | Fails closed (403 Forbidden) |
| **Profile** | Feed, Search, Chat, Spaces, Hiring | Media Service, Database (`profiles`) | Synchronous + Redis Cache | Cached reads; Stale cache fallback |
| **Social Feed** | Client Feed Views, User Profiles | Profile, Media, Notification, BullMQ | Sync Reads + Async Fanout | Chronological fallback if scoring fails |
| **Search** | Client Search, Autocomplete | Read Replica Database, GIN Indexes | Synchronous Read-Only | Read replica pool; Debounced queries |
| **Spaces (Teams)**| Client Space Nav, Project Management | Profile, Notification, Chat | Synchronous State Sync | Optimistic client state; Local cache |
| **Messaging** | Client Chat, WebRTC Calling | Socket.IO, Redis Pub/Sub, Notification | Full-Duplex WebSocket | Local queue with retry; Zero drop |
| **Notification** | Social, Messaging, Projects, Billing | BullMQ, WebPush, FCM, APNs, SMTP | Asynchronous Queue | Dead-letter queue with exponential retry |
| **Media** | Post Composer, Avatar Upload, Chat | Cloudflare R2, Sharp Worker Pool | Presigned Direct-to-R2 | Async transcoding; Direct client upload |
| **Projects** | Team Spaces, Client Roadmaps | Spaces, Profiles, Notification | Synchronous HTTP + WebSockets| Board state cached in Redis |
| **Hiring** | Job Seekers, Employers | Profile, Organization, Notification | Synchronous HTTP | Search offloaded to read replica |
| **Capital** | Startup Founders, Investors | Project, Organization, Verification | Synchronous ACID Transactions| Strict row-level database locking |
| **Billing** | Client Checkout, Stripe Webhooks | PostgreSQL Ledger, Gateway SDKs | Sync Intent + Async Webhook | Mandatory `Idempotency-Key` headers |
| **Era AI** | Floating Copilot, Inline Tools | LLM Vendors, pgvector, Core API | Streaming SSE / WebSockets | Multi-model fallback; Circuit breaker |
| **Admin** | Enterprise Control Center | All System Tables, Redis Telemetry | Synchronous High-Privilege | Dedicated read replica queries |

---

## 4. Failure Cascade Analysis & Circuit Breakers

```mermaid
graph TD
    FAILURE["External Dependency Failure (e.g. LLM API or Payment Gateway Outage)"]
    
    FAILURE -->|Scenario A: Era AI Provider Times Out| CB_AI["Era AI Circuit Breaker"]
    CB_AI -->|Action| FB_AI["Switch from Primary (Gemini) to Secondary (Claude / Local vLLM)"]
    FB_AI -->|Graceful Degradation| OK_AI["Core Social & Messaging Unaffected"]

    FAILURE -->|Scenario B: Stripe Gateway Degradation| CB_BILL["Billing Circuit Breaker"]
    CB_BILL -->|Action| Q_BILL["Enqueue Transaction for Re-attempt; Grant 72-Hour Grace Period"]
    Q_BILL -->|Graceful Degradation| OK_BILL["User Continues Using Paid Entitlements Without Interruption"]

    FAILURE -->|Scenario C: Redis Cache Cluster Node Down| CB_CACHE["Redis Sentinel Sentinel Failover"]
    CB_CACHE -->|Action| PROMO["Promote Redis Replica to Primary within 3 Seconds"]
    PROMO -->|Graceful Degradation| OK_CACHE["Direct Database Fallback for High-Priority Lookups"]
```

### Circuit Breaker Rules:
1. **Threshold:** If an external downstream service (e.g. external LLM or Email SMTP) fails 5 consecutive times within a 30-second window, the circuit breaker **Trips Open**.
2. **Half-Open Probe:** After 60 seconds, a single test probe request is dispatched. If successful, the circuit resets to **Closed**; if it fails, the circuit remains Open for another 120 seconds.
3. **Core Isolation:** Zero third-party service failures can cause an HTTP 500 error on core personal profile, feed, or chat delivery routes.
