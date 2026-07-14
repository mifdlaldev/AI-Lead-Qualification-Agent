# System Architecture Blueprint

**Status:** Accepted Phase 3 blueprint  
**Architecture style:** modular workflow orchestration with explicit contracts and a single canonical system of record.

## Reality constraint
This document is intended to minimize avoidable implementation ambiguity. It does **not** promise zero revisions or zero runtime errors; external APIs, credentials, model behavior, and deployment environments can change. Changes must be handled through documented decisions rather than ad-hoc edits.

## Architectural drivers
1. Traceable business decisions.
2. Idempotent side effects.
3. Bounded AI authority.
4. Recoverable failures.
5. Fast enough implementation for the July portfolio objective.
6. Vendor isolation so business semantics do not depend on one CRM/model.
7. Reproducible evidence generation.

## Logical components
### A. Ingress workflow
Responsibilities: authenticate/accept the request, apply payload-size limits where available, assign correlation identity, preserve source identity, normalize transport metadata, persist receipt, and invoke orchestration.

Must not perform semantic qualification.

### B. Core orchestration workflow
Responsibilities: lifecycle coordination only. Calls deterministic validation, duplicate control, prequalification, AI analysis when needed, decision policy, persistence, and routing. It owns state progression but delegates specialized logic.

### C. Validation & normalization module
Pure/deterministic where possible. Produces normalized lead data plus validation reason codes.

### D. Idempotency & duplicate module
Uses a durable idempotency record and documented duplicate signals. Prevents replayed events from repeating prohibited side effects.

### E. Deterministic prequalification module
Evaluates hard rules and determines whether AI analysis is necessary.

### F. AI semantic analysis module
Receives only the minimum required normalized fields, treats free text as untrusted data, requests a strict structured output, validates the response, and returns semantic evidence. It has no direct CRM/email/notification credentials or side-effect authority.

### G. Decision policy module
Deterministically maps validated evidence to disposition + reason codes + review requirement. Business policy is versioned.

### H. Human review workflow
Creates/retrieves a review item and accepts an authorized human resolution. Automated recommendation and final human decision remain separate.

### I. Routing & side-effect workflow
Executes only actions permitted by final disposition, consent, and idempotency policy. Each external action receives its own idempotency/action key.

### J. Error workflow
Central operational error intake for unexpected workflow failures. Records failure context and alerts an operator without exposing secrets.

### K. Evidence/test harness
Feeds synthetic fixtures through the public/test ingress, records expected vs observed outcomes, and exports machine-readable evidence. It is isolated from production credentials/destinations.

## Canonical data ownership
The **system of record database** is authoritative for:
- canonical lead identity;
- current processing state;
- current/final business disposition;
- policy version;
- idempotency keys;
- review status;
- side-effect ledger;
- event/audit records.

A CRM, spreadsheet, Slack, email provider, or n8n execution history is **not** the authoritative state store.

## Recommended implementation baseline
For the portfolio MVP, use:
- n8n as workflow orchestrator;
- PostgreSQL as canonical application/system-of-record database;
- one AI provider/model selected in implementation configuration;
- one internal notification channel;
- one controlled follow-up channel;
- one lightweight human-review mechanism.

Exact vendors remain configurable. PostgreSQL is selected at architecture level because durable relational state, uniqueness constraints, transactions, and queryable evidence materially support idempotency and auditability.

## Workflow decomposition rule
Use sub-workflows/modules when a unit has a stable contract, independent failure semantics, reusable logic, or sensitive credential boundary. Do not split every few nodes into a sub-workflow; excessive fragmentation harms traceability.

## Synchronous vs asynchronous boundary
Ingress should acknowledge only after the submission is durably recorded. Downstream qualification may then run synchronously for the demo or asynchronously if deployment constraints justify it. The business contract must not depend on the caller holding an HTTP connection open for the entire AI/integration path.

## Architecture invariants
- No AI output directly triggers privileged side effects.
- No external side effect occurs without a deterministic authorization check.
- No processing success is recorded before required durable state/action recording succeeds.
- Every lead path has a correlation ID.
- Every external action has an idempotency/action key.
- Every decision records policy version and reason codes.
- Every human override preserves the automated recommendation.
- Secrets never enter repository fixtures, prompts, screenshots, or public logs.
