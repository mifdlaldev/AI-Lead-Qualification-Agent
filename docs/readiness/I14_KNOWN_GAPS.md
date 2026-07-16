# I-14 Known Gaps — Implementation Readiness Assessment

**Date:** 2026-07-16  
**Assessment:** `tests/i14-readiness-assessment.js` (150/150 passed, 0 failures)  
**Verdict:** READY WITH CAVEATS — all gaps are runtime execution gaps, not specification gaps.

---

## Gap Classification

- **CRITICAL**: Would block benchmark execution or invalidate results
- **HIGH**: Would compromise security, reliability, or evidence quality
- **MEDIUM**: Would limit coverage or completeness; acceptable for MVP

---

## CRITICAL (2)

### GAP-I11-001: Review lifecycle callback broken
- **What**: WF-13 resolves human review but WF-03 never re-enters the pipeline. Once a lead reaches `HUMAN_REVIEW`, the resolution is persisted but never acted upon — the lead is stuck forever.
- **Root cause**: WF-03 returns after creating the review item in WF-09. There is no callback/webhook from WF-13 back to WF-03 to re-process the resolved lead.
- **Fix needed**: Add a WF-13 → WF-03 callback node, or implement a polling/push mechanism in WF-03 that checks for resolved reviews.
- **Blocked by**: Requires n8n runtime for testing; cannot be validated with static analysis alone.

### GAP-I12-001: No evidence generated
- **What**: `evidence/` directory is empty. WF-15 (Synthetic Evaluation Runner) has never been executed. AC-11 (reproducible evidence run) cannot be verified.
- **Root cause**: No n8n instance, PostgreSQL, or API keys configured. WF-15 requires a live environment.
- **Fix needed**: Configure infrastructure, run WF-15 against frozen fixtures, collect evidence.
- **Blocked by**: Requires n8n + PostgreSQL + API keys.

---

## HIGH (10)

### AI-001: WF-07 does not strip markdown fences
- **What**: AI returns JSON inside ``` fences — code does NOT strip them. JSON.parse fails → MALFORMED.
- **Fix**: Add a "Strip Markdown Fences" node before JSON.parse in WF-07.

### AI-002: project_description sent directly to AI system prompt
- **What**: No sanitization before the AI call. Prompt injection is possible.
- **Fix**: Add input sanitization node (truncate, escape, or restrict) before AI node in WF-07.

### AI-003: Null values pass existence check
- **What**: `null !== undefined` → treated as valid. Fields with null values bypass validation.
- **Fix**: Add explicit null checks in WF-04 validation logic.

### AI-004: summary maxLength (500) not enforced
- **What**: Schema declares `maxLength: 500` but code only checks existence, not length.
- **Fix**: Add length validation in WF-04 or WF-07.

### AI-005: Case-sensitive error matching
- **What**: "Rate limit" (uppercase R) does NOT match "rate" in error classification. HTTP 429 errors may be misclassified.
- **Fix**: Use case-insensitive matching in WF-14 error classification.

### AI-006: Partial failure state corruption
- **What**: INSERT succeeds but UPDATE fails in WF-07 → analysis persisted but state stuck at ANALYZING.
- **Fix**: Wrap in PostgreSQL transaction or add compensating logic in WF-03.

### GAP-I12-003: No adversarial fixtures
- **What**: `fixtures/adversarial/` directory is empty. Only SYNTH-007 tests prompt injection via static analysis.
- **Fix**: Generate adversarial fixtures from actual workflow execution.

### GAP-I12-004: NURTURE disposition uncovered
- **What**: Zero synthetic fixtures produce NURTURE disposition. This path is untested.
- **Fix**: Add a NURTURE fixture to `fixtures/synthetic-leads.json`.

### GAP-I12-005: No side effect evidence
- **What**: Email (WF-12) and Telegram (WF-11) delivery has never been verified.
- **Fix**: Execute WF-15 with demo destinations configured, capture delivery logs.

### GAP-I12-006: No review resolution fixtures
- **What**: No fixtures for review resolution paths H-002, H-003, H-004.
- **Fix**: Add review resolution fixtures to test the full review lifecycle.

---

## MEDIUM (6)

| ID | Description | Fix |
|---|---|---|
| AC-08 | No P-003 (no consent) fixture | Add SYNTH-003 with `consent: false` |
| GAP-I12-011 | No V-002 (INVALID_EMAIL_FORMAT) fixture | Add invalid email fixture |
| GAP-I12-012 | No V-003 (EMPTY_PROJECT_DESCRIPTION) fixture | Add empty description fixture |
| GAP-I12-013 | No I-003 (FINGERPRINT_MATCH) fixture | Add fingerprint collision fixture |
| GAP-I11-014 | Token TTL hardcoded in WF-09 | Move to configuration variable |
| — | `reason-codes.json` lacks `version` field | Add `"version": "1.0.0"` |

---

## Pre-requisites for Closing Gaps

All gaps above require one or more of:

1. **n8n instance running** (local Docker or cloud)
2. **PostgreSQL connected** (Supabase or local)
3. **API keys configured**: OpenAI, Resend, Telegram
4. **WF-15 execution**: Synthetic benchmark run against frozen fixtures

These are **Phase 6 (I-14 Benchmark Release)** prerequisites, not Phase 5 planning gaps.

---

## What IS Complete (No Gaps)

| Area | Evidence |
|---|---|
| R0-R7 Readiness Checklist | 150/150 assertions, 0 failures |
| 15 Workflow Definitions | All versioned 1.0.0, valid JSON, no secrets |
| 3 Machine-Readable Schemas | All with `$id` (v1) |
| Database Foundation | Migration + roles + seed + verify script |
| Contract Registry | Workflow contracts, reason codes, policy v1 |
| Requirement Traceability | All FR, NFR, AC mapped to implementation |
| Threat Model | T1-T8 threats, security controls |
| 44 Test Files | All passing, 0 regressions, 0 failures |
| Prompt v1 | `semantic-analysis-v1.md` |
| Configuration | `.env.example` with all placeholders |

---

## Next Step: I-14 Benchmark Release

When infrastructure is available:
1. Configure n8n + PostgreSQL + API keys
2. Import all 15 workflows into n8n
3. Run WF-15 against frozen `fixtures/synthetic-leads.json`
4. Collect `evidence/` output
5. Calculate metrics: accuracy, review rate, AI call avoidance, latency
6. Document results in `evidence/run-summary.json`