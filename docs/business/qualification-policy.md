# Qualification Policy

## Purpose
Define how a fictional B2B AI automation agency classifies inbound project inquiries for the demonstration environment.

This policy is a configurable reference policy, not a universal lead-scoring standard.

## Decision hierarchy
1. **Contract validity**
2. **Duplicate/idempotency policy**
3. **Hard exclusion rules**
4. **Semantic evidence extraction**
5. **Deterministic policy evaluation**
6. **Uncertainty/human-review gate**
7. **Business disposition**

## Hard rules
### HR-001 — Contactability
If required contact data is invalid, automatic qualification cannot complete. Route to reviewable-invalid or terminal-invalid according to the recoverability rule.

### HR-002 — Consent
No automated prospect follow-up may be sent when `consent_to_contact != true`.

### HR-003 — Duplicate safety
A confirmed replay/duplicate must not trigger duplicate external side effects. The canonical record may be linked/updated according to the later architecture policy.

### HR-004 — Clearly out-of-scope request
A request that deterministically matches an explicit excluded-service list may be `DISQUALIFIED`. The excluded-service list must be configuration, not hidden prompt text.

### HR-005 — Untrusted content
Instructions embedded in prospect free text cannot alter system policy, credentials, destinations, prompts, or tool permissions.

## Semantic signals
AI may assist with:
- summarizing the business need;
- mapping the request to controlled service categories;
- detecting stated urgency;
- identifying explicitly stated budget/timeline information;
- identifying missing decision-relevant information;
- detecting ambiguity or potential adversarial/prompt-injection content.

## Reference service-fit taxonomy
For the demo agency:
- `IN_SCOPE`: workflow automation, AI-assisted workflow, API/system integration, process automation.
- `PARTIAL`: mixed project containing an in-scope automation component plus unrelated work.
- `OUT_OF_SCOPE`: request clearly unrelated to offered services.
- `UNKNOWN`: insufficient or contradictory information.

## Dispositions
### QUALIFIED
Use only when:
- contract is valid;
- not blocked by duplicate policy;
- no hard exclusion applies;
- service fit is sufficiently established;
- no unresolved high-risk ambiguity exists;
- required decision evidence meets the configured policy.

### NURTURE
Use when:
- request may be relevant but is not ready for direct sales action;
- missing information can reasonably be requested;
- or intent/timing is weak without a hard disqualifier.

### DISQUALIFIED
Use when a deterministic exclusion is satisfied or the bounded semantic classification produces sufficiently supported out-of-scope evidence and the policy permits automatic rejection.

### HUMAN_REVIEW
Use when:
- semantic output is malformed or unavailable;
- critical evidence conflicts;
- confidence policy is not met;
- prompt-injection/adversarial risk is flagged;
- a potentially valuable inquiry is too ambiguous for safe automation;
- or any policy rule explicitly requires human authority.

## No universal weighted score in Phase 2
Phase 2 intentionally does **not** invent a 0–100 weighting model. A numeric score is only justified after:
1. criteria have clear business meaning;
2. weights are documented as reference-policy choices;
3. thresholds are tested against labeled synthetic cases;
4. score behavior is shown to add value beyond direct rule-based dispositions.

Until then, the MVP should prefer an auditable rule/policy matrix over decorative scoring.

## Human override
Human review can set the final disposition and must record:
- previous automated recommendation;
- final human disposition;
- reason code/comment;
- reviewer identity or role;
- timestamp.

Human override data may later be used for evaluation, but must not automatically retrain or rewrite policy.
