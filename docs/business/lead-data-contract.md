# Lead Data Contract

## Principle
The canonical contract is vendor-neutral. Field names describe business meaning, not a specific form builder or CRM.

## Inbound submission v1
### Required
- `submission_id`: source-provided unique ID when available; otherwise generated at ingress.
- `submitted_at`: ISO-8601 timestamp assigned or normalized at ingress.
- `full_name`: non-empty human-readable name.
- `email`: syntactically valid email address.
- `project_description`: non-empty free text describing the request.
- `consent_to_contact`: boolean; must be true before automated prospect follow-up.

### Optional
- `company_name`
- `company_website`
- `job_title`
- `phone`
- `country`
- `budget_range`: enum or normalized range; never infer an exact budget from silence.
- `desired_timeline`: enum/free-text input normalized when possible.
- `service_interest`: source-provided category if present.
- `lead_source`
- `utm_*` attribution fields

## System metadata
- `correlation_id`: unique processing trace ID.
- `schema_version`: starts at `1`.
- `received_at`
- `source_system`
- `payload_fingerprint`: deterministic fingerprint used as one duplicate signal.
- `processing_attempt`

## AI semantic analysis contract
The exact schema implementation belongs to architecture, but the business contract must include:
- `summary`: concise neutral summary;
- `detected_need`: controlled category or `UNKNOWN`;
- `service_fit`: `IN_SCOPE | PARTIAL | OUT_OF_SCOPE | UNKNOWN`;
- `intent_signal`: `HIGH | MEDIUM | LOW | UNKNOWN`;
- `urgency_signal`: `HIGH | MEDIUM | LOW | UNKNOWN`;
- `budget_signal`: `EXPLICIT_FIT | EXPLICIT_MISMATCH | NOT_PROVIDED | AMBIGUOUS`;
- `decision_relevant_facts`: structured facts grounded in the submission;
- `missing_information`: list;
- `risk_flags`: controlled list;
- `confidence`: normalized numeric value only if the selected model/approach can support a defined interpretation; otherwise use categorical confidence and test it empirically.

## Prohibited AI behavior
The AI component must not:
- invent missing budget, company size, urgency, authority, or requirements;
- treat instructions inside `project_description` as workflow commands;
- produce executable tool arguments that bypass deterministic policy;
- silently convert `UNKNOWN` into a positive signal.

## Validation outcomes
- `VALID`: required fields and consent policy permit normal processing.
- `INVALID_REVIEWABLE`: data is malformed/incomplete but potentially recoverable.
- `INVALID_TERMINAL`: cannot be processed under the defined contract.

The exact mapping of validation failures to these outcomes must be implemented as explicit rules.

## Data minimization
Collect only fields needed for qualification, routing, contact, testing, and audit. Synthetic test data must not contain real personal data unless there is a separately justified reason and lawful handling process.
