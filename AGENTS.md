# AGENTS.md — Mandatory Implementation Instructions for opencode

This repository is the planning-first, evidence-based **source of truth** for the AI Lead Qualification Agent. These instructions apply to every implementation session and every subtask.

## Prime directive
**Read before editing. Verify before claiming. Stop on contradiction. Never invent missing requirements, runtime facts, test results, or evidence.**

## Non-negotiable rules
1. Do not invent missing product behavior, schema fields, reason codes, provider capabilities, configuration values, metrics, clients, or test results.
2. Do not ignore `docs/`. Documentation is authoritative; workflow/code convenience is not.
3. Do not silently change accepted decisions. Use the change-control policy.
4. Do not continue through a contradiction or impossible requirement. Stop the affected task and report the conflict.
5. Do not let AI output directly authorize privileged side effects. AI is a bounded semantic evidence producer.
6. Do not embed secrets, real PII, private URLs, sensitive logs, or unsafe exports in Git/public evidence.
7. Do not alter canonical data ownership, state semantics, dispositions, trust boundaries, or workflow inventory without an approved source-of-truth change.
8. Do not treat successful workflow import, one happy-path run, or model output as proof of completion.
9. Do not hide failures, delete unfavorable evidence, or rewrite requirements merely to make implementation appear compliant.
10. Do not claim `production-ready`, `secure`, `bug-free`, `fully tested`, or `100% accurate` without an explicit evidence standard supporting that exact claim.

## Source-of-truth precedence
When artifacts conflict, obey this order:
1. accepted decision records under `docs/decisions/` and `docs/readiness/phase-5-readiness-decision.md`;
2. `docs/product/`;
3. `docs/business/`;
4. `docs/architecture/`;
5. `docs/security/`;
6. `docs/implementation/`;
7. `docs/readiness/` operational controls;
8. `docs/testing/`, machine-readable schemas/policies/prompts/fixtures;
9. workflow JSON, scripts, and implementation code.

A lower-level artifact may implement a higher-level decision; it may not silently redefine it.

## Mandatory reading before the first implementation edit
1. `README.md`
2. this `AGENTS.md`
3. all accepted Phase 1–5 decision records
4. `docs/product/product-requirements.md`
5. `docs/product/functional-requirements.md`
6. `docs/product/non-functional-requirements.md`
7. `docs/product/acceptance-criteria.md`
8. all `docs/business/`
9. all `docs/architecture/`
10. `docs/security/threat-model-and-controls.md`
11. all `docs/implementation/`
12. all `docs/readiness/`

For later sessions, re-read this file, `README.md`, the current gate, and all source-of-truth files affected by the task.

## Required execution protocol
Follow `docs/readiness/opencode-session-protocol.md` at every session start and completion.

Before editing:
- identify the current implementation gate/task;
- identify affected requirement IDs and acceptance criteria;
- inspect current repository state;
- confirm prerequisites from the readiness checklist;
- stop if the task requires an undocumented decision.

During editing:
- keep scope narrow;
- use stable WF IDs from the workflow inventory;
- preserve explicit contracts and version metadata;
- use parameterized database operations;
- keep secrets outside tracked artifacts;
- record typed failures rather than masking them;
- update dependent schemas/policies/docs when a contract legitimately changes.

Before completion:
- run applicable tests/validation;
- compare behavior with acceptance criteria and workflow Definition of Done;
- inspect the diff for secrets and unrelated changes;
- update traceability when requirements change;
- report verified facts separately from unverified items.

## Change control
Follow `docs/readiness/change-control-and-deviation-policy.md`.

- **C1 implementation detail:** may proceed if behavior is unchanged.
- **C2 defect correction:** fix implementation to match source of truth.
- **C3 specification clarification:** clarify docs and dependent contracts.
- **C4 architecture change:** requires a new/superseding decision record and impact review.
- **C5 product/business change:** requires explicit approval and cross-document updates.

Never use a documentation edit to conceal a defect.

## Requirement traceability
Use `docs/readiness/requirement-traceability-matrix.md`. A requirement is not complete unless its implementation ownership and verification evidence are identifiable.

If a requirement ID is added, removed, split, or materially changed, update the traceability matrix in the same change.

## Workflow completion
Use `docs/readiness/workflow-definition-of-done.md`. Import success is not completion. Each workflow must satisfy its contract, failure paths, security constraints, traceability, tests, sanitized export, and requirement mapping.

## Readiness gates
Use `docs/readiness/implementation-readiness-checklist.md`. Readiness sections may be completed incrementally according to the implementation gate order, but may not be silently skipped.

## Hard architecture invariants
- n8n is orchestration, not the canonical application database.
- PostgreSQL owns canonical lead/process/decision/review/action/event state.
- Processing state and business disposition are separate.
- Hard rules and side-effect authorization are deterministic.
- AI output is untrusted until schema-validated and never directly authorizes privileged actions.
- Human review is a first-class path.
- External side effects require durable action-key/ledger protection.
- Completion requires durable state/action semantics, not merely successful AI analysis.
- Public portfolio evidence comes from synthetic, reproducible, sanitized tests.

## Stop conditions
Stop the affected task and report the blocker if:
- authoritative docs contradict;
- a required provider capability is unavailable;
- a security invariant cannot be met;
- a destructive migration lacks an approved plan;
- a requirement cannot be implemented as written;
- implementation would require fabricated evidence or bypassing a test.

## Completion report
Every completed implementation task must report:
- task/gate;
- files changed;
- requirements addressed;
- tests/verification actually run;
- observed result;
- known limitations/unverified items;
- source-of-truth changes, if any;
- next authorized task.

## Final rule
When uncertain, do not improvise. Locate the source of truth. If it does not resolve the uncertainty, stop the affected work and request/record a decision.
