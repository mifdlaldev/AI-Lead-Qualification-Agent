# Reliability & Error Handling

## Failure taxonomy
### Validation failures
Expected business/input failures. No retry unless the source can correct data.

### Duplicate/replay
Expected control outcome, not an operational error.

### Transient dependency failure
Examples: timeout, temporary 5xx, rate limiting. Retry may be appropriate.

### Permanent dependency failure
Examples: invalid credentials, invalid destination, rejected request caused by configuration. Do not blindly retry.

### AI contract failure
Malformed/unparseable structured result, unavailable model, or output violating schema. Apply bounded retry/repair strategy, then human review or failure according to policy.

### Policy/configuration failure
Missing policy version, impossible state transition, invalid configuration. Fail closed and alert operator.

### Unknown/unexpected failure
Capture sanitized context, mark recoverable state when possible, and alert.

## Retry policy
Retry only operations classified as transient or explicitly safe.

Required properties:
- bounded attempts;
- exponential backoff with jitter where implementation supports it;
- respect provider retry/rate-limit guidance;
- no retry storm;
- idempotency protection before retrying side effects;
- attempt count and final outcome recorded.

Exact delays and attempt counts are deployment parameters and must be configured after provider limits are known; Phase 3 does not invent universal values.

## Side-effect safety pattern
1. Derive deterministic `action_key` from business action identity.
2. Atomically create/claim side-effect ledger record.
3. If already `SUCCEEDED`, skip delivery.
4. If eligible, mark/claim attempt.
5. Call external provider.
6. Persist provider reference and outcome.
7. Retry only under documented policy.

For providers with native idempotency keys, pass the stable action key where supported.

## AI failure strategy
1. Validate response against strict schema.
2. If malformed and retry is safe, perform a bounded retry using the same business input and versioned contract.
3. Never silently coerce missing decision facts into positive values.
4. If still invalid, route to `HUMAN_REVIEW` when the lead can be safely preserved; otherwise mark technical failure.

## Central error workflow
Unexpected workflow errors should feed a dedicated error workflow that records:
- workflow/release identifier;
- execution identifier;
- correlation ID if available;
- failed stage/node identifier;
- sanitized error class/message;
- timestamp;
- retryability classification.

Operator alerts must not contain credentials, authorization headers, raw secret-bearing payloads, or unnecessary personal data.

## Recovery
Reprocessing must start from a documented safe checkpoint. Do not restart from ingress if that would repeat already successful side effects. The side-effect ledger and processing state determine the safe resume point.

## Dead-letter concept
Failures that exhaust automated recovery must remain queryable as unresolved operational work. Whether implemented as a database table/status or queue is a Phase 3 deployment choice; the required behavior is durable visibility and manual recovery capability.

## Circuit breaking / degradation
For a portfolio MVP, a distributed circuit-breaker platform is not required. However:
- repeated dependency failures should be visible;
- optional non-critical actions may be skipped/deferred according to policy;
- critical state persistence failures must fail closed.

## Completion rule
`COMPLETED` means required durable state and required disposition-specific actions are successful or durably queued/recorded according to the selected delivery architecture. AI success alone never means workflow completion.
