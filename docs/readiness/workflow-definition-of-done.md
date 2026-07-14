# Workflow Definition of Done

Global rule: importing successfully into n8n is **not** completion.

## Every workflow
A workflow is done only when:
- stable WF ID/name matches inventory;
- input/output contract is documented and validated where applicable;
- node responsibilities do not duplicate hidden business policy;
- expected and failure paths are explicit;
- correlation ID is propagated where applicable;
- no secret is embedded in exported JSON;
- requirement/acceptance-criteria mappings are identified;
- relevant synthetic tests pass;
- export is sanitized and committed;
- documentation is updated if implementation differs for a justified reason.

## WF-01 / WF-02 ingress
Done when both map to one canonical inbound contract, reject unsupported input safely, and do not contain qualification logic.

## WF-03 orchestrator
Done when lifecycle transitions follow the documented state machine, durable receipt precedes downstream processing, child contracts are explicit, and technical failure cannot masquerade as business completion.

## WF-04 validation
Done when required/type/normalization rules are deterministic, missing facts are not invented, and reason codes match the registry.

## WF-05 idempotency
Done when database-backed atomic claims protect replay/race-sensitive behavior and duplicate outcomes are traceable.

## WF-06 prequalification
Done when hard rules are versioned/deterministic and terminal cases can avoid unnecessary AI calls.

## WF-07 AI analysis
Done when minimum data is sent, Structured Outputs contract is enforced, no tools are enabled, metadata/versioning is persisted, malformed/unavailable output is typed, and no side-effect authority exists.

## WF-08 decision
Done when disposition is deterministic from validated evidence/policy, reason codes/evidence references are persisted, and uncertainty routes to review.

## WF-09 / WF-13 human review
Done when review creation/resolution is durable, token expiry/single-use/double-resolution controls work, and automated vs human decisions remain distinguishable.

## WF-10 routing
Done when action authorization is deterministic, ledger entries are claimed before external delivery, consent is enforced, and review cases cannot execute final actions prematurely.

## WF-11 Telegram
Done when only allow-listed configured destination is used, content is sanitized, failures are typed, and delivery status is recorded independently of business disposition.

## WF-12 email
Done when validated recipient + consent + action authorization + stable action key are required, deterministic template version is recorded, and duplicate delivery protection is tested.

## WF-14 error handler
Done when unexpected failures produce sanitized durable operational records and actionable alerts without exposing secrets/PII.

## WF-15 evaluation runner
Done when frozen fixtures can be executed reproducibly, expected vs observed results are machine-readable, run/version metadata is preserved, and benchmark outputs are not manually edited to improve results.
