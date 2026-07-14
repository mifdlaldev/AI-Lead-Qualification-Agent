# Product Requirements Document (PRD)

## Product objective
Demonstrate a configurable, reliability-aware workflow that processes inbound B2B automation inquiries into traceable business dispositions without allowing an LLM to become the sole authority for hard business rules or high-impact actions.

## Primary user outcomes
- A prospect submission receives a deterministic processing identity.
- Invalid, duplicate, irrelevant, potentially valuable, and ambiguous inquiries follow distinguishable paths.
- Sales can see the resulting disposition and reasons.
- Uncertain cases can be reviewed by a human.
- Side effects are controlled and traceable.

## MVP scope
### Included
- one inbound submission interface/contract;
- payload validation and normalization;
- correlation/processing ID;
- duplicate/idempotency detection;
- deterministic hard-rule evaluation;
- bounded AI semantic extraction into a defined schema;
- policy-based qualification decision;
- four terminal business dispositions: `QUALIFIED`, `NURTURE`, `DISQUALIFIED`, `HUMAN_REVIEW`;
- canonical lead record update;
- one internal notification path;
- one controlled prospect follow-up path or follow-up request;
- execution/event logging;
- explicit error path and retry policy specification.

### Excluded from MVP
- multiple CRMs simultaneously;
- omnichannel intake;
- autonomous price quoting;
- autonomous contract negotiation;
- calendar booking unless later justified as a small extension;
- outbound lead scraping;
- vector database/RAG unless a concrete requirement emerges;
- multi-agent orchestration for its own sake;
- custom web dashboard unless required to demonstrate human review;
- production SLA claims.

## Product rules
### PR-001 — Deterministic authority
Hard validation, duplicate policy, hard eligibility constraints, state transitions, and permission to trigger side effects must be deterministic.

### PR-002 — Bounded AI role
AI may extract or classify semantic information from free text only through a documented output contract. AI output is data for policy evaluation, not an instruction channel.

### PR-003 — Uncertainty preservation
The system must not force an automatic qualified/disqualified decision when required evidence is missing, conflicting, malformed, or below the accepted confidence policy.

### PR-004 — Explainability
Every business disposition must have machine-readable reason codes and enough evidence references to reconstruct why the decision occurred.

### PR-005 — Idempotent processing
Replayed input must not create uncontrolled duplicate side effects.

### PR-006 — Human authority
A human reviewer can resolve `HUMAN_REVIEW` cases. Human resolution becomes the authoritative business disposition and must be recorded separately from the AI recommendation.

### PR-007 — Safe failure
If a critical dependency fails, the system must not silently mark processing successful. The lead must remain recoverable and its failure state observable.

## Success criteria for Phase 2 specification
The implementation team should not need to invent:
- lifecycle states;
- decision ownership;
- minimum input contract;
- disposition meanings;
- hard versus semantic decision boundaries;
- duplicate behavior;
- human-review triggers;
- traceability expectations.

Vendor and infrastructure choices remain architecture decisions.
