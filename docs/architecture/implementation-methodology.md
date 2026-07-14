# Implementation Methodology & Quality Gates

## Method
Use contract-first, vertical-slice implementation. opencode should implement against repository requirements rather than inventing product behavior.

## Build order
### Gate 0 — Baseline
- pin/document runtime and n8n version;
- establish environment/config template;
- establish PostgreSQL schema migration mechanism;
- establish sanitized workflow export convention.

### Gate 1 — Durable ingress
Implement receipt, correlation ID, canonical persistence, validation, and deterministic invalid paths. No AI yet.

### Gate 2 — Idempotency
Implement replay/duplicate controls and prove repeated submission cannot repeat protected actions.

### Gate 3 — Deterministic policy skeleton
Implement hard rules, states, reason codes, and decision interfaces using fixtures.

### Gate 4 — AI adapter
Implement minimum-context semantic analysis, structured contract validation, version metadata, and malformed-output handling. AI cannot call side-effect tools.

### Gate 5 — Decision + human review
Connect validated semantic evidence to deterministic policy and human-review path.

### Gate 6 — Side-effect adapters
Add canonical update, one internal notification, and one consent-controlled follow-up path with side-effect ledger/idempotency.

### Gate 7 — Failure handling and observability
Exercise transient, permanent, AI-contract, and unexpected failures. Verify safe states and operator visibility.

### Gate 8 — Security/adversarial verification
Run prompt-injection-like fixtures, malformed inputs, replay, unauthorized review attempt, and secret/public-artifact checks.

### Gate 9 — Evidence benchmark
Freeze test dataset/version, execute reproducible run, export results, calculate only supported metrics.

### Gate 10 — Portfolio release
Create architecture visuals, workflow screenshots, demo video, LinkedIn/case-study copy, and platform-specific packaging from verified evidence.

## Definition of done for each gate
- requirements mapped to implementation artifacts;
- tests/fixtures pass for that gate;
- no unresolved critical defect is hidden;
- docs updated if implementation reveals a false assumption;
- secrets absent from committed artifacts.

## Requirement traceability
Implementation tasks and tests should reference IDs such as `FR-020`, `NFR-012`, and `AC-07`. This prevents features from being declared complete without a requirement/test relationship.

## Decision rule for revisions
“No revisions ever” is not a safe engineering goal. The correct rule is:
- do not casually change accepted business behavior;
- when evidence exposes a wrong assumption, record the change and rationale;
- distinguish bug fix, implementation detail, architecture decision, and product-scope change.

## Prohibited shortcuts
- one giant workflow with undocumented implicit state;
- AI deciding and directly sending external actions;
- hard-coded secrets;
- hard-coded business policy scattered across nodes;
- retry-all-errors behavior;
- using execution history as the only database;
- manual deletion of failed evidence to improve portfolio metrics;
- claiming production readiness because the happy path ran once.
