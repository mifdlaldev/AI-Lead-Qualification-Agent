# Reference Business Scenario

**Status:** Accepted planning fixture  
**Important:** This is a fictional demonstration environment, not a client engagement or case study.

## Scenario
A small **B2B AI automation agency** receives inbound project inquiries from businesses seeking workflow automation, AI-assisted operations, integrations, or related implementation work.

The agency needs a repeatable way to turn a raw inquiry into a traceable next action without requiring a person to manually perform every triage step.

## Why this scenario
- It is close to the service category Mifdlal intends to sell.
- It produces realistic free-text inquiries suitable for semantic analysis.
- It supports clear deterministic rules and human-review cases.
- It can be tested entirely with synthetic data.
- It is understandable to prospective freelance clients without pretending to represent one real company.

## Reference process
1. A prospect submits an inquiry.
2. The system validates the payload and normalizes fields.
3. The system checks whether the submission appears to be a replay/duplicate.
4. Deterministic eligibility rules are evaluated.
5. AI extracts structured meaning from free text where rules alone are insufficient.
6. A policy engine combines deterministic facts and bounded AI-derived signals.
7. The system produces a business disposition and reason codes.
8. Ambiguous cases are routed to human review.
9. The canonical record is updated.
10. Appropriate notifications/follow-up actions are requested.
11. Processing events are recorded for traceability.

## Actors
- **Prospect:** submits the inquiry.
- **Sales/Owner:** receives qualified opportunities and makes final commercial decisions.
- **Human Reviewer:** resolves ambiguous or low-confidence cases.
- **Workflow System:** orchestrates deterministic processing and side effects.
- **AI Analysis Component:** performs bounded semantic extraction/classification; it does not own final business policy.
- **System of Record:** stores the canonical lead and processing state.
- **Notification/Follow-up Channel:** delivers approved outbound actions.

## Example inquiry categories
These are test categories, not market-frequency claims:
- clear in-scope automation project;
- vague but potentially relevant inquiry;
- clearly unrelated service request;
- spam/test submission;
- duplicate/replayed submission;
- incomplete contact data;
- prompt-injection/adversarial text;
- high-potential inquiry requiring human judgment.

## Business boundary
The workflow ends at **qualification, routing, recording, notification, and controlled follow-up initiation**. It does not autonomously negotiate price, sign contracts, promise delivery dates, or make irreversible commercial commitments.
