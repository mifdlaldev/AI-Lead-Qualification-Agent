# Decision Record — Phase 2 Product & Business Logic

**Date:** 2026-07-14  
**Status:** Accepted

## Decision
Use a fictional **B2B AI automation agency receiving inbound project inquiries** as the reference demonstration scenario.

The product will use a **hybrid decision model**:
- deterministic logic owns validation, duplicate policy, hard rules, state transitions, and side-effect authorization;
- AI performs bounded semantic extraction/classification from untrusted free text;
- deterministic policy maps evidence to a disposition;
- ambiguous/high-risk cases route to human review.

## Accepted business dispositions
- `QUALIFIED`
- `NURTURE`
- `DISQUALIFIED`
- `HUMAN_REVIEW`

## Key decision: no decorative 0–100 score yet
Phase 2 rejects inventing universal numeric weights. A numeric score may be introduced later only if it is defined as a reference-policy choice and validated against labeled test cases.

## Key decision: AI is not the policy engine
AI output cannot directly:
- authorize follow-up;
- choose arbitrary recipients/endpoints;
- override hard rules;
- create final commercial commitments;
- invent missing qualification facts.

## Key decision: uncertainty is a valid outcome
The workflow must preserve uncertainty through `HUMAN_REVIEW` instead of forcing every inquiry into a binary automated answer.

## Key decision: processing state != business disposition
Technical lifecycle states and business qualification outcomes are modeled separately so failures cannot masquerade as valid business decisions.

## Deferred to Phase 3 architecture
- exact n8n workflow decomposition;
- exact CRM/system of record;
- exact notification channel;
- exact follow-up provider;
- exact AI model/provider;
- persistence technology;
- human-review interface;
- deployment topology;
- retry implementation;
- credential management implementation.

## Deferred to testing/evidence planning
- synthetic dataset size;
- labeled case distribution;
- latency targets;
- throughput targets;
- accuracy/agreement metrics;
- cost per lead;
- portfolio performance claims.

## Phase 2 Definition of Done
- [x] Reference business scenario
- [x] Actors and business boundary
- [x] Product requirements and MVP boundary
- [x] Canonical lead data contract
- [x] Qualification policy
- [x] Deterministic/AI authority separation
- [x] Lifecycle state machine
- [x] Routing semantics
- [x] Functional requirements
- [x] Non-functional requirements
- [x] Acceptance criteria
- [x] Architecture/vendor choices explicitly deferred
- [x] Unsupported scoring weights and performance claims excluded

**Phase 2 status: COMPLETE.**
