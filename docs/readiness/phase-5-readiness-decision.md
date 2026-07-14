# Phase 5 — Implementation Readiness Decision

**Date:** 2026-07-14  
**Status:** Accepted

## Decision
The repository is the implementation source of truth. opencode must operate under `AGENTS.md`, the documented precedence hierarchy, traceability requirements, workflow-level definitions of done, readiness gates, and change-control policy.

## Readiness package
- root `AGENTS.md`;
- strengthened root `README.md`;
- implementation readiness checklist;
- requirement traceability matrix;
- workflow Definition of Done;
- change control and deviation policy;
- opencode session protocol.

## Implementation authorization
Implementation may proceed gate-by-gate according to `docs/implementation/opencode-implementation-plan.md`. Completion of Phase 5 does not mean every runtime dependency is already configured; it means missing runtime prerequisites are explicit checks rather than hidden assumptions.

## Non-negotiable implementation behavior
- Read before editing.
- Verify before claiming.
- Stop on contradiction.
- Never invent missing requirements or evidence.
- Never silently drift from accepted decisions.
- Never weaken security/reliability controls for convenience without an approved change.
- Keep implementation, tests, schemas, policies, and docs synchronized.

## Phase 5 Definition of Done
- [x] Root agent instructions exist.
- [x] README reflects Phases 1–5 and source-of-truth rules.
- [x] Readiness checklist exists.
- [x] Requirements map to implementation and evidence ownership.
- [x] Each workflow has completion criteria.
- [x] Controlled change/deviation process exists.
- [x] Per-session opencode protocol exists.
- [x] Unsupported zero-defect/zero-revision guarantees are excluded.

**Phase 5 status: COMPLETE.**
