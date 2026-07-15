#!/usr/bin/env node
/**
 * I-05: Idempotency Logic Unit Tests
 *
 * Tests the 4 core idempotency scenarios without requiring a live n8n/Postgres:
 *   Scenario 1: SAME-SOURCE — same source_system + source_submission_id → BLOCK (I-002)
 *   Scenario 2: SAME-FINGERPRINT-DIFFERENT-LEAD — same payload, different source → BLOCK (I-003)
 *   Scenario 3: SELF-REPLAY — same lead_id, same fingerprint → REPLAY_RECORD (I-004)
 *   Scenario 4: NEW-SUBMISSION — no match → PROCEED (I-001)
 *
 * Also tests edge cases:
 *   - NULL source_submission_id (should skip source identity check)
 *   - Concurrent submissions with same source identity
 *   - Replay idempotency (no side effects repeated)
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message} (expected: ${expected}, got: ${actual})`);
  }
}

console.log('=== I-05: Idempotency Logic Tests ===\n');

// ── Idempotency Decision Logic (mirrors WF-05) ─────────────
// These functions implement the same logic as WF-05 for testing.

/**
 * Determine the idempotency result for a submission.
 * Mirrors the WF-05 decision tree.
 */
function checkIdempotency({
  leadId,
  sourceSystem,
  sourceSubmissionId,
  payloadFingerprint,
  existingLeads = [], // [{ id, source_system, source_submission_id, payload_fingerprint }]
}) {
  // Step 1: Check source identity uniqueness (exclude self)
  if (sourceSubmissionId) {
    const sourceMatch = existingLeads.find(
      l => l.source_system === sourceSystem &&
           l.source_submission_id === sourceSubmissionId &&
           l.id !== leadId
    );
    if (sourceMatch) {
      return {
        is_duplicate: true,
        reason_code: 'I-002',
        reason_code_label: 'EXACT_DUPLICATE',
        action: 'BLOCK',
        existing_lead_id: sourceMatch.id,
      };
    }
  }

  // Step 2: Check payload fingerprint (include self — self-replay detection)
  const fpMatch = existingLeads.find(
    l => l.payload_fingerprint === payloadFingerprint
  );
  if (fpMatch) {
    // Self-replay? (same lead_id)
    if (fpMatch.id === leadId) {
      return {
        is_duplicate: true,
        reason_code: 'I-004',
        reason_code_label: 'SELF_REPLAY',
        action: 'REPLAY_RECORD',
        existing_lead_id: leadId,
      };
    }
    // Different lead, same fingerprint
    return {
      is_duplicate: true,
      reason_code: 'I-003',
      reason_code_label: 'FINGERPRINT_MATCH',
      action: 'BLOCK',
      existing_lead_id: fpMatch.id,
    };
  }

  // Step 3: New submission
  return {
    is_duplicate: false,
    reason_code: 'I-001',
    action: 'PROCEED',
  };
}

/**
 * Validate that a replay does not repeat side effects.
 * In WF-05, the side effect is the state transition UPDATE leads + INSERT event.
 * Replays should return the existing result without executing new state transitions.
 */
function simulateReplay(originalResult, replayAttempt) {
  // A replay should return the same result as the original
  // The key invariant: state transitions are NOT re-executed for replays
  return {
    ...originalResult,
    replay_detected: true,
    // No new state transitions, no new events
    side_effects_prevented: replayAttempt.is_duplicate === true,
  };
}

// ── Scenario 1: Exact Duplicate (Same Source Identity) ─────
console.log('1. Scenario: Exact Duplicate (I-002, BLOCK)');

const existingLeads = [
  {
    id: 'lead-001',
    source_system: 'web-form',
    source_submission_id: 'sub-12345',
    payload_fingerprint: 'fp-abc',
  },
  {
    id: 'lead-002',
    source_system: 'api',
    source_submission_id: 'sub-67890',
    payload_fingerprint: 'fp-xyz',
  },
];

const result1 = checkIdempotency({
  leadId: 'lead-003',
  sourceSystem: 'web-form',
  sourceSubmissionId: 'sub-12345',
  payloadFingerprint: 'fp-new',
  existingLeads,
});

assertEqual(result1.is_duplicate, true, 'is_duplicate is true');
assertEqual(result1.reason_code, 'I-002', 'reason_code is I-002');
assertEqual(result1.action, 'BLOCK', 'action is BLOCK');
assertEqual(result1.reason_code_label, 'EXACT_DUPLICATE', 'label is EXACT_DUPLICATE');
assertEqual(result1.existing_lead_id, 'lead-001', 'existing_lead_id references correct lead');

// ── Scenario 2: Fingerprint Match (Different Lead) ─────────
console.log('\n2. Scenario: Fingerprint Match (I-003, BLOCK)');

const result2 = checkIdempotency({
  leadId: 'lead-004',
  sourceSystem: 'new-form',
  sourceSubmissionId: 'sub-99999',
  payloadFingerprint: 'fp-abc',
  existingLeads,
});

assertEqual(result2.is_duplicate, true, 'is_duplicate is true');
assertEqual(result2.reason_code, 'I-003', 'reason_code is I-003');
assertEqual(result2.action, 'BLOCK', 'action is BLOCK');
assertEqual(result2.reason_code_label, 'FINGERPRINT_MATCH', 'label is FINGERPRINT_MATCH');
assertEqual(result2.existing_lead_id, 'lead-001', 'existing_lead_id references correct lead');

// ── Scenario 3: Self-Replay (Same Lead ID) ─────────────────
console.log('\n3. Scenario: Self-Replay (I-004, REPLAY_RECORD)');

const result3 = checkIdempotency({
  leadId: 'lead-001',
  sourceSystem: 'web-form',
  sourceSubmissionId: 'sub-12345',
  payloadFingerprint: 'fp-abc',
  existingLeads,
});

assertEqual(result3.is_duplicate, true, 'is_duplicate is true');
assertEqual(result3.reason_code, 'I-004', 'reason_code is I-004');
assertEqual(result3.action, 'REPLAY_RECORD', 'action is REPLAY_RECORD');
assertEqual(result3.reason_code_label, 'SELF_REPLAY', 'label is SELF_REPLAY');

// Self-replay should NOT execute side effects again
const replayResult = simulateReplay(result3, result3);
assert(replayResult.replay_detected, 'Replay is detected');
assert(replayResult.side_effects_prevented, 'Replay prevents side effects');
assertEqual(replayResult.reason_code, 'I-004', 'Replay preserves reason_code');

// ── Scenario 4: New Submission ─────────────────────────────
console.log('\n4. Scenario: New Submission (I-001, PROCEED)');

const result4 = checkIdempotency({
  leadId: 'lead-005',
  sourceSystem: 'mobile-app',
  sourceSubmissionId: 'sub-55555',
  payloadFingerprint: 'fp-unique',
  existingLeads,
});

assertEqual(result4.is_duplicate, false, 'is_duplicate is false');
assertEqual(result4.reason_code, 'I-001', 'reason_code is I-001');
assertEqual(result4.action, 'PROCEED', 'action is PROCEED');
assert(result4.existing_lead_id === undefined, 'No existing_lead_id for new submission');

// ── Edge Case: NULL source_submission_id ───────────────────
console.log('\n5. Edge Case: NULL source_submission_id');

const result5 = checkIdempotency({
  leadId: 'lead-006',
  sourceSystem: 'web-form',
  sourceSubmissionId: null,
  payloadFingerprint: 'fp-abc',
  existingLeads,
});

// Should skip source identity check, go to fingerprint check
assertEqual(result5.reason_code, 'I-003', 'NULL source_submission_id skips to fingerprint check (I-003)');
assertEqual(result5.action, 'BLOCK', 'Matches fingerprint → BLOCK');

// NULL source_submission_id, unique fingerprint → new
const result5b = checkIdempotency({
  leadId: 'lead-006',
  sourceSystem: 'web-form',
  sourceSubmissionId: null,
  payloadFingerprint: 'fp-brand-new',
  existingLeads,
});
assertEqual(result5b.reason_code, 'I-001', 'NULL source_submission_id + unique fp → PROCEED');

// ── Edge Case: No existing leads ───────────────────────────
console.log('\n6. Edge Case: Empty database (no existing leads)');

const result6 = checkIdempotency({
  leadId: 'lead-007',
  sourceSystem: 'web-form',
  sourceSubmissionId: 'sub-first',
  payloadFingerprint: 'fp-first',
  existingLeads: [],
});

assertEqual(result6.is_duplicate, false, 'First lead is not duplicate');
assertEqual(result6.reason_code, 'I-001', 'First lead gets I-001');
assertEqual(result6.action, 'PROCEED', 'First lead proceeds');

// ── Concurrent Submission Simulation ───────────────────────
console.log('\n7. Concurrent Submission Simulation');

/**
 * Simulate concurrent submissions with the same source identity.
 * In a real system, the UNIQUE INDEX on (source_system, source_submission_id)
 * ensures only one succeeds. The second gets a constraint violation.
 */
function simulateConcurrentSubmissions(submissions) {
  const results = [];
  const seen = new Set();

  submissions.forEach(sub => {
    const key = `${sub.sourceSystem}|${sub.sourceSubmissionId}`;
    if (seen.has(key)) {
      results.push({
        ...sub,
        success: false,
        error: 'UNIQUE_CONSTRAINT_VIOLATION',
        reason_code: 'I-002',
        action: 'BLOCK',
      });
    } else {
      seen.add(key);
      results.push({
        ...sub,
        success: true,
        reason_code: 'I-001',
        action: 'PROCEED',
      });
    }
  });

  return results;
}

const concurrent = simulateConcurrentSubmissions([
  { leadId: 'lead-A', sourceSystem: 'form', sourceSubmissionId: 'concurrent-1', payloadFingerprint: 'fp-A' },
  { leadId: 'lead-B', sourceSystem: 'form', sourceSubmissionId: 'concurrent-1', payloadFingerprint: 'fp-B' },
  { leadId: 'lead-C', sourceSystem: 'form', sourceSubmissionId: 'concurrent-2', payloadFingerprint: 'fp-C' },
]);

assertEqual(concurrent.length, 3, '3 submissions processed');
assert(concurrent[0].success, 'First submission succeeds');
assert(!concurrent[1].success, 'Second submission fails (duplicate)');
assert(concurrent[2].success, 'Third submission succeeds (different source)');
assertEqual(concurrent[1].reason_code, 'I-002', 'Duplicate gets I-002');
assertEqual(concurrent[1].action, 'BLOCK', 'Duplicate is BLOCKED');

// ── Replay Idempotency (no side effects repeated) ──────────
console.log('\n8. Replay Idempotency (no repeated side effects)');

const sideEffectCounts = { events: 0, stateUpdates: 0 };

function recordSideEffect(type) {
  sideEffectCounts[type]++;
}

function processSubmission(idempotencyResult) {
  if (idempotencyResult.action === 'PROCEED') {
    recordSideEffect('stateUpdates');
    recordSideEffect('events');
  } else if (idempotencyResult.action === 'BLOCK') {
    // Block: record that we blocked, but no state transition to DUPLICATE here
    // (state transition is handled separately in WF-05)
  }
  // REPLAY_RECORD: no side effects at all
}

// Process new submission → side effects
processSubmission(result4);
assertEqual(sideEffectCounts.stateUpdates, 1, 'New submission creates 1 state update');
assertEqual(sideEffectCounts.events, 1, 'New submission creates 1 event');

// Replay → no side effects
processSubmission(result3);
assertEqual(sideEffectCounts.stateUpdates, 1, 'Replay does NOT create new state update');
assertEqual(sideEffectCounts.events, 1, 'Replay does NOT create new event');

// Block → no new processing side effects
processSubmission(result1);
assertEqual(sideEffectCounts.stateUpdates, 1, 'Block does NOT create new state update');
assertEqual(sideEffectCounts.events, 1, 'Block does NOT create new event');

// ── Reason Code Contract ───────────────────────────────────
console.log('\n9. Reason Code Contract');

const validReasonCodes = ['I-001', 'I-002', 'I-003', 'I-004'];
const allResults = [result1, result2, result3, result4, result5, result5b, result6];

allResults.forEach(r => {
  assert(validReasonCodes.includes(r.reason_code),
    `Reason code ${r.reason_code} is valid`);
});

assert(validReasonCodes.every(rc => /^I-\d{3}$/.test(rc)),
  'All reason codes match pattern I-XXX');

// ── Action Enum Contract ───────────────────────────────────
console.log('\n10. Action Enum Contract');

const validActions = ['PROCEED', 'BLOCK', 'REPLAY_RECORD'];

allResults.forEach(r => {
  assert(validActions.includes(r.action),
    `Action ${r.action} is valid`);
});

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);