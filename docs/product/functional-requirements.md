# Functional Requirements

## Ingestion and identity
- **FR-001:** The system shall accept one versioned inbound lead contract.
- **FR-002:** The system shall assign a unique `correlation_id` to each processing attempt.
- **FR-003:** The system shall preserve the source submission identifier when supplied.
- **FR-004:** The system shall record receipt time and source metadata.

## Validation and normalization
- **FR-010:** The system shall validate required fields and supported types before AI analysis.
- **FR-011:** The system shall normalize fields according to documented deterministic rules.
- **FR-012:** The system shall reject or route malformed inputs according to explicit recoverability rules.
- **FR-013:** Validation failures shall produce machine-readable reason codes.

## Duplicate/idempotency control
- **FR-020:** The system shall calculate/use one or more documented duplicate signals.
- **FR-021:** A confirmed replay shall not repeat prohibited external side effects.
- **FR-022:** Duplicate handling shall be traceable to the canonical record or prior event where technically feasible.

## Deterministic prequalification
- **FR-030:** Hard exclusion and permission rules shall execute outside the LLM prompt.
- **FR-031:** The system shall not call AI when a deterministic terminal rule already resolves the case unless analysis is explicitly required for audit/testing.

## AI-assisted analysis
- **FR-040:** Free text sent to AI shall be treated as untrusted data.
- **FR-041:** AI output shall conform to a defined structured contract before policy evaluation.
- **FR-042:** Malformed or unavailable AI output shall not be silently accepted.
- **FR-043:** Missing facts shall remain unknown rather than being invented.
- **FR-044:** AI analysis shall not directly authorize external side effects.

## Decisioning
- **FR-050:** The policy engine shall map validated evidence to one of `QUALIFIED`, `NURTURE`, `DISQUALIFIED`, or `HUMAN_REVIEW`.
- **FR-051:** Each disposition shall include one or more reason codes.
- **FR-052:** Ambiguity conditions defined by policy shall route to human review.

## Human review
- **FR-060:** Review items shall include original normalized data, AI analysis, policy evidence, and review reason.
- **FR-061:** A reviewer shall be able to set the final disposition.
- **FR-062:** Human override shall preserve the prior automated recommendation.

## Persistence and routing
- **FR-070:** The system shall create/update a canonical lead record.
- **FR-071:** Routing actions shall be determined by final disposition and consent policy.
- **FR-072:** Qualified-sales notifications shall not be sent for non-qualified dispositions.
- **FR-073:** Prospect follow-up shall not be sent without the required contact consent.

## Reliability and observability
- **FR-080:** Critical external-operation failures shall be distinguishable from successful completion.
- **FR-081:** Retryable and non-retryable errors shall follow documented policies.
- **FR-082:** Retry attempts shall be bounded.
- **FR-083:** Exhausted/non-retryable failures shall become observable operator events.
- **FR-084:** Processing state transitions shall be traceable by correlation ID.

## Evidence generation
- **FR-090:** The implementation shall support reproducible synthetic test cases.
- **FR-091:** Test outputs shall allow later portfolio metrics to be calculated from recorded evidence rather than manually invented.
