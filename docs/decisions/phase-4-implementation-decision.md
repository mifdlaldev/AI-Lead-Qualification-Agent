# Decision Record — Phase 4 Technology & Implementation

**Date:** 2026-07-14  
**Status:** Accepted

## Fixed implementation baseline
- n8n self-hosted **2.30.4**, pinned for benchmark implementation.
- Docker Compose, single n8n instance for MVP/demo.
- Managed PostgreSQL via Supabase for canonical domain state.
- OpenAI Responses API with strict Structured Outputs for bounded semantic analysis.
- Actual OpenAI model ID is a pinned environment/release parameter selected by availability + frozen evaluation preflight; model name is not embedded in business logic.
- Telegram Bot API for one internal demo notification adapter.
- Resend API for one consent-controlled transactional email adapter.
- n8n Form Trigger for human-friendly demo intake; Webhook for API/test intake.
- PostgreSQL-backed one-time opaque token mechanism for demo human review.
- Built-in n8n/core nodes and HTTP/Postgres integrations preferred; no community-node dependency in MVP.
- No CRM, Redis, queue mode, RAG, vector database, or multi-agent framework in MVP without new evidence.

## Workflow inventory
15 stable workflow IDs (`WF-01` through `WF-15`) define ingress, orchestration, deterministic modules, AI adapter, decisioning, human review, routing, side-effect adapters, global errors, and synthetic evaluation.

## Source-of-truth rule
Accepted decisions and requirements outrank workflow implementation. If implementation evidence reveals a false assumption, update the decision record explicitly; do not hide architecture drift in node changes.

## Important non-guarantee
Phase 4 materially reduces ambiguity but cannot truthfully guarantee zero revisions or zero defects. External service behavior and implementation findings can require controlled changes.

## Phase 4 Definition of Done
- [x] Exact n8n baseline pinned
- [x] Deployment shape selected
- [x] Canonical database/provider selected
- [x] AI API/output mechanism selected
- [x] Model-selection/versioning rule defined without inventing availability
- [x] Ingress surfaces selected
- [x] Internal notification selected
- [x] Prospect follow-up adapter selected
- [x] Human-review mechanism selected and bounded to demo scope
- [x] Exact workflow inventory defined
- [x] Integration contracts defined
- [x] Repository implementation structure defined
- [x] Configuration/secrets contract defined
- [x] opencode task order and quality gates defined
- [x] Explicit non-selections documented

**Phase 4 status: COMPLETE.**
