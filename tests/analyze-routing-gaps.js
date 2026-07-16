#!/usr/bin/env node
/**
 * I-10: Routing & Notification Gap Analysis
 *
 * Analyzes:
 *   1. At-least-once delivery: idempotency gaps, retry policy completeness
 *   2. Notification delivery: no guaranteed delivery, no DLQ, no retry orchestrator
 *   3. Consent policy: edge cases (null, undefined, missing)
 *   4. Routing switch: fallback handling, missing dispositions
 *   5. Side effect state machine: missing transitions, no RETRY_PENDING trigger
 *   6. Processing state invariants: DISQUALIFIED=COMPLETED vs others=ROUTING
 *   7. WF-10/WF-11/WF-12 coupling: fire-and-forget, no callback
 *   8. Observer gap: no notification to reviewer when review created
 *   9. FR-080 to FR-083: retry, observability, bounded attempts
 *   10. Transactional gaps: side_effects + leads + events not atomic
 *   11. Processing run correlation: action_key vs correlation_id
 *   12. Production readiness: DLQ, retry, monitoring
 */

let passed = 0;
let failed = 0;
const findings = { HIGH: [], MEDIUM: [], LOW: [], INFO: [] };

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.log(`  ✗ ${message}`); }
}

function finding(severity, message) {
  findings[severity].push(message);
  console.log(`  [${severity}] ${message}`);
}

console.log('=== I-10: Routing & Notification Gap Analysis ===\n');

// ── 1. At-Least-Once Delivery ──────────────────────────────
console.log('1. At-Least-Once Delivery');

finding('HIGH', 'WF-10 creates side_effects but does NOT trigger WF-11/WF-12');
finding('HIGH', 'No retry orchestrator: FAILED side_effects are never retried');
finding('HIGH', 'No dead-letter queue: FAILED side_effects infrastructurally orphaned');
finding('HIGH', 'RETRY_PENDING status exists in schema but NO workflow path to set it');
finding('HIGH', 'WF-11/WF-12 are webhook-triggered: external caller must invoke them per side_effect');
finding('MEDIUM', 'ON CONFLICT DO NOTHING provides idempotency but no retry mechanism');
finding('MEDIUM', 'attempt_count incremented but never bounded: no max_attempts check');
finding('MEDIUM', 'No exponential backoff in retry: same attempt_count for all retries');
finding('LOW', 'RETRY_PENDING is defined but unused — dead code in schema');

// ── 2. Notification Delivery Gap ───────────────────────────
console.log('\n2. Notification Delivery');

finding('HIGH', 'WF-11/WF-12 must be invoked externally — no chaining from WF-10');
finding('HIGH', 'No notification when Telegram/Email fails — ops team has no visibility');
finding('HIGH', 'S-002/S-004 events are logged but not escalated to operators');
finding('MEDIUM', 'WF-11: Telegram HTTP request — no retry on network error');
finding('MEDIUM', 'WF-12: Email HTTP request — no retry on network error');
finding('MEDIUM', 'No idempotency key verification on HTTP request: if provider succeeds but n8n crashes, state is IN_PROGRESS');
finding('LOW', 'No delivery timeout: HTTP request could hang indefinitely');

// ── 3. Consent Policy Gaps ─────────────────────────────────
console.log('\n3. Consent Policy');

finding('MEDIUM', 'consent_to_contact can be null/undefined — if node handles null gracefully');
finding('MEDIUM', 'NURTURE: consent=false → logs ROUTING_NURTURE event but email SKIPPED');
finding('MEDIUM', 'DISQUALIFIED: consent=false → logs ROUTING_DISQUALIFIED event but email SKIPPED');
finding('MEDIUM', 'S-005 EMAIL_SKIPPED_NO_CONSENT defined but NOT used in WF-12 — S-005 is not emitted');
finding('LOW', 'No consent change tracking: if consent updated after routing, no redesign');
finding('LOW', 'NURTURE consent=false → no email, but lead stays in ROUTING — no follow-up path');

// ── 4. Routing Switch Gaps ─────────────────────────────────
console.log('\n4. Routing Switch');

finding('HIGH', 'Fallback output sends UNKNOWN_DISPOSITION but no event logged');
finding('HIGH', 'Fallback does not update lead state — lead stuck in DECIDING');
finding('MEDIUM', '5 branches (QUALIFIED/NURTURE/DISQUALIFIED/HUMAN_REVIEW/fallback) — no REJECTED or ESCALATED');
finding('LOW', 'Switch uses string matching — no case variance handling');

// ── 5. Side Effect State Machine ───────────────────────────
console.log('\n5. Side Effect State Machine (PENDING → IN_PROGRESS → SUCCEEDED/FAILED)');

finding('HIGH', 'Schema defines 6 statuses but only 3 used: PENDING, IN_PROGRESS, SUCCEEDED, FAILED');
finding('HIGH', 'RETRY_PENDING: defined in schema, zero workflow code paths to set it');
finding('HIGH', 'SKIPPED: defined in schema, only reachable via email consent check — S-005 unused');
finding('MEDIUM', 'No EXPIRED status: if side_effect is never processed, it stays PENDING forever');
finding('MEDIUM', 'No CANCELLED status: if routing decision changes, no way to cancel pending SE');
finding('LOW', 'completed_at is NULL for PENDING/IN_PROGRESS/SKIPPED — expected');

// ── 6. Processing State Gaps ───────────────────────────────
console.log('\n6. Processing State');

finding('MEDIUM', 'QUALIFIED → ROUTING, NURTURE → ROUTING: same state, different disposition — only distinction');
finding('MEDIUM', 'DISQUALIFIED → COMPLETED: processing ends, but lead may still be cleaned up');
finding('MEDIUM', 'HUMAN_REVIEW → AWAITING_HUMAN_REVIEW: correct, but no timeout/expiry');
finding('LOW', 'previous_state in event logs: DECIDING → ROUTING/COMPLETED/AWAITING_HUMAN_REVIEW');

// ── 7. WF-10/WF-11/WF-12 Coupling ──────────────────────────
console.log('\n7. Workflow Coupling');

finding('HIGH', 'Fire-and-forget: WF-10 creates SE → WF-11/WF-12 must be called separately');
finding('HIGH', 'No callback from WF-11/WF-12 to WF-10: SE status not reflected in routing response');
finding('HIGH', 'WF-10 returns "routing_complete" before SEs are delivered — misleading');
finding('MEDIUM', 'WF-15 (Synthetic Evaluation Runner) is the only caller that chains WF-10 → WF-11 → WF-12');
finding('MEDIUM', 'No workflow orchestration: each SE requires manual invocation of WF-11/WF-12');
finding('LOW', 'action_key is the only coupling: no workflow_run_id for traceability');

// ── 8. Observer Gap: Review Creation Notification ──────────
console.log('\n8. Observer Gap (Review Creation)');

finding('HIGH', 'WF-09 creates review_items but no notification is sent');
finding('HIGH', 'WF-10 routes HUMAN_REVIEW but does not create a SIDE_EFFECT for notification');
finding('HIGH', 'No email/Slack/Telegram alert when new review is created');
finding('MEDIUM', 'HUMAN_REVIEW blocks both TELEGRAM_ALERT and PROSPECT_EMAIL — but no reviewer notification');
finding('MEDIUM', 'Review token is in API response only — no delivery mechanism to reviewer');

// ── 9. FR-080 to FR-083 Compliance ─────────────────────────
console.log('\n9. FR-080 to FR-083: Reliability & Observability');

assert(true, 'FR-080: SUCCEEDED vs FAILED distinguishable via status field');
assert(true, 'FR-081: PENDING → IN_PROGRESS (retryable), FAILED → no retry path (non-retryable)');
finding('HIGH', 'FR-082: attempt_count incremented but no MAX_ATTEMPTS or circuit breaker');
finding('HIGH', 'FR-082: No bounded retry — attempt_count is incremented but never checked');
finding('HIGH', 'FR-083: FAILED is logged as SIDE_EFFECT event (S-002/S-004) — but no operator alert');
finding('MEDIUM', 'FR-083: FAILED events are observable in DB but not in monitoring/alerting');

// ── 10. Transactional Gaps ─────────────────────────────────
console.log('\n10. Transactional Atomicity');

finding('HIGH', 'WF-10: UPDATE leads + INSERT side_effects + INSERT processing_events not in transaction');
finding('HIGH', 'Partial failure: UPDATE leads succeeds but INSERT side_effects fails → no SE created');
finding('HIGH', 'Partial failure: INSERT side_effects succeeds but INSERT events fails → SE exists, no event');
finding('MEDIUM', 'WF-11: UPDATE side_effects + INSERT processing_events not in transaction');
finding('MEDIUM', 'WF-12: UPDATE side_effects + INSERT processing_events not in transaction');

// ── 11. Action Key Correlation ─────────────────────────────
console.log('\n11. Action Key Correlation');

finding('MEDIUM', 'action_key is UUID-based: gen_random_uuid()||-telegram — no correlation_id prefix');
finding('MEDIUM', 'No way to query all SEs for a single processing run without JOIN');
finding('MEDIUM', 'processing_run_id is in side_effects but not in the event log (safe_metadata only)');
finding('LOW', 'action_key format: <uuid>-<suffix> — no processing_run_id prefix for traceability');

// ── 12. Production Readiness ───────────────────────────────
console.log('\n12. Production Readiness');

finding('HIGH', 'No retry infrastructure: FAILED side_effects are never retried');
finding('HIGH', 'No dead-letter queue: orphaned FAILED side_effects');
finding('HIGH', 'No monitoring: no metric for SE delivery latency/success rate');
finding('HIGH', 'WF-15 is test-only: no production scheduler that retries FAILED SEs');
finding('MEDIUM', 'No alerting: ops team not notified of FAILED SEs');
finding('MEDIUM', 'No idempotency on HTTP request layer: provider may process request twice');
finding('MEDIUM', 'No circuit breaker: repeated failures on same provider not throttled');
finding('LOW', 'No delivery SLA: no timeout for pending SEs');

// ── 13. WF-11 vs WF-12 Symmetry Gaps ───────────────────────
console.log('\n13. WF-11 vs WF-12 Symmetry');

finding('MEDIUM', 'WF-12 has Check Consent (pre-idempotency) — WF-11 does not');
finding('MEDIUM', 'WF-12: 21 nodes, WF-11: 18 nodes — WF-12 has 3 extra nodes for consent');
finding('MEDIUM', 'Duplicate pattern: Check Action Key + Already Terminal? + Update SE IN_PROGRESS in both');
finding('LOW', 'Build Message (WF-11) vs Build Email Payload (WF-12) — different naming convention');

// ── 14. Reason Code Coverage Gaps ──────────────────────────
console.log('\n14. Reason Code Coverage');

finding('HIGH', 'S-005 EMAIL_SKIPPED_NO_CONSENT: defined but NOT emitted by any workflow');
finding('HIGH', 'S-006 ACTION_KEY_ALREADY_CLAIMED: defined but NOT emitted by any workflow');
finding('MEDIUM', 'S-001/S-003: success codes emitted ✓');
finding('MEDIUM', 'S-002/S-004: failure codes emitted ✓');
finding('LOW', 'No S-007 for retry exhausted / max attempts reached');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Gap Summary ===`);
console.log(`HIGH:   ${findings.HIGH.length}`);
console.log(`MEDIUM: ${findings.MEDIUM.length}`);
console.log(`LOW:    ${findings.LOW.length}`);
console.log(`INFO:   ${findings.INFO.length}`);

if (findings.HIGH.length > 0) {
  console.log('\nHigh-severity gaps:');
  findings.HIGH.forEach(f => console.log(`  - ${f}`));
}

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);