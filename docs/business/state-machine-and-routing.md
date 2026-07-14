# State Machine & Routing

## Principle
Processing state and business disposition are separate concepts. A lead can fail technically before a business disposition exists.

## Processing states
- `RECEIVED`
- `VALIDATING`
- `INVALID`
- `DEDUPLICATING`
- `DUPLICATE`
- `PREQUALIFYING`
- `ANALYZING`
- `DECIDING`
- `AWAITING_HUMAN_REVIEW`
- `ROUTING`
- `COMPLETED`
- `RETRY_PENDING`
- `FAILED`

## Business dispositions
- `QUALIFIED`
- `NURTURE`
- `DISQUALIFIED`
- `HUMAN_REVIEW`
- `NONE` while no business decision exists.

## Valid high-level transitions
`RECEIVED → VALIDATING`

`VALIDATING → INVALID | DEDUPLICATING`

`DEDUPLICATING → DUPLICATE | PREQUALIFYING`

`PREQUALIFYING → DECIDING | ANALYZING`

`ANALYZING → DECIDING | AWAITING_HUMAN_REVIEW | RETRY_PENDING | FAILED`

`DECIDING → ROUTING | AWAITING_HUMAN_REVIEW`

`AWAITING_HUMAN_REVIEW → ROUTING`

`ROUTING → COMPLETED | RETRY_PENDING | FAILED`

`RETRY_PENDING →` the documented retry entry point for the failed operation.

## Terminal semantics
- `INVALID`: input contract prevented normal processing; reason required.
- `DUPLICATE`: duplicate policy handled the event without repeating prohibited side effects.
- `COMPLETED`: required actions for the selected disposition completed or were durably recorded for downstream delivery.
- `FAILED`: retry policy exhausted or non-retryable failure occurred; operator visibility required.

## Routing by disposition
### QUALIFIED
- persist/update canonical record;
- mark high-priority sales route according to configured policy;
- send internal notification;
- send prospect follow-up only if consent and follow-up policy allow it.

### NURTURE
- persist/update canonical record;
- route to lower-priority/nurture path;
- optionally request missing information using approved template/policy;
- do not represent the lead as sales-qualified.

### DISQUALIFIED
- persist decision and reason code;
- do not trigger qualified-sales alert;
- optional polite response only if policy and consent allow.

### HUMAN_REVIEW
- persist automated evidence and reason for review;
- create a review task/queue item;
- do not perform final disposition-specific side effects until human resolution, except acknowledgement if separately approved.

## Side-effect rule
State must not advance to `COMPLETED` merely because the AI analysis succeeded. Completion depends on the required deterministic business actions for that path.

## Event trace minimum
Each transition should record:
- `correlation_id`;
- previous state;
- new state;
- timestamp;
- transition reason;
- actor (`SYSTEM`, `AI_COMPONENT`, `HUMAN` as applicable);
- execution/attempt identifier.
