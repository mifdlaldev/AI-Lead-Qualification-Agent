# Observability & Operations

## Observability goals
Answer, without guessing:
- Did the submission arrive?
- Which version processed it?
- Where is it now?
- What business disposition was produced and why?
- Did AI analysis validate?
- Which side effects were attempted/succeeded/failed?
- Was a human override involved?
- Can the case be safely reprocessed?

## Correlation
`correlation_id` is propagated through workflow stages, processing records, events, errors, and internal notifications where safe.

## Structured event fields
Minimum:
- timestamp;
- environment;
- workflow/release version;
- correlation ID;
- lead ID;
- stage;
- event type;
- processing state;
- disposition if applicable;
- reason/error class;
- attempt number;
- duration where measured.

## Metrics to measure during testing
No target values are invented in Phase 3. Measure:
- total test submissions;
- outcomes by disposition;
- human-review count/rate;
- invalid and duplicate outcomes;
- AI schema-validation failures;
- retry counts;
- unrecovered failures;
- end-to-end latency distribution;
- AI call count per processed lead;
- estimated variable AI cost where provider usage data permits;
- duplicate side-effect violations (target expectation: zero; must be tested, not assumed).

## Logging policy
Log identifiers and structured metadata by default. Avoid raw full lead payloads in operational logs. Sensitive details belong in controlled data stores with access restrictions.

## Alerting
Alert on actionable conditions, including:
- exhausted critical retries;
- authentication/configuration failure;
- repeated dependency failure;
- impossible state transition;
- human-review backlog threshold only after a threshold is intentionally configured.

Do not alert on every expected business disqualification.

## Runbooks required before real-data use
- dependency outage;
- invalid/expired credentials;
- stuck/retry-pending execution;
- duplicate side-effect investigation;
- suspected secret exposure;
- human-review recovery;
- rollback to prior workflow/policy version.

## Execution retention
n8n execution history is operational tooling, not the canonical audit database. Configure retention/pruning according to deployment capacity and privacy needs. Exact retention duration must be chosen before real personal data is used.

## Portfolio evidence boundary
Public metrics must be generated from the synthetic test harness and sanitized exports, not copied from arbitrary production execution screens.
