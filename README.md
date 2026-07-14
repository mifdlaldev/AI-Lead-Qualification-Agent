# AI Lead Qualification Agent

Evidence-based planning for an **AI-Assisted Lead Qualification & Smart Routing System**.

## Status
- Phase 1 — Market & Demand Research: **COMPLETE**
- Phase 2 — Product Requirements & Business Logic: **COMPLETE**
- Phase 3 — System Architecture & Technical Design: **COMPLETE**
- Phase 4 — Technology Selection & Implementation Specification: **COMPLETE**
- Phase 5 — Implementation Readiness Package: **IN PROGRESS**

Implementation, coding, testing, and debugging will be executed separately with opencode.

## Objective
Build a real, testable proof-of-work that can support Mifdlal's effort to win a first freelance client in **July 2026** and be adapted for Fiverr, Upwork, Freelancer, Sribulancer, Fastwork, Projects.co.id, LinkedIn, a personal portfolio, and other channels. This is an objective, not a guaranteed outcome.

## Evidence policy
No fake clients, testimonials, case studies, or unsupported performance metrics. Facts, inferences, assumptions, and decisions must remain distinguishable. Final portfolio and LinkedIn claims must come from actual implementation/testing evidence.

## Reference scenario
A fictional **B2B AI automation agency** receiving inbound project inquiries. This is a demonstration fixture, not a claimed client engagement.

## Product model
`Inbound inquiry → validation → duplicate control → deterministic prequalification → bounded AI semantic analysis → policy decision → human review when uncertain → routing/system update → notification/follow-up → traceability`

AI does not own hard business policy or direct authorization of external side effects.

## Source-of-truth rules
`AGENTS.md` is mandatory reading for opencode. Documentation under `docs/` is the authoritative source for product behavior, architecture, security, implementation, and testing constraints. Code/workflow exports must not silently redefine accepted decisions.

## Documentation
### Research
- [`docs/research/market-research-july-2026.md`](docs/research/market-research-july-2026.md)
- [`docs/research/market-evidence-matrix.md`](docs/research/market-evidence-matrix.md)
- [`docs/research/sources.md`](docs/research/sources.md)

### Product
- [`docs/product/project-charter.md`](docs/product/project-charter.md)
- [`docs/product/target-customer.md`](docs/product/target-customer.md)
- [`docs/product/problem-statement.md`](docs/product/problem-statement.md)
- [`docs/product/positioning.md`](docs/product/positioning.md)
- [`docs/product/reference-business-scenario.md`](docs/product/reference-business-scenario.md)
- [`docs/product/product-requirements.md`](docs/product/product-requirements.md)
- [`docs/product/functional-requirements.md`](docs/product/functional-requirements.md)
- [`docs/product/non-functional-requirements.md`](docs/product/non-functional-requirements.md)
- [`docs/product/acceptance-criteria.md`](docs/product/acceptance-criteria.md)

### Business logic
- [`docs/business/lead-data-contract.md`](docs/business/lead-data-contract.md)
- [`docs/business/qualification-policy.md`](docs/business/qualification-policy.md)
- [`docs/business/state-machine-and-routing.md`](docs/business/state-machine-and-routing.md)

### Architecture
- [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md)
- [`docs/architecture/data-model-and-contracts.md`](docs/architecture/data-model-and-contracts.md)
- [`docs/architecture/reliability-error-handling.md`](docs/architecture/reliability-error-handling.md)
- [`docs/architecture/observability-and-operations.md`](docs/architecture/observability-and-operations.md)
- [`docs/architecture/deployment-and-environments.md`](docs/architecture/deployment-and-environments.md)
- [`docs/architecture/implementation-methodology.md`](docs/architecture/implementation-methodology.md)

### Security
- [`docs/security/threat-model-and-controls.md`](docs/security/threat-model-and-controls.md)

### Implementation
- [`docs/implementation/technology-selection.md`](docs/implementation/technology-selection.md)
- [`docs/implementation/workflow-inventory.md`](docs/implementation/workflow-inventory.md)
- [`docs/implementation/integration-specification.md`](docs/implementation/integration-specification.md)
- [`docs/implementation/repository-structure.md`](docs/implementation/repository-structure.md)
- [`docs/implementation/configuration-and-secrets.md`](docs/implementation/configuration-and-secrets.md)
- [`docs/implementation/opencode-implementation-plan.md`](docs/implementation/opencode-implementation-plan.md)

### Decisions
- [`docs/decisions/phase-1-market-decision.md`](docs/decisions/phase-1-market-decision.md)
- [`docs/decisions/phase-2-product-decision.md`](docs/decisions/phase-2-product-decision.md)
- [`docs/decisions/phase-3-architecture-decision.md`](docs/decisions/phase-3-architecture-decision.md)
- [`docs/decisions/phase-4-implementation-decision.md`](docs/decisions/phase-4-implementation-decision.md)

## opencode handoff
Before coding, opencode must read `AGENTS.md` and the decision records. If any implementation choice contradicts documented behavior, the implementation must stop and the relevant doc must be updated first.

## Current direction
**Working name:** AI Lead Qualification Agent  
**Functional positioning:** AI-assisted lead qualification, smart routing, controlled follow-up, human review for ambiguous cases, and execution traceability.

Exact implementation artifacts still need to be built, but the planning source of truth is now complete and protected against silent drift.
