# Integration Test Plan — Phase 5 Ingress Pipeline

## Purpose

This document defines the end-to-end integration test plan for the Phase 5 ingress pipeline: WF-01 (API Ingress) → WF-03 (Core Orchestrator) → sub-workflows → final disposition.

## Scope

- **WF-01** (API Ingress): Accepts lead payloads via webhook, validates submission format, returns API response
- **WF-03** (Core Orchestrator): Coordinates all sub-workflows, manages state transitions in PostgreSQL
- **Sub-workflows**: WF-04 through WF-10 (validation, idempotency, prequalification, AI analysis, decision, review, routing)

## Test Data

Test fixtures are sourced from `fixtures/synthetic-leads.json` and validated against `fixtures/expected-outcomes.json`.

| Fixture ID | AC Ref | Description | Expected Disposition |
|-----------|--------|-------------|---------------------|
| SYNTH-001 | AC-01 | Valid in-scope SaaS automation | QUALIFIED |
| SYNTH-002 | AC-02 | Missing required field (email) | INVALID (V-001) |
| SYNTH-003 | AC-03 | Duplicate replay of SYNTH-001 | DUPLICATE (D-001) |
| SYNTH-004 | AC-04 | Out-of-scope (wedding photography) | DISQUALIFIED (P-002) |
| SYNTH-005 | AC-05 | Ambiguous high-potential | HUMAN_REVIEW (A-003) |
| SYNTH-006 | AC-06 | AI output malformed | FAILED (A-005) |
| SYNTH-007 | AC-07 | Prompt injection in description | QUALIFIED (policy-preserved) |
| SYNTH-008 | AC-08 | No consent for automated follow-up | QUALIFIED_NO_FOLLOW_UP |
| SYNTH-009 | AC-09 | Human override to QUALIFIED | QUALIFIED_OVERRIDE |
| SYNTH-010 | AC-10 | External dependency failure | FAILED (A-005) |
| SYNTH-011 | AC-11 | Clean qualified lead (reproducibility) | QUALIFIED |

## Test Environment

### Prerequisites
- n8n instance running with all workflows activated
- PostgreSQL database accessible with canonical schema
- AI provider (OpenAI/Anthropic) configured
- `fixtures/synthetic-leads.json` loaded
- `fixtures/expected-outcomes.json` loaded

### Database State
Before each test run, the database must be reset to a clean state:
- Truncate `leads`, `processing_runs`, `decisions`, `reviews`, `events` tables
- Ensure no duplicate detection conflicts from prior runs

## Test Execution

### Step 1: Database Reset
```bash
# Reset the database to a clean state
psql $DATABASE_URL -f scripts/reset-test-database.sql
```

### Step 2: Submit Test Leads
For each synthetic lead, submit a POST request to the WF-01 webhook endpoint:

```bash
# Example: Submit SYNTH-001
curl -X POST "http://localhost:5678/webhook-test/lead-ingress-api" \
  -H "Content-Type: application/json" \
  -d @fixtures/synthetic-leads.json \
  --data-binary '{...}'
```

### Step 3: Wait for Processing
Allow the orchestrator (WF-03) to complete processing. This includes:
- Validation (WF-04)
- Idempotency check (WF-05)
- Prequalification (WF-06)
- AI analysis (WF-07)
- Decision (WF-08)
- Review creation (WF-09, if applicable)
- Routing (WF-10)

Wait time: ~30-60 seconds per lead (depending on AI provider latency).

### Step 4: Validate Database State
After processing, query the database to verify:

```sql
-- Check lead state
SELECT l.lead_id, l.current_processing_state, l.current_disposition
FROM leads l
WHERE l.lead_id LIKE 'SYNTH-%';

-- Check processing runs
SELECT pr.lead_id, pr.correlation_id, pr.processing_status, pr.reason_codes
FROM processing_runs pr
WHERE pr.lead_id LIKE 'SYNTH-%';

-- Check decisions
SELECT d.decision_id, d.lead_id, d.disposition, d.reason_codes
FROM decisions d
WHERE d.lead_id LIKE 'SYNTH-%';

-- Check reviews (if any)
SELECT r.review_id, r.lead_id, r.status, r.final_disposition
FROM reviews r
WHERE r.lead_id LIKE 'SYNTH-%';
```

### Step 5: Assert Expected Outcomes
Compare database state against `fixtures/expected-outcomes.json`:

| Check | How to Verify |
|-------|---------------|
| Processing state | `leads.current_processing_state` matches expected |
| Disposition | `leads.current_disposition` matches expected |
| Reason codes | `processing_runs.reason_codes` contains expected codes |
| Decision record | `decisions` table has entry with correct disposition |
| No duplicate side effects | Second submission of SYNTH-003 does not create duplicate emails/events |
| Human review created | `reviews` table has entry for SYNTH-005 |
| No follow-up for SYNTH-008 | No email/notification action recorded |
| Override recorded | `reviews.override_recorded = true` for SYNTH-009 |

## Test Cases

### TC-01: Happy Path — Qualified Lead
- **Fixture**: SYNTH-001
- **Submit**: POST to WF-01 with valid lead payload
- **Expected**:
  - WF-01 returns `200` with `correlation_id`, `status: "accepted"`
  - WF-03 processes through all sub-workflows
  - Database: `current_processing_state = "COMPLETED"`, `current_disposition = "QUALIFIED"`
  - Reason codes include `V-010`, `D-010`, `P-001`, `A-001`, `Q-001`, `R-001`

### TC-02: Validation Failure — Missing Required Field
- **Fixture**: SYNTH-002
- **Submit**: POST to WF-01 with missing email
- **Expected**:
  - WF-01 returns `200` with `status: "accepted"` (ingress accepts, validation fails downstream)
  - WF-03 short-circuits at WF-04
  - Database: `current_processing_state = "INVALID"`, `current_disposition = "NONE"`
  - Reason codes include `V-001`

### TC-03: Duplicate Detection
- **Fixture**: SYNTH-003 (same payload as SYNTH-001)
- **Submit**: POST to WF-01 after SYNTH-001 has been processed
- **Expected**:
  - WF-03 detects duplicate at WF-05
  - Database: `current_processing_state = "DUPLICATE"`, `current_disposition = "NONE"`
  - Reason codes include `D-001`
  - No duplicate AI analysis, email, or notification triggered

### TC-04: Out-of-Scope Disqualification
- **Fixture**: SYNTH-004
- **Submit**: POST to WF-01 with wedding photography inquiry
- **Expected**:
  - WF-06 prequalification returns `DISQUALIFIED`
  - Database: `current_processing_state = "COMPLETED"`, `current_disposition = "DISQUALIFIED"`
  - Reason codes include `P-002`
  - No AI analysis triggered (prequal terminates early)

### TC-05: Human Review Routing
- **Fixture**: SYNTH-005
- **Submit**: POST to WF-01 with ambiguous high-budget inquiry
- **Expected**:
  - WF-06 prequalification passes, WF-07 AI analysis runs
  - WF-08 decision returns `HUMAN_REVIEW`
  - WF-09 creates review record
  - Database: `current_processing_state = "AWAITING_HUMAN_REVIEW"`, `current_disposition = "NONE"`
  - `reviews` table has entry with `status = "PENDING"`

### TC-06: AI Malformed Output
- **Fixture**: SYNTH-006
- **Submit**: POST to WF-01 with prompt designed to produce malformed AI output
- **Expected**:
  - WF-07 AI analysis returns malformed output
  - WF-03 detects contract violation and follows failure path
  - Database: `current_processing_state = "FAILED"`, `current_disposition = "NONE"`
  - Reason codes include `A-005`

### TC-07: Prompt Injection Resistance
- **Fixture**: SYNTH-007
- **Submit**: POST to WF-01 with adversarial text in project_description
- **Expected**:
  - Policy is not altered by the injection
  - Decision follows deterministic policy rules, not AI-injected instructions
  - Database: `current_disposition = "QUALIFIED"` (if lead is otherwise valid)
  - No evidence of policy bypass in reason codes or decision

### TC-08: No Consent — No Automated Follow-up
- **Fixture**: SYNTH-008
- **Submit**: POST to WF-01 with `consent_to_contact: false`
- **Expected**:
  - Lead is qualified but no automated email/notification is sent
  - Database: `current_processing_state = "COMPLETED"`, `current_disposition = "QUALIFIED_NO_FOLLOW_UP"`
  - Reason codes include `R-003`

### TC-09: Human Override
- **Fixture**: SYNTH-009 (requires manual step via WF-13)
- **Setup**: SYNTH-005 processed first to create a HUMAN_REVIEW
- **Execute**: WF-13 resolves the review with `final_disposition = "QUALIFIED"`
- **Expected**:
  - Database: `current_processing_state = "COMPLETED"`, `current_disposition = "QUALIFIED_OVERRIDE"`
  - `reviews` table: `status = "RESOLVED"`, `override_recorded = true`
  - Reason codes include `H-001`

### TC-10: External Dependency Failure
- **Fixture**: SYNTH-010
- **Submit**: POST to WF-01, trigger AI API failure (simulate via timeout/invalid key)
- **Expected**:
  - WF-07 retries up to configured limit
  - After retries exhausted, WF-03 follows failure path
  - Database: `current_processing_state = "FAILED"`, `current_disposition = "NONE"`
  - Reason codes include `A-005`
  - WF-14 (Global Error Handler) creates error event

### TC-11: Evidence Reproducibility
- **Fixture**: SYNTH-011
- **Submit**: POST to WF-01 with clean qualified lead
- **Expected**:
  - Processing completes with consistent results across multiple runs
  - WF-15 (Evidence Generation) validates fixture
  - Database state matches expected outcomes
  - All evidence is reproducible and synthetic

## Post-Test Validation

After all test cases complete, run the contract compliance check:

```bash
node tests/contract-compliance-check.js
```

This verifies that each workflow's output structure matches the contract defined in `schemas/workflow-contracts.json`.

## Success Criteria

- All 11 test cases produce the expected disposition and processing state
- No duplicate side effects for TC-03
- Prompt injection does not alter policy for TC-07
- No automated follow-up for TC-08
- Human override recorded correctly for TC-09
- All workflows pass contract compliance check
- All evidence is synthetic and reproducible

## Failure Handling

| Failure Mode | Expected Behavior |
|-------------|-------------------|
| Database unavailable | WF-14 records error event, returns 500 |
| AI API timeout | WF-07 retries, then WF-03 routes to FAILED |
| Sub-workflow not found | WF-03 records error, processing stops |
| Schema validation failure | WF-01 rejects with 400, no processing |

## Notes

- This test plan requires a running n8n instance with all workflows activated
- All test data is synthetic and reproducible
- Database must be reset between test runs
- AI provider latency may affect test duration
- TC-09 requires manual WF-13 execution or a simulated review resolution