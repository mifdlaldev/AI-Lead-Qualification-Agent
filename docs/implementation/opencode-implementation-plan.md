# opencode Implementation Plan

## Mandatory read order
1. `README.md`
2. Phase 1–4 decision records
3. product requirements + acceptance criteria
4. business contracts/policy/state machine
5. architecture/security docs
6. Phase 4 implementation specifications

## Operating rule
opencode may choose implementation syntax and node configuration consistent with the specification, but must not silently change product behavior, dispositions, trust boundaries, data ownership, or accepted technology decisions.

If a contradiction or impossible requirement is discovered:
1. stop the affected task;
2. document the conflict;
3. propose the smallest correction;
4. update the source-of-truth decision before implementing changed behavior.

## Implementation epics
### I-00 Repository/bootstrap
Create `.gitignore`, `.env.example`, `compose.yaml`, `AGENTS.md`, directories, artifact validation tooling. Pin n8n `2.30.4`.

### I-01 Database foundation
Create migration `0001_initial_schema.sql`, runtime role guidance, constraints, indexes justified by access/idempotency paths, policy seed, and migration verification.

### I-02 Machine-readable contracts
Implement inbound JSON schema, semantic JSON schema, reason-code registry, workflow input/output contracts, policy v1.

### I-03 WF-04 validation/normalization
Test before AI integration.

### I-04 WF-03 + durable ingress
Implement WF-01, WF-02, WF-03 with canonical receipt and processing run.

### I-05 WF-05 idempotency
Implement atomic claim and replay tests, including concurrent/race-oriented test where feasible.

### I-06 WF-06 deterministic prequalification
Implement policy lookup/versioning and terminal hard rules.

### I-07 WF-07 AI adapter
Implement OpenAI Responses API Structured Outputs, minimum context, schema validation, typed failures, usage metadata, bounded recovery.

### I-08 WF-08 decision policy
Implement deterministic mapping and reason/evidence persistence.

### I-09 WF-09/WF-13 human review
Implement one-time opaque token, expiry, atomic resolution, double-submit protection.

### I-10 WF-10/WF-11/WF-12 side effects
Implement ledger-first routing, Telegram adapter, Resend adapter, consent enforcement, template versioning.

### I-11 WF-14 global errors
Implement Error Trigger workflow, sanitized persistence, actionable alert.

### I-12 WF-15 evaluation harness
Implement frozen fixture runner and machine-readable observed results.

### I-13 Security and failure verification
Exercise adversarial input, malformed AI output, rate limit/transient failure simulation where feasible, invalid credentials in non-production, replay, double review, and secret scan.

### I-14 Benchmark release
Freeze workflow/policy/schema/prompt/model versions, run evaluation, preserve raw sanitized evidence, calculate metrics from evidence scripts.

### I-15 Portfolio packaging
Only after I-14: diagrams, screenshots, demo, LinkedIn copy, Fiverr/Upwork/general portfolio assets.

## Commit discipline
Prefer one coherent change per commit. Commit messages should identify scope, for example:
- `feat(db): add initial domain schema`
- `feat(workflow): add deterministic validation`
- `test(idempotency): cover replayed lead submission`
- `docs(decision): revise review-token architecture`

## Completion rule
Implementation is not complete because workflows import successfully. Completion requires mapped acceptance criteria, reproducible tests, failure-path verification, and sanitized evidence.
