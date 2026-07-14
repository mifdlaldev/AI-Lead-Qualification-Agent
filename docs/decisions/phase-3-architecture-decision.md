# Decision Record — Phase 3 Architecture

**Date:** 2026-07-14  
**Status:** Accepted

## Decisions
1. n8n is the orchestration layer, not the canonical database.
2. PostgreSQL is the canonical system of record for durable lead/process/decision/action state.
3. Architecture is modular with explicit contracts; avoid both a giant monolith and gratuitous micro-workflow fragmentation.
4. AI is isolated as a bounded semantic-analysis component without direct side-effect authority.
5. Deterministic policy owns validation, hard rules, state transitions, authorization, and final automated disposition mapping.
6. Human review is a first-class path.
7. Side effects use durable action keys/ledger semantics for idempotency.
8. Processing state and business disposition remain separate.
9. Central error handling, bounded retries, failure taxonomy, and safe recovery are mandatory.
10. Synthetic evidence harness is part of architecture, not an afterthought.
11. Start with a simple single-instance portfolio deployment; add queue-mode infrastructure only when measured requirements justify it.
12. Exact CRM, notification, follow-up, model provider, and human-review UI remain adapter/configuration choices for implementation selection.

## Rationale
Recent empirical research on 6,000+ public n8n LLM workflows shows practical systems combine control logic, tools, communications, storage, and human review, while explicit reliability mechanisms remain comparatively uncommon. Recent 2026 security research also demonstrates risk from attacker-controlled context in agentic workflows. These findings support explicit trust boundaries, bounded AI authority, failure handling, and human review. They do not guarantee this architecture is secure or error-free; implementation verification remains required.

## Rejected approaches
- LLM as unrestricted agent with direct credentials/tools.
- n8n execution history as sole system of record.
- spreadsheet as authoritative database for lifecycle/idempotency.
- decorative multi-agent architecture.
- queue/Redis scaling before measured need.
- universal retry policy.
- universal 0–100 lead score without validation.

## Phase 3 Definition of Done
- [x] Logical architecture and boundaries
- [x] Canonical data ownership
- [x] Data model and contract versioning
- [x] Idempotency/side-effect architecture
- [x] Failure taxonomy and recovery strategy
- [x] AI failure handling
- [x] Threat model and security controls
- [x] Observability and operations plan
- [x] Environment/deployment strategy
- [x] Versioning, migration, rollback principles
- [x] Implementation methodology and quality gates
- [x] Explicit anti-overengineering decisions
- [x] Unsupported guarantees excluded

**Phase 3 status: COMPLETE.**
