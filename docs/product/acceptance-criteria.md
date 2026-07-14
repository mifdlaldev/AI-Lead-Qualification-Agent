# Acceptance Criteria

These criteria define expected product behavior before implementation. Exact technical test procedures belong to the testing phase.

## AC-01 Valid in-scope inquiry
**Given** a valid, non-duplicate inquiry with clearly supported in-scope need and no review trigger,  
**When** processing completes,  
**Then** it receives a policy-supported disposition, reason codes, canonical record, required route, and traceable event history.

## AC-02 Missing required field
**Given** a submission missing a required field,  
**When** validation runs,  
**Then** AI analysis is not used to invent the missing value and the submission follows the documented invalid/recovery path.

## AC-03 Duplicate replay
**Given** the same event is replayed under the duplicate policy,  
**When** it is processed again,  
**Then** prohibited external side effects are not duplicated and the duplicate outcome is traceable.

## AC-04 Clearly out-of-scope inquiry
**Given** a valid inquiry satisfying an explicit exclusion policy,  
**When** decisioning completes,  
**Then** it is not routed as a qualified sales opportunity and the exclusion reason is recorded.

## AC-05 Ambiguous high-potential inquiry
**Given** an inquiry that may be valuable but lacks sufficient decision evidence,  
**When** policy cannot safely resolve it,  
**Then** it is routed to `HUMAN_REVIEW` rather than being forced into qualified/disqualified.

## AC-06 AI output malformed
**Given** the AI component returns output that fails the required contract,  
**When** validation of that output occurs,  
**Then** the output is not used as valid decision evidence and the configured retry/review/failure path is followed.

## AC-07 Prompt-injection-style lead text
**Given** project text containing instructions to ignore policy, expose secrets, change recipients, or invoke privileged actions,  
**When** processed,  
**Then** those instructions do not alter deterministic workflow policy or authorization and the risk is handled according to the review policy.

## AC-08 No consent for automated follow-up
**Given** `consent_to_contact` is false,  
**When** routing occurs,  
**Then** no automated prospect follow-up is sent.

## AC-09 Human override
**Given** a case in human review,  
**When** an authorized reviewer resolves it,  
**Then** the final human disposition, prior automated recommendation, reason, and timestamp remain distinguishable.

## AC-10 External dependency failure
**Given** a required external action fails,  
**When** retry policy is applicable,  
**Then** attempts are bounded and traceable; if recovery fails, processing is not falsely marked successful.

## AC-11 Evidence reproducibility
**Given** the published synthetic test dataset and documented test procedure,  
**When** the implementation is rerun under the documented environment,  
**Then** reported portfolio metrics can be recomputed from recorded outputs, subject to explicitly documented nondeterminism.

## Phase 2 completion gate
Phase 2 is complete when:
- the reference scenario is explicit;
- data contract is explicit;
- lifecycle/dispositions are explicit;
- deterministic vs AI authority is explicit;
- human-review policy is explicit;
- functional/non-functional requirements are enumerated;
- MVP and non-goals are explicit;
- no vendor choice is falsely presented as a business requirement;
- no untested performance claim is present.
