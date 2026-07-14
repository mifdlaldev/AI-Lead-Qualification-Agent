# Requirement Traceability Matrix

This matrix defines the minimum implementation/test ownership map. It prevents a requirement from disappearing between planning and workflow construction.

| Requirement area | Primary implementation | Verification evidence |
|---|---|---|
| FR-001–004 ingestion/identity | WF-01, WF-02, WF-03, DB | valid ingress fixtures; correlation/source identity records |
| FR-010–013 validation | WF-04, inbound schema | invalid/malformed fixture results + reason codes |
| FR-020–022 duplicate/idempotency | WF-05, DB constraints | replay and race-oriented evidence; no duplicate protected side effect |
| FR-030–031 deterministic prequalification | WF-06, policy v1 | hard-rule fixtures proving AI bypass where terminal |
| FR-040–044 AI analysis | WF-07, semantic schema, prompt v1 | valid/malformed/adversarial AI contract tests |
| FR-050–052 decisioning | WF-08, policy v1 | expected disposition/reason-code comparison |
| FR-060–062 human review | WF-09, WF-13, review tables | open/resolve/double-submit/override evidence |
| FR-070–073 persistence/routing | WF-03, WF-10–12, DB | canonical records + consent/routing assertions |
| FR-080–084 reliability/observability | WF-03, WF-05, WF-10–14 | typed failures, retry records, correlation trace |
| FR-090–091 evidence generation | WF-15, fixtures, evidence scripts | reproducible run artifact |
| NFR-001–004 reliability | DB + WF-03/05/10/14 | malformed isolation, replay safety, bounded retry, recovery context |
| NFR-010–014 security | all trust boundaries; WF-07; secrets config | adversarial fixtures + repository secret/public-artifact checks |
| NFR-020–022 privacy | fixtures/logging/evidence pipeline | synthetic-only public evidence + sanitization review |
| NFR-030–032 auditability | processing/events/decisions/reviews | reconstructed lead trace + distinct human override |
| NFR-040–042 maintainability | schemas, policies, workflow contracts | artifact validation and version consistency |
| NFR-050 portability | adapter boundaries | no vendor semantics in core business contracts |
| NFR-060–061 performance | WF-15/evidence | measured latency only; no invented target |
| NFR-070–071 cost | WF-06/WF-07/evidence | AI-call avoidance and usage/cost evidence where available |
| AC-01 | WF-03–12 | valid in-scope end-to-end fixture |
| AC-02 | WF-04 | missing-required-field fixture |
| AC-03 | WF-05/WF-10–12 | duplicate replay fixture |
| AC-04 | WF-06/WF-08 | explicit out-of-scope fixture |
| AC-05 | WF-07–09 | ambiguous high-potential fixture |
| AC-06 | WF-07 | malformed AI output simulation/test |
| AC-07 | WF-07/WF-08/security controls | prompt-injection-style fixture |
| AC-08 | WF-10/WF-12 | no-consent assertion |
| AC-09 | WF-09/WF-13 | human override fixture |
| AC-10 | WF-10–14 | dependency failure/retry evidence |
| AC-11 | WF-15 | reproducible evidence run |

## Maintenance rule
When a requirement ID is added, removed, split, or materially changed, update this matrix in the same change. A requirement without implementation ownership and verification evidence is not implementation-ready.
