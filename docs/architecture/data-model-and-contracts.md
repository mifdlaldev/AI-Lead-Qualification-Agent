# Data Model & Integration Contracts

## Core entities
### leads
- `id` UUID primary key
- `source_system`
- `source_submission_id` nullable
- normalized contact/business fields
- `project_description`
- `consent_to_contact`
- `payload_fingerprint`
- `current_processing_state`
- `current_disposition`
- `policy_version`
- timestamps

Constraints: unique source identity when available; indexes for lookup/fingerprint as justified by tests.

### processing_runs
- `id`
- `lead_id`
- `correlation_id` unique
- `attempt_number`
- `workflow_version`
- start/end timestamps
- final technical status
- failure classification nullable

### semantic_analyses
- `id`
- `processing_run_id`
- `analysis_schema_version`
- `model/provider identifiers` as observed metadata
- validated structured result
- validation status
- prompt/template version
- timestamps

Do not store hidden chain-of-thought. Store only the structured business evidence required by the contract.

### decisions
- `id`
- `lead_id`
- `processing_run_id`
- `policy_version`
- automated disposition
- reason codes
- evidence references
- created_at

### review_items
- `id`
- `lead_id`
- automated recommendation
- review reason codes
- status: `OPEN | RESOLVED | CANCELLED`
- reviewer identifier/role nullable
- final disposition nullable
- resolution note/reason
- timestamps

### side_effects
- `id`
- `lead_id`
- `processing_run_id`
- `action_key` unique
- action type
- destination class
- status: `PENDING | IN_PROGRESS | SUCCEEDED | RETRY_PENDING | FAILED | SKIPPED`
- provider reference nullable
- attempt count
- sanitized error classification nullable
- timestamps

### processing_events
Append-oriented event records:
- `id`
- `correlation_id`
- `lead_id`
- previous/new state
- event type
- actor type
- reason code
- safe metadata
- timestamp

## Contract versioning
Version independently:
- inbound schema;
- semantic analysis schema;
- business policy;
- prompt/template;
- workflow release.

A result must be attributable to the versions that produced it.

## Transaction boundaries
Use database uniqueness/transactions for:
- claiming an idempotency key;
- canonical lead creation/update where duplicate races matter;
- side-effect action-key creation before external delivery;
- human review resolution where double resolution is possible.

Do not rely on “check then insert” without a uniqueness constraint for race-sensitive idempotency.

## External integration contract pattern
Each adapter must define:
- input schema;
- output schema;
- timeout;
- retry eligibility;
- rate-limit behavior;
- authentication mechanism;
- idempotency capability;
- error mapping;
- sensitive fields;
- observability fields.

## Data classification
- **Public:** repository docs and synthetic fixtures.
- **Internal:** workflow metadata, non-sensitive operational metrics.
- **Confidential:** real lead/contact data and business descriptions.
- **Secret:** API keys, OAuth tokens, database credentials, encryption keys.

Secret values must never be stored in application tables as ordinary lead/event data.
