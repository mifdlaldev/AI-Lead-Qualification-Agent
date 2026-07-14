# AI Lead Qualification Agent

Evidence-based planning and implementation source of truth for an **AI-Assisted Lead Qualification & Smart Routing System**.

## Project status
- Phase 1 — Market & Demand Research: **COMPLETE**
- Phase 2 — Product Requirements & Business Logic: **COMPLETE**
- Phase 3 — System Architecture & Technical Design: **COMPLETE**
- Phase 4 — Technology Selection & Implementation Specification: **COMPLETE**
- Phase 5 — Implementation Readiness Package: **COMPLETE**
- Implementation: **NOT STARTED**
- Verified benchmark evidence: **NOT AVAILABLE YET**
- Portfolio/LinkedIn performance claims: **NOT AUTHORIZED UNTIL VERIFIED**

Implementation, coding, testing, and debugging will be executed separately with opencode under the repository rules defined in `AGENTS.md`.

## Objective
Build a real, testable proof-of-work that can support Mifdlal's effort to win a first freelance client in **July 2026** and be adapted for Fiverr, Upwork, Freelancer, Sribulancer, Fastwork, Projects.co.id, LinkedIn, a personal portfolio, and other channels. This is an objective, not a guaranteed outcome.

## Evidence policy
No fake clients, testimonials, case studies, benchmarks, or unsupported performance metrics. Facts, inferences, assumptions, decisions, implementation results, and verified evidence must remain distinguishable. Final portfolio and LinkedIn claims must come from reproducible implementation/testing evidence.

## Reference scenario
A fictional **B2B AI automation agency** receiving inbound project inquiries. This is a demonstration fixture, not a claimed client engagement.

## Product model
`Inbound inquiry → validation → duplicate control → deterministic prequalification → bounded AI semantic analysis → deterministic policy decision → human review when uncertain → controlled routing/system update → notification/follow-up → traceability`

AI does not own hard business policy or direct authorization of external side effects.

## Mandatory opencode entry point
**Before any implementation edit, read `AGENTS.md`.** Then follow the Phase 5 readiness package and the gate order in `docs/implementation/opencode-implementation-plan.md`.

Prime directive: **read before editing; verify before claiming; stop on contradiction; never invent missing requirements or evidence.**

## Source-of-truth precedence
1. Accepted decision records and the Phase 5 readiness decision.
2. Product requirements.
3. Business contracts/policy/state machine.
4. Architecture.
5. Security.
6. Implementation specifications.
7. Readiness controls.
8. Testing artifacts and machine-readable contracts.
9. Workflow JSON/code.

Lower-level implementation may not silently redefine higher-level accepted behavior.

## Fixed implementation baseline
- n8n self-hosted `2.30.4`, pinned for the implementation/benchmark baseline.
- Docker Compose, single n8n instance for MVP/demo.
- PostgreSQL as canonical application/system-of-record database, managed through Supabase for the demo.
- OpenAI Responses API with strict Structured Outputs for bounded semantic analysis; exact model ID is release-pinned after availability/evaluation preflight.
- Telegram Bot API for one internal demo notification adapter.
- Resend API for one consent-controlled transactional email adapter.
- n8n Form Trigger for human-friendly demo intake and Webhook for API/test intake.
- PostgreSQL-backed one-time opaque token mechanism for demo human review.
- No CRM, Redis/queue mode, RAG/vector database, multi-agent framework, or community-node dependency in MVP without a new evidence-based decision.

## Stable workflow inventory
`WF-01` lead-ingress-api  
`WF-02` lead-ingress-demo-form  
`WF-03` lead-orchestrator  
`WF-04` validate-normalize-lead  
`WF-05` claim-lead-idempotency  
`WF-06` deterministic-prequalification  
`WF-07` ai-semantic-analysis  
`WF-08` qualification-decision  
`WF-09` human-review  
`WF-10` route-final-disposition  
`WF-11` send-telegram-alert  
`WF-12` send-prospect-email  
`WF-13` resolve-human-review  
`WF-14` global-error-handler  
`WF-15` synthetic-evaluation-runner

## Implementation gate order
`I-00 Bootstrap → I-01 Database → I-02 Contracts → I-03 Validation → I-04 Durable Ingress → I-05 Idempotency → I-06 Deterministic Prequalification → I-07 AI Adapter → I-08 Decision Policy → I-09 Human Review → I-10 Side Effects → I-11 Global Errors → I-12 Evaluation Harness → I-13 Security/Failure Verification → I-14 Benchmark Release → I-15 Portfolio Packaging`

Do not skip ahead merely because a later workflow is visually easier or more interesting to build.

## Documentation index
### Research
- `docs/research/market-research-july-2026.md`
- `docs/research/market-evidence-matrix.md`
- `docs/research/sources.md`

### Product
- `docs/product/project-charter.md`
- `docs/product/target-customer.md`
- `docs/product/problem-statement.md`
- `docs/product/positioning.md`
- `docs/product/reference-business-scenario.md`
- `docs/product/product-requirements.md`
- `docs/product/functional-requirements.md`
- `docs/product/non-functional-requirements.md`
- `docs/product/acceptance-criteria.md`

### Business logic
- `docs/business/lead-data-contract.md`
- `docs/business/qualification-policy.md`
- `docs/business/state-machine-and-routing.md`

### Architecture
- `docs/architecture/system-architecture.md`
- `docs/architecture/data-model-and-contracts.md`
- `docs/architecture/reliability-error-handling.md`
- `docs/architecture/observability-and-operations.md`
- `docs/architecture/deployment-and-environments.md`
- `docs/architecture/implementation-methodology.md`

### Security
- `docs/security/threat-model-and-controls.md`

### Implementation
- `docs/implementation/technology-selection.md`
- `docs/implementation/workflow-inventory.md`
- `docs/implementation/integration-specification.md`
- `docs/implementation/repository-structure.md`
- `docs/implementation/configuration-and-secrets.md`
- `docs/implementation/opencode-implementation-plan.md`

### Phase 5 readiness
- `docs/readiness/implementation-readiness-checklist.md`
- `docs/readiness/requirement-traceability-matrix.md`
- `docs/readiness/workflow-definition-of-done.md`
- `docs/readiness/change-control-and-deviation-policy.md`
- `docs/readiness/opencode-session-protocol.md`
- `docs/readiness/phase-5-readiness-decision.md`

### Decisions
- `docs/decisions/phase-1-market-decision.md`
- `docs/decisions/phase-2-product-decision.md`
- `docs/decisions/phase-3-architecture-decision.md`
- `docs/decisions/phase-4-implementation-decision.md`

## Implementation integrity rules
- A requirement without implementation ownership and verification evidence is not complete.
- A workflow that imports successfully is not necessarily done.
- A passing happy path is not a reliability test.
- AI output is not trusted until contract-validated.
- Side effects require deterministic authorization and idempotency protection.
- Human review and automated recommendation remain distinguishable.
- Unexpected failures remain visible and recoverable.
- If implementation evidence disproves a planning assumption, use the documented change-control process rather than silently drifting.

## Current direction
**Working name:** AI Lead Qualification Agent  
**Functional positioning:** AI-assisted lead qualification, smart routing, controlled follow-up, human review for ambiguous cases, and execution traceability.

The planning and implementation-readiness source of truth is complete. The next authorized work is implementation beginning at **I-00 — Repository/Bootstrap**, followed strictly by the documented gate order.
