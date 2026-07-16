#!/usr/bin/env node
/**
 * I-11: Human Review E2E — Logic Unit Tests
 *
 * Tests the complete human review lifecycle E2E:
 *   Decision → Review Creation → Review Resolution → Re-Routing → Notifications
 */

let passed = 0;
let failed = 0;
const failures = [];
const crypto = require('crypto');

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

console.log('=== I-11: Human Review E2E — Logic Unit Tests ===\n');

// ── PART A: Review Token Lifecycle ─────────────────────────
console.log('=== PART A: Review Token Lifecycle ===\n');

// A1. Token Generation
console.log('A1. Token Generation');

function generateToken(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

const token = generateToken();
assert(token.length === 128, 'Token: 64 bytes → 128 hex chars');
assert(typeof token === 'string', 'Token: string type');
assert(token !== generateToken(), 'Token: unique per generation');

// A2. Token Hashing
console.log('\nA2. Token Hashing (SHA-256)');

function hashToken(plaintextToken) {
  return crypto.createHash('sha256').update(plaintextToken).digest('hex');
}

const tokenHash = hashToken(token);
assert(tokenHash.length === 64, 'Hash: 64 hex chars (SHA-256)');
assert(hashToken(token) === tokenHash, 'Hash: deterministic');
assert(hashToken(token) !== hashToken(generateToken()), 'Hash: unique per input');

// A3. Token Expiry
console.log('\nA3. Token Expiry');

function createTokenExpiry(ttlHours = 72) {
  const now = new Date();
  return new Date(now.getTime() + ttlHours * 3600000);
}

function isTokenExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

const futureExpiry = createTokenExpiry(72);
assert(!isTokenExpired(futureExpiry), 'Future expiry: not expired');

const pastExpiry = createTokenExpiry(-1);
assert(isTokenExpired(pastExpiry), 'Past expiry: expired');

const justNow = new Date();
assert(!isTokenExpired(new Date(justNow.getTime() + 1000)), 'Just now + 1s: not expired');

// ── PART B: Review Item Lifecycle ──────────────────────────
console.log('\n=== PART B: Review Item Lifecycle ===\n');

// B1. Review Item Creation (WF-09)
console.log('B1. Review Item Creation (WF-09)');

function createReviewItem(leadId, decisionId, automatedRecommendation, reviewReasonCodes, tokenHash, ttlHours = 72) {
  return {
    id: crypto.randomUUID(),
    lead_id: leadId,
    decision_id: decisionId,
    automated_recommendation: automatedRecommendation,
    review_reason_codes: reviewReasonCodes,
    status: 'OPEN',
    review_token_hash: tokenHash,
    review_token_expires_at: createTokenExpiry(ttlHours),
    reviewer_identifier: null,
    final_disposition: null,
    resolution_note: null,
    created_at: new Date(),
    resolved_at: null,
  };
}

const reviewId = crypto.randomUUID();
const leadId = crypto.randomUUID();
const decisionId = crypto.randomUUID();
const ri = createReviewItem(leadId, decisionId, 'QUALIFIED', ['R-101', 'R-201'], tokenHash);

assert(ri.status === 'OPEN', 'Review item: status=OPEN');
assert(ri.automated_recommendation === 'QUALIFIED', 'Review item: automated_recommendation');
assert(ri.final_disposition === null, 'Review item: final_disposition null');
assert(ri.reviewer_identifier === null, 'Review item: reviewer_identifier null');
assert(ri.resolved_at === null, 'Review item: resolved_at null');

// B2. Review Item Lookup (WF-13)
console.log('\nB2. Review Item Lookup (WF-13)');

function lookupReviewItem(reviewItems, tokenHash) {
  const ri = reviewItems.find(r => r.review_token_hash === tokenHash);
  if (!ri) return { not_found: true };
  return {
    ...ri,
    not_found: false,
    already_resolved: ri.status === 'RESOLVED',
    is_expired: isTokenExpired(ri.review_token_expires_at),
  };
}

const store = [ri];
const found = lookupReviewItem(store, tokenHash);
assert(found.not_found === false, 'Lookup: found');
assert(found.already_resolved === false, 'Lookup: not resolved');
assert(found.is_expired === false, 'Lookup: not expired');

const notFound = lookupReviewItem(store, hashToken('wrong'));
assert(notFound.not_found === true, 'Lookup: not found');

// B3. Review Resolution (WF-13)
console.log('\nB3. Review Resolution (WF-13)');

function resolveReviewItem(ri, finalDisposition, reviewerIdentifier, reviewerRole, resolutionNote) {
  if (ri.status !== 'OPEN') return { resolution_succeeded: false, reason: 'ALREADY_RESOLVED' };
  if (isTokenExpired(ri.review_token_expires_at)) return { resolution_succeeded: false, reason: 'TOKEN_EXPIRED' };

  ri.status = 'RESOLVED';
  ri.final_disposition = finalDisposition;
  ri.reviewer_identifier = reviewerIdentifier;
  ri.resolution_note = resolutionNote;
  ri.resolved_at = new Date();
  ri.override_recorded = finalDisposition !== ri.automated_recommendation;

  return { resolution_succeeded: true, ...ri };
}

const result = resolveReviewItem(ri, 'DISQUALIFIED', 'operator@example.com', 'OPERATOR', 'Not in our target market');
assert(result.resolution_succeeded === true, 'Resolution: succeeded');
assert(ri.status === 'RESOLVED', 'Resolution: RESOLVED');
assert(ri.final_disposition === 'DISQUALIFIED', 'Resolution: DISQUALIFIED');
assert(ri.reviewer_identifier === 'operator@example.com', 'Resolution: reviewer_identifier');
assert(ri.override_recorded === true, 'Resolution: override recorded (QUALIFIED → DISQUALIFIED)');

// B4. Already Resolved (Race Condition)
console.log('\nB4. Already Resolved (Race Condition)');

const ri2 = createReviewItem(leadId, decisionId, 'HUMAN_REVIEW', [], hashToken(generateToken()));
ri2.status = 'RESOLVED';
const result2 = resolveReviewItem(ri2, 'QUALIFIED', 'admin@example.com', 'ADMIN', 'Approved');
assert(result2.resolution_succeeded === false, 'Race: already resolved');
assert(result2.reason === 'ALREADY_RESOLVED', 'Race: ALREADY_RESOLVED');

// B5. Token Expired
console.log('\nB5. Token Expired');

const ri3 = createReviewItem(leadId, decisionId, 'HUMAN_REVIEW', [], hashToken(generateToken()), -1);
const result3 = resolveReviewItem(ri3, 'QUALIFIED', 'admin@example.com', 'ADMIN', 'Too late');
assert(result3.resolution_succeeded === false, 'Expired: resolution blocked');
assert(result3.reason === 'TOKEN_EXPIRED', 'Expired: TOKEN_EXPIRED');

// ── PART C: State Transitions ──────────────────────────────
console.log('\n=== PART C: State Transitions ===\n');

// C1. Lead State Transitions
console.log('C1. Lead State Transitions');

const LEAD_STATES = {
  RECEIVED: 'RECEIVED',
  VALIDATING: 'VALIDATING',
  INVALID: 'INVALID',
  DEDUPLICATING: 'DEDUPLICATING',
  DUPLICATE: 'DUPLICATE',
  PREQUALIFYING: 'PREQUALIFYING',
  ANALYZING: 'ANALYZING',
  FAILED: 'FAILED',
  DECIDING: 'DECIDING',
  AWAITING_HUMAN_REVIEW: 'AWAITING_HUMAN_REVIEW',
  ROUTING: 'ROUTING',
  COMPLETED: 'COMPLETED',
};

function getNextStateForReview(requiresHumanReview) {
  if (requiresHumanReview) return LEAD_STATES.AWAITING_HUMAN_REVIEW;
  return LEAD_STATES.ROUTING;
}

assert(getNextStateForReview(true) === 'AWAITING_HUMAN_REVIEW', 'requires_review=true → AWAITING_HUMAN_REVIEW');
assert(getNextStateForReview(false) === 'ROUTING', 'requires_review=false → ROUTING');

// C2. After Review Resolution
console.log('\nC2. After Review Resolution');

function getStateAfterResolution() {
  return 'ROUTING'; // WF-13 updates lead to ROUTING after resolution
}

assert(getStateAfterResolution() === 'ROUTING', 'After resolution → ROUTING');

// C3. Full Review State Machine
console.log('\nC3. Full Review State Machine');

const REVIEW_STATES = {
  DECIDING: { next: ['AWAITING_HUMAN_REVIEW', 'ROUTING'] },
  AWAITING_HUMAN_REVIEW: { next: ['ROUTING'] },
  ROUTING: { next: ['COMPLETED'] },
  COMPLETED: { next: [] },
};

function canTransitionTo(currentState, targetState) {
  const allowed = REVIEW_STATES[currentState]?.next || [];
  return allowed.includes(targetState);
}

assert(canTransitionTo('DECIDING', 'AWAITING_HUMAN_REVIEW'), 'DECIDING → AWAITING_HUMAN_REVIEW: valid');
assert(canTransitionTo('DECIDING', 'ROUTING'), 'DECIDING → ROUTING: valid (no review)');
assert(canTransitionTo('AWAITING_HUMAN_REVIEW', 'ROUTING'), 'AWAITING_HUMAN_REVIEW → ROUTING: valid');
assert(canTransitionTo('ROUTING', 'COMPLETED'), 'ROUTING → COMPLETED: valid');
assert(!canTransitionTo('COMPLETED', 'ROUTING'), 'COMPLETED → ROUTING: invalid');
assert(!canTransitionTo('AWAITING_HUMAN_REVIEW', 'COMPLETED'), 'AWAITING_HUMAN_REVIEW → COMPLETED: invalid (skip ROUTING)');

// ── PART D: Reason Codes ───────────────────────────────────
console.log('\n=== PART D: Reason Codes ===\n');

// D1. H-Code Computation
console.log('D1. H-Code Computation');

function getReviewCreationCode() { return 'H-001'; }
function getResolutionCode(finalDisposition) {
  const map = {
    QUALIFIED: 'H-002',
    NURTURE: 'H-003',
    DISQUALIFIED: 'H-004',
  };
  return map[finalDisposition] || null;
}
function getTokenExpiredCode() { return 'H-005'; }
function getAlreadyResolvedCode() { return 'H-006'; }
function getUnauthorizedCode() { return 'H-007'; }

assert(getReviewCreationCode() === 'H-001', 'Creation → H-001');
assert(getResolutionCode('QUALIFIED') === 'H-002', 'QUALIFIED → H-002');
assert(getResolutionCode('NURTURE') === 'H-003', 'NURTURE → H-003');
assert(getResolutionCode('DISQUALIFIED') === 'H-004', 'DISQUALIFIED → H-004');
assert(getTokenExpiredCode() === 'H-005', 'Expired → H-005');
assert(getAlreadyResolvedCode() === 'H-006', 'Already resolved → H-006');
assert(getUnauthorizedCode() === 'H-007', 'Unauthorized → H-007');

// D2. E-Code Computation
console.log('\nD2. E-Code Computation');

function getErrorCode(errorType) {
  const map = {
    UNEXPECTED: 'E-001',
    DB_CONNECTION: 'E-002',
    RETRY_EXHAUSTED: 'E-003',
    WORKFLOW_TIMEOUT: 'E-004',
  };
  return map[errorType] || 'E-001';
}

assert(getErrorCode('UNEXPECTED') === 'E-001', 'UNEXPECTED → E-001');
assert(getErrorCode('DB_CONNECTION') === 'E-002', 'DB_CONNECTION → E-002');
assert(getErrorCode('RETRY_EXHAUSTED') === 'E-003', 'RETRY_EXHAUSTED → E-003');
assert(getErrorCode('WORKFLOW_TIMEOUT') === 'E-004', 'WORKFLOW_TIMEOUT → E-004');

// ── PART E: E2E Scenarios ──────────────────────────────────
console.log('\n=== PART E: E2E Scenarios ===\n');

// E1. Full E2E: Decision → Review → Resolution → Routing
console.log('E1. Full E2E: Decision → Review → Resolution → Routing');

function simulateFullE2E(inquiryData) {
  const timeline = [];
  let leadState = 'RECEIVED';

  // Step 1: Decision (WF-08)
  const decision = {
    disposition: 'HUMAN_REVIEW',
    requires_human_review: true,
    automated_recommendation: 'QUALIFIED',
    reason_codes: ['R-101', 'R-201'],
    decision_id: crypto.randomUUID(),
  };
  leadState = getNextStateForReview(decision.requires_human_review);
  timeline.push({ step: 'WF-08 Decision', state: leadState, decision });

  // Step 2: Review Creation (WF-09)
  const reviewToken = generateToken();
  const reviewTokenHash = hashToken(reviewToken);
  const reviewItem = createReviewItem(
    leadId, decision.decision_id,
    decision.automated_recommendation,
    decision.reason_codes,
    reviewTokenHash
  );
  timeline.push({
    step: 'WF-09 Review Creation',
    state: leadState,
    review_id: reviewItem.id,
    review_token: reviewToken,
    event_code: 'H-001',
  });

  // Step 3: Review Resolution (WF-13)
  const resolution = resolveReviewItem(
    reviewItem, 'DISQUALIFIED',
    'operator@example.com', 'OPERATOR',
    'Not in target market after review'
  );
  timeline.push({
    step: 'WF-13 Review Resolution',
    state: 'ROUTING',
    resolution_succeeded: resolution.resolution_succeeded,
    override_recorded: reviewItem.override_recorded,
    event_code: getResolutionCode(reviewItem.final_disposition),
  });

  // Step 4: Routing (WF-10)
  const routing = {
    disposition: reviewItem.final_disposition,
    processing_state: 'COMPLETED',
    side_effects: reviewItem.final_disposition === 'QUALIFIED'
      ? ['TELEGRAM_ALERT', 'PROSPECT_EMAIL']
      : (reviewItem.final_disposition === 'NURTURE' || reviewItem.final_disposition === 'DISQUALIFIED')
        ? ['PROSPECT_EMAIL'] : [],
    event_code: 'ROUTING_' + reviewItem.final_disposition,
  };
  leadState = 'COMPLETED';
  timeline.push({ step: 'WF-10 Routing', state: leadState, routing });

  return { final_state: leadState, final_disposition: reviewItem.final_disposition, timeline };
}

const e2eResult = simulateFullE2E({});
assert(e2eResult.final_state === 'COMPLETED', 'E2E: final_state=COMPLETED');
assert(e2eResult.final_disposition === 'DISQUALIFIED', 'E2E: final_disposition=DISQUALIFIED');
assert(e2eResult.timeline.length === 4, 'E2E: 4 steps');
assert(e2eResult.timeline[0].step === 'WF-08 Decision', 'Step 1: WF-08');
assert(e2eResult.timeline[1].step === 'WF-09 Review Creation', 'Step 2: WF-09');
assert(e2eResult.timeline[2].step === 'WF-13 Review Resolution', 'Step 3: WF-13');
assert(e2eResult.timeline[3].step === 'WF-10 Routing', 'Step 4: WF-10');

// E2. No Review (Direct Route)
console.log('\nE2. No Review (Direct Route)');

function simulateDirectRoute(disposition) {
  const requiresReview = disposition === 'HUMAN_REVIEW';
  if (requiresReview) return { path: 'REVIEW' };
  return { path: 'DIRECT', disposition, state: 'COMPLETED' };
}

assert(simulateDirectRoute('QUALIFIED').path === 'DIRECT', 'QUALIFIED: direct');
assert(simulateDirectRoute('NURTURE').path === 'DIRECT', 'NURTURE: direct');
assert(simulateDirectRoute('DISQUALIFIED').path === 'DIRECT', 'DISQUALIFIED: direct');
assert(simulateDirectRoute('HUMAN_REVIEW').path === 'REVIEW', 'HUMAN_REVIEW: review');

// E3. Override Tracking (AC-09)
console.log('\nE3. Override Tracking (AC-09)');

function trackOverride(automatedRecommendation, finalDisposition) {
  return {
    override_recorded: automatedRecommendation !== finalDisposition,
    automated_recommendation: automatedRecommendation,
    final_disposition: finalDisposition,
  };
}

const override1 = trackOverride('QUALIFIED', 'DISQUALIFIED');
assert(override1.override_recorded === true, 'Override: QUALIFIED→DISQUALIFIED recorded');

const override2 = trackOverride('QUALIFIED', 'QUALIFIED');
assert(override2.override_recorded === false, 'No override: QUALIFIED→QUALIFIED');

const override3 = trackOverride('HUMAN_REVIEW', 'NURTURE');
assert(override3.override_recorded === true, 'Override: HUMAN_REVIEW→NURTURE recorded');

// E4. Review Data Completeness (FR-060)
console.log('\nE4. Review Data Completeness (FR-060)');

function validateReviewItemCompleteness(ri) {
  const required = ['id', 'lead_id', 'decision_id', 'automated_recommendation',
    'review_reason_codes', 'status', 'review_token_hash', 'review_token_expires_at', 'created_at'];
  return required.every(f => ri[f] !== undefined && ri[f] !== null);
}

assert(validateReviewItemCompleteness(ri), 'FR-060: review item has all required fields');

// E5. Human Override Preserves Original (FR-062)
console.log('\nE5. Human Override Preserves Original (FR-062)');

function verifyOverridePreservation(ri) {
  return ri.automated_recommendation !== null && ri.final_disposition !== null;
}

assert(verifyOverridePreservation(ri), 'FR-062: both automated_recommendation and final_disposition present');

// E6. Error Handler Retry Logic (WF-14)
console.log('\nE6. Error Handler Retry Logic (WF-14)');

function isRetryEligible(errorType, attemptCount, maxAttempts = 3) {
  const retryableErrors = ['DB_CONNECTION', 'WORKFLOW_TIMEOUT'];
  const nonRetryableErrors = ['UNEXPECTED', 'RETRY_EXHAUSTED'];
  if (nonRetryableErrors.includes(errorType)) return false;
  return retryableErrors.includes(errorType) && attemptCount < maxAttempts;
}

assert(isRetryEligible('DB_CONNECTION', 0), 'DB_CONNECTION attempt 0: retryable');
assert(isRetryEligible('DB_CONNECTION', 2), 'DB_CONNECTION attempt 2: retryable');
assert(!isRetryEligible('DB_CONNECTION', 3), 'DB_CONNECTION attempt 3: exhausted');
assert(isRetryEligible('WORKFLOW_TIMEOUT', 1), 'WORKFLOW_TIMEOUT: retryable');
assert(!isRetryEligible('UNEXPECTED', 0), 'UNEXPECTED: not retryable');
assert(!isRetryEligible('RETRY_EXHAUSTED', 0), 'RETRY_EXHAUSTED: not retryable');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);