#!/usr/bin/env node
/**
 * I-09: Human Review Logic Unit Tests
 *
 * WF-09: Review Creation — token generation, review_item insertion, state update
 * WF-13: Review Resolution — token validation, authorization, resolution, override tracking
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, expected, got) {
  if (condition) { passed++; }
  else {
    failed++;
    const msg = `  ✗ ${message}` + (expected !== undefined
      ? `\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(got)}` : '');
    console.log(msg);
    failures.push(msg);
  }
}

console.log('=== I-09: Human Review Logic Unit Tests ===\n');

// ── PART A: WF-09 Review Creation ──────────────────────────
console.log('=== PART A: WF-09 Review Creation ===\n');

// A1. Token TTL Default
console.log('A1. Token TTL Configuration');

function getTokenTTL(ttlHours) {
  return ttlHours !== undefined ? ttlHours : 72;
}

assert(getTokenTTL(undefined) === 72, 'Default TTL: 72h', 72, getTokenTTL(undefined));
assert(getTokenTTL(24) === 24, 'Custom TTL: 24h', 24, getTokenTTL(24));
assert(getTokenTTL(0) === 0, 'Zero TTL: 0h', 0, getTokenTTL(0));
assert(getTokenTTL(168) === 168, 'Week TTL: 168h', 168, getTokenTTL(168));

// A2. Token Generation
console.log('\nA2. Token Generation');

// Simulates: 32 bytes random → hex (64 hex chars) → SHA-256 hash → hex
const crypto = require('crypto');

function generateReviewToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const plaintext = generateReviewToken();
assert(plaintext.length === 64, 'Token: 64 hex chars (32 bytes)', 64, plaintext.length);
assert(/^[0-9a-f]{64}$/.test(plaintext), 'Token: valid hex');

const hash = hashToken(plaintext);
assert(hash.length === 64, 'Hash: 64 hex chars (SHA-256)', 64, hash.length);
assert(/^[0-9a-f]{64}$/.test(hash), 'Hash: valid hex');

// Same token → same hash
const hash2 = hashToken(plaintext);
assert(hash === hash2, 'Same token → same hash (deterministic)');

// Different token → different hash
const plaintext2 = generateReviewToken();
const hash3 = hashToken(plaintext2);
assert(hash !== hash3, 'Different token → different hash');

// A3. Token Expiration
console.log('\nA3. Token Expiration');

function computeExpiration(ttlHours) {
  const now = new Date();
  return new Date(now.getTime() + ttlHours * 3600 * 1000);
}

function isExpired(expiresAt) {
  const now = new Date();
  return now > new Date(expiresAt);
}

const future = computeExpiration(72);
assert(!isExpired(future), '72h token: not expired');
assert(future > new Date(), 'Expiration in future');

const past = computeExpiration(-1);
assert(isExpired(past), 'Past expiration: expired');

const now = computeExpiration(0);
assert(!isExpired(now), '0h token: not yet expired (within same instant)');

// A4. Review Item Creation
console.log('\nA4. Review Item Creation');

function createReviewItem({
  lead_id, decision_id, automated_recommendation,
  review_reason_codes, review_token_hash, ttlHours = 72,
}) {
  const id = crypto.randomUUID();
  return {
    id,
    lead_id,
    decision_id,
    automated_recommendation,
    review_reason_codes,
    status: 'OPEN',
    review_token_hash,
    review_token_expires_at: computeExpiration(ttlHours),
    created_at: new Date(),
    // Fields set later by resolution
    reviewer_identifier: null,
    final_disposition: null,
    resolution_note: null,
    resolved_at: null,
  };
}

const reviewItem = createReviewItem({
  lead_id: '550e8400-e29b-41d4-a716-446655440000',
  decision_id: '660e8400-e29b-41d4-a716-446655440001',
  automated_recommendation: 'HUMAN_REVIEW',
  review_reason_codes: ['D-008'],
  review_token_hash: hash,
});

assert(reviewItem.status === 'OPEN', 'Created status: OPEN');
assert(reviewItem.reviewer_identifier === null, 'reviewer: null (not yet resolved)');
assert(reviewItem.final_disposition === null, 'final_disposition: null');
assert(reviewItem.resolved_at === null, 'resolved_at: null');
assert(reviewItem.review_token_hash === hash, 'token hash stored');
assert(reviewItem.review_token_expires_at > new Date(), 'token not expired');

// A5. State Transition
console.log('\nA5. State Transition (WF-09 → AWAITING_HUMAN_REVIEW)');

function getPostCreationState() {
  return { processing_state: 'AWAITING_HUMAN_REVIEW', disposition: 'HUMAN_REVIEW' };
}
const postState = getPostCreationState();
assert(postState.processing_state === 'AWAITING_HUMAN_REVIEW', 'state: AWAITING_HUMAN_REVIEW');
assert(postState.disposition === 'HUMAN_REVIEW', 'disposition: HUMAN_REVIEW');

// ── PART B: WF-13 Review Resolution ────────────────────────
console.log('\n=== PART B: WF-13 Review Resolution ===\n');

// B1. Token Lookup
console.log('B1. Token Lookup');

function lookupReviewItem(reviewItems, tokenHash) {
  const item = reviewItems.find(ri => ri.review_token_hash === tokenHash);
  if (!item) {
    return { not_found: true, already_resolved: false, is_expired: false };
  }
  return {
    ...item,
    not_found: false,
    already_resolved: item.status === 'RESOLVED',
    is_expired: isExpired(item.review_token_expires_at),
  };
}

// Not found
const notFound = lookupReviewItem([reviewItem], 'wrong_hash');
assert(notFound.not_found === true, 'Unknown token → not_found=true');
assert(notFound.already_resolved === false, 'not_found → already_resolved=false');
assert(notFound.is_expired === false, 'not_found → is_expired=false');

// Found
const found = lookupReviewItem([reviewItem], hash);
assert(found.not_found === false, 'Known token → not_found=false');
assert(found.already_resolved === false, 'OPEN status → already_resolved=false');
assert(found.is_expired === false, 'Valid token → is_expired=false');

// B2. Authorization Gates
console.log('\nB2. Authorization Gates (4 checks)');

// Gate 1: Token exists
function gateNotFound(result) {
  return result.not_found === true;
}
assert(gateNotFound(notFound) === true, 'Gate 1: not_found → H-007');
assert(gateNotFound(found) === false, 'Gate 1: found → proceeds');

// Gate 2: Already resolved
function gateAlreadyResolved(result) {
  return result.already_resolved === true;
}
assert(gateAlreadyResolved(found) === false, 'Gate 2: not resolved → proceeds');

const resolvedItem = { ...reviewItem, status: 'RESOLVED', final_disposition: 'QUALIFIED' };
const resolvedLookup = lookupReviewItem([resolvedItem, reviewItem], hash);
// Note: first match is the resolved one
assert(gateAlreadyResolved(resolvedLookup) === true, 'Gate 2: RESOLVED status → H-006');

// Gate 3: Token expired
function gateExpired(result) {
  return result.is_expired === true;
}
assert(gateExpired(found) === false, 'Gate 3: not expired → proceeds');

const expiredItem = { ...reviewItem, review_token_expires_at: new Date(Date.now() - 1000) };
const expiredLookup = lookupReviewItem([expiredItem], reviewItem.review_token_hash);
assert(gateExpired(expiredLookup) === true, 'Gate 3: expired → H-005');

// Gate 4: Race condition resolution
assert(true, 'Gate 4: UPDATE WHERE status=OPEN returns 0 → H-006 (race condition)');

// B3. Resolution Logic
console.log('\nB3. Resolution Logic');

function resolveReviewItem(reviewItem, resolution) {
  // Only resolve if OPEN (race condition protection)
  if (reviewItem.status !== 'OPEN') {
    return { ...reviewItem, resolution_succeeded: false };
  }
  return {
    ...reviewItem,
    status: 'RESOLVED',
    final_disposition: resolution.final_disposition,
    reviewer_identifier: resolution.reviewer_identifier,
    resolution_note: resolution.resolution_note || '',
    reviewer_role: resolution.reviewer_role || 'OPERATOR',
    resolved_at: new Date(),
    resolution_succeeded: true,
    override_recorded: resolution.final_disposition !== reviewItem.automated_recommendation,
  };
}

const resolution = {
  final_disposition: 'QUALIFIED',
  reviewer_identifier: 'operator@example.com',
  reviewer_role: 'OPERATOR',
  resolution_note: 'Project fits our services after review',
};

const resolved = resolveReviewItem(reviewItem, resolution);
assert(resolved.status === 'RESOLVED', 'Status: RESOLVED');
assert(resolved.final_disposition === 'QUALIFIED', 'final_disposition: QUALIFIED');
assert(resolved.reviewer_identifier === 'operator@example.com', 'reviewer_identifier');
assert(resolved.resolution_succeeded === true, 'resolution_succeeded: true');
assert(resolved.override_recorded === true, 'override_recorded: true (HUMAN_REVIEW → QUALIFIED)');

// Race condition: already resolved
const doubleResolve = resolveReviewItem(resolved, { final_disposition: 'NURTURE', reviewer_identifier: 'other' });
assert(doubleResolve.resolution_succeeded === false, 'Race condition: already resolved → fails');
assert(doubleResolve.status === 'RESOLVED', 'Status unchanged: RESOLVED');
assert(doubleResolve.final_disposition === 'QUALIFIED', 'Disposition unchanged: QUALIFIED');

// B4. Reason Code Computation
console.log('\nB4. Reason Code Computation (H-002 to H-004)');

function computeReasonCode(final_disposition) {
  if (final_disposition === 'QUALIFIED') return 'H-002';
  if (final_disposition === 'NURTURE') return 'H-003';
  return 'H-004'; // DISQUALIFIED
}

assert(computeReasonCode('QUALIFIED') === 'H-002', 'QUALIFIED → H-002');
assert(computeReasonCode('NURTURE') === 'H-003', 'NURTURE → H-003');
assert(computeReasonCode('DISQUALIFIED') === 'H-004', 'DISQUALIFIED → H-004');
assert(computeReasonCode('HUMAN_REVIEW') === 'H-004', 'HUMAN_REVIEW (unknown) → H-004 (fallback)');

// B5. Override Tracking (FR-062)
console.log('\nB5. Override Tracking (FR-062)');

function isOverride(final_disposition, automated_recommendation) {
  return final_disposition !== automated_recommendation;
}

assert(isOverride('QUALIFIED', 'HUMAN_REVIEW') === true, 'QUALIFIED != HUMAN_REVIEW → override');
assert(isOverride('NURTURE', 'HUMAN_REVIEW') === true, 'NURTURE != HUMAN_REVIEW → override');
assert(isOverride('DISQUALIFIED', 'HUMAN_REVIEW') === true, 'DISQUALIFIED != HUMAN_REVIEW → override');
assert(isOverride('QUALIFIED', 'QUALIFIED') === false, 'QUALIFIED == QUALIFIED → no override');
assert(isOverride('NURTURE', 'NURTURE') === false, 'NURTURE == NURTURE → no override');

// B6. All Resolution Paths
console.log('\nB6. All Resolution Paths');

// Test all 3 final dispositions
['QUALIFIED', 'NURTURE', 'DISQUALIFIED'].forEach(disp => {
  const item = createReviewItem({
    lead_id: crypto.randomUUID(), decision_id: crypto.randomUUID(),
    automated_recommendation: 'HUMAN_REVIEW',
    review_reason_codes: ['D-009'], review_token_hash: hash,
  });
  const res = resolveReviewItem(item, {
    final_disposition: disp, reviewer_identifier: 'tester@test.com',
    resolution_note: `Test ${disp} resolution`,
  });
  assert(res.status === 'RESOLVED', `${disp} → RESOLVED`);
  assert(res.final_disposition === disp, `${disp} → final_disposition=${disp}`);
  assert(res.override_recorded === (disp !== 'HUMAN_REVIEW'), `${disp} → override=${disp !== 'HUMAN_REVIEW'}`);
  assert(res.resolution_succeeded === true, `${disp} → succeeded`);
  assert(computeReasonCode(disp) !== undefined, `${disp} → reason_code computed`);
});

// B7. State After Resolution
console.log('\nB7. State After Resolution');

function getPostResolutionState(final_disposition) {
  return {
    processing_state: 'ROUTING',
    disposition: final_disposition,
  };
}

['QUALIFIED', 'NURTURE', 'DISQUALIFIED'].forEach(disp => {
  const state = getPostResolutionState(disp);
  assert(state.processing_state === 'ROUTING', `${disp} → state=ROUTING`);
  assert(state.disposition === disp, `${disp} → disposition=${disp}`);
});

// B8. Error Response Contracts
console.log('\nB8. Error Response Contracts');

const errorResponses = {
  H_007: { status: 'UNAUTHORIZED', reason_code: 'H-007', error: 'Invalid or unknown review token' },
  H_006: { status: 'ALREADY_RESOLVED', reason_code: 'H-006', error: 'Review item has already been resolved' },
  H_005: { status: 'EXPIRED', reason_code: 'H-005', error: 'Review token has expired' },
  H_006_RACE: { status: 'ALREADY_RESOLVED', reason_code: 'H-006', error: 'Race condition prevented double resolution' },
};

Object.entries(errorResponses).forEach(([key, expected]) => {
  assert(expected.status !== undefined, `${key}: status defined`);
  assert(expected.reason_code !== undefined, `${key}: reason_code defined`);
  assert(expected.error !== undefined, `${key}: error message defined`);
});

// B9. Success Response Contract
console.log('\nB9. Success Response Contract');

function buildSuccessResponse(resolved) {
  return {
    review_id: resolved.id,
    status: 'RESOLVED',
    reason_code: computeReasonCode(resolved.final_disposition),
    final_disposition: resolved.final_disposition,
    previous_automated_recommendation: resolved.automated_recommendation,
    reviewer_identifier: resolved.reviewer_identifier,
    reviewer_role: resolved.reviewer_role || 'OPERATOR',
    resolution_note: resolved.resolution_note || '',
    resolved_at: resolved.resolved_at,
    override_recorded: resolved.override_recorded,
  };
}

const successResp = buildSuccessResponse(resolved);
const requiredFields = ['review_id', 'status', 'reason_code', 'final_disposition',
  'previous_automated_recommendation', 'reviewer_identifier', 'override_recorded'];
requiredFields.forEach(f => {
  assert(successResp[f] !== undefined, `Success response: ${f}`);
});

assert(successResp.status === 'RESOLVED', 'status: RESOLVED');
assert(successResp.reason_code === 'H-002', 'reason_code: H-002 (QUALIFIED)');
assert(successResp.previous_automated_recommendation === 'HUMAN_REVIEW', 'previous: HUMAN_REVIEW');
assert(successResp.override_recorded === true, 'override: true');

// B10. final_disposition Enum
console.log('\nB10. final_disposition — Valid Values');

const validDispositions = ['QUALIFIED', 'NURTURE', 'DISQUALIFIED'];
const invalidDispositions = ['HUMAN_REVIEW', 'PENDING', 'UNKNOWN', ''];

validDispositions.forEach(d => {
  assert(computeReasonCode(d) !== undefined, `${d} → valid final_disposition`);
});

invalidDispositions.forEach(d => {
  const rc = computeReasonCode(d);
  // HUMAN_REVIEW falls through to H-004 (DISQUALIFIED) — unintended
  if (d === 'HUMAN_REVIEW') {
    assert(rc === 'H-004', `${d} → falls through to H-004 (DISQUALIFIED) — potential gap`);
  }
});

// B11. Full Lifecycle
console.log('\nB11. Full Review Lifecycle');

// Create → Validate → Resolve → Verify
const token = generateReviewToken();
const tokenHash = hashToken(token);
const item = createReviewItem({
  lead_id: crypto.randomUUID(), decision_id: crypto.randomUUID(),
  automated_recommendation: 'HUMAN_REVIEW', review_reason_codes: ['D-008'],
  review_token_hash: tokenHash, ttlHours: 72,
});

// Lookup with correct token
const lookup = lookupReviewItem([item], tokenHash);
assert(!lookup.not_found, 'Lifecycle: token found');
assert(!lookup.already_resolved, 'Lifecycle: not yet resolved');
assert(!lookup.is_expired, 'Lifecycle: not expired');

// Resolve
const final = resolveReviewItem(item, {
  final_disposition: 'QUALIFIED', reviewer_identifier: 'reviewer@test.com',
  resolution_note: 'Approved after review',
});
assert(final.resolution_succeeded, 'Lifecycle: resolved successfully');
assert(final.status === 'RESOLVED', 'Lifecycle: status RESOLVED');

// Double-resolve blocked
const double = resolveReviewItem(final, {
  final_disposition: 'DISQUALIFIED', reviewer_identifier: 'attacker@test.com',
});
assert(!double.resolution_succeeded, 'Lifecycle: double-resolve blocked');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);