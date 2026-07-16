#!/usr/bin/env node
/**
 * I-10: Routing & Notification Logic Unit Tests
 *
 * WF-10: Disposition-based routing with consent gating
 * WF-11: Telegram delivery idempotency + retry
 * WF-12: Email delivery consent + idempotency + retry
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

console.log('=== I-10: Routing & Notification Logic Unit Tests ===\n');

// ── PART A: WF-10 Routing Logic ────────────────────────────
console.log('=== PART A: WF-10 Routing Logic ===\n');

// A1. Disposition Router
console.log('A1. Disposition Router');

function routeByDisposition(disposition) {
  const routes = {
    QUALIFIED: 0,
    NURTURE: 1,
    DISQUALIFIED: 2,
    HUMAN_REVIEW: 3,
  };
  return routes[disposition] !== undefined ? routes[disposition] : 4;
}

assert(routeByDisposition('QUALIFIED') === 0, 'QUALIFIED → output 0');
assert(routeByDisposition('NURTURE') === 1, 'NURTURE → output 1');
assert(routeByDisposition('DISQUALIFIED') === 2, 'DISQUALIFIED → output 2');
assert(routeByDisposition('HUMAN_REVIEW') === 3, 'HUMAN_REVIEW → output 3');
assert(routeByDisposition('UNKNOWN') === 4, 'UNKNOWN → fallback (4)');
assert(routeByDisposition('') === 4, 'empty → fallback');

// A2. Side Effect Routing Matrix
console.log('\nA2. Side Effect Routing Matrix');

function getSideEffects(disposition, consentToContact) {
  const effects = [];
  if (disposition === 'QUALIFIED') {
    effects.push('TELEGRAM_ALERT', 'PROSPECT_EMAIL');
  } else if (disposition === 'NURTURE' && consentToContact) {
    effects.push('PROSPECT_EMAIL');
  } else if (disposition === 'DISQUALIFIED' && consentToContact) {
    effects.push('PROSPECT_EMAIL');
  }
  // HUMAN_REVIEW: no side effects
  return effects;
}

assert(getSideEffects('QUALIFIED', true).length === 2, 'QUALIFIED: 2 side effects');
assert(getSideEffects('QUALIFIED', true).includes('TELEGRAM_ALERT'), 'QUALIFIED: TELEGRAM_ALERT');
assert(getSideEffects('QUALIFIED', true).includes('PROSPECT_EMAIL'), 'QUALIFIED: PROSPECT_EMAIL');
assert(getSideEffects('QUALIFIED', false).length === 2, 'QUALIFIED: consent does not affect Telegram');

assert(getSideEffects('NURTURE', true).length === 1, 'NURTURE+consent: 1 SE');
assert(getSideEffects('NURTURE', true).includes('PROSPECT_EMAIL'), 'NURTURE+consent: PROSPECT_EMAIL');
assert(getSideEffects('NURTURE', false).length === 0, 'NURTURE no consent: 0 SE');
assert(!getSideEffects('NURTURE', false).includes('TELEGRAM_ALERT'), 'NURTURE: no TELEGRAM_ALERT');

assert(getSideEffects('DISQUALIFIED', true).length === 1, 'DISQUALIFIED+consent: 1 SE');
assert(getSideEffects('DISQUALIFIED', false).length === 0, 'DISQUALIFIED no consent: 0 SE');

assert(getSideEffects('HUMAN_REVIEW', true).length === 0, 'HUMAN_REVIEW: 0 SE');
assert(getSideEffects('HUMAN_REVIEW', false).length === 0, 'HUMAN_REVIEW: 0 SE');

// A3. Blocked Actions (FR-072)
console.log('\nA3. Blocked Actions (FR-072: no qualified notification for non-qualified)');

function getBlockedActions(disposition) {
  if (disposition === 'HUMAN_REVIEW') return ['TELEGRAM_ALERT', 'PROSPECT_EMAIL'];
  return [];
}

assert(getBlockedActions('QUALIFIED').length === 0, 'QUALIFIED: no blocked actions');
assert(getBlockedActions('HUMAN_REVIEW').includes('TELEGRAM_ALERT'), 'HUMAN_REVIEW: blocks TELEGRAM_ALERT');
assert(getBlockedActions('HUMAN_REVIEW').includes('PROSPECT_EMAIL'), 'HUMAN_REVIEW: blocks PROSPECT_EMAIL');

// A4. State After Routing
console.log('\nA4. State After Routing');

function getRoutingState(disposition) {
  const states = {
    QUALIFIED: { processing_state: 'ROUTING', disposition },
    NURTURE: { processing_state: 'ROUTING', disposition },
    DISQUALIFIED: { processing_state: 'COMPLETED', disposition },
    HUMAN_REVIEW: { processing_state: 'AWAITING_HUMAN_REVIEW', disposition },
  };
  return states[disposition] || null;
}

assert(getRoutingState('QUALIFIED').processing_state === 'ROUTING', 'QUALIFIED: ROUTING');
assert(getRoutingState('NURTURE').processing_state === 'ROUTING', 'NURTURE: ROUTING');
assert(getRoutingState('DISQUALIFIED').processing_state === 'COMPLETED', 'DISQUALIFIED: COMPLETED');
assert(getRoutingState('HUMAN_REVIEW').processing_state === 'AWAITING_HUMAN_REVIEW', 'HUMAN_REVIEW: AWAITING_HUMAN_REVIEW');

// A5. Routing Event Reason Codes
console.log('\nA5. Routing Event Reason Codes');

function getRoutingEventCode(disposition) {
  const codes = {
    QUALIFIED: 'ROUTING_QUALIFIED',
    NURTURE: 'ROUTING_NURTURE',
    DISQUALIFIED: 'ROUTING_DISQUALIFIED',
    HUMAN_REVIEW: 'ROUTING_AWAITING_HUMAN_REVIEW',
  };
  return codes[disposition] || null;
}

assert(getRoutingEventCode('QUALIFIED') === 'ROUTING_QUALIFIED', 'QUALIFIED → ROUTING_QUALIFIED');
assert(getRoutingEventCode('NURTURE') === 'ROUTING_NURTURE', 'NURTURE → ROUTING_NURTURE');
assert(getRoutingEventCode('DISQUALIFIED') === 'ROUTING_DISQUALIFIED', 'DISQUALIFIED → ROUTING_DISQUALIFIED');
assert(getRoutingEventCode('HUMAN_REVIEW') === 'ROUTING_AWAITING_HUMAN_REVIEW', 'HUMAN_REVIEW → ROUTING_AWAITING_HUMAN_REVIEW');

// A6. Consent Gating (FR-073)
console.log('\nA6. Consent Gating (FR-073)');

function shouldSendProspectEmail(disposition, consentToContact) {
  if (disposition === 'QUALIFIED') return true; // always for QUALIFIED
  if (disposition === 'HUMAN_REVIEW') return false; // never for HUMAN_REVIEW
  return consentToContact === true; // NURTURE/DISQUALIFIED: gated
}

assert(shouldSendProspectEmail('QUALIFIED', false) === true, 'QUALIFIED: always sends email');
assert(shouldSendProspectEmail('NURTURE', true) === true, 'NURTURE+consent: sends');
assert(shouldSendProspectEmail('NURTURE', false) === false, 'NURTURE no consent: blocked');
assert(shouldSendProspectEmail('DISQUALIFIED', true) === true, 'DISQUALIFIED+consent: sends');
assert(shouldSendProspectEmail('DISQUALIFIED', false) === false, 'DISQUALIFIED no consent: blocked');
assert(shouldSendProspectEmail('HUMAN_REVIEW', true) === false, 'HUMAN_REVIEW: blocked');

// A7. Action Key Generation
console.log('\nA7. Action Key Generation');

const crypto = require('crypto');

function createActionKey(suffix) {
  return crypto.randomUUID() + '-' + suffix;
}

const telegramKey = createActionKey('telegram');
const emailKey = createActionKey('email');
assert(telegramKey.endsWith('-telegram'), 'Action key: -telegram suffix');
assert(emailKey.endsWith('-email'), 'Action key: -email suffix');
assert(telegramKey.length > 36, 'Action key: longer than UUID');
assert(telegramKey !== emailKey, 'Action keys: unique per action');

// ── PART B: WF-11/WF-12 Side Effect Idempotency ────────────
console.log('\n=== PART B: Side Effect Idempotency ===\n');

// B1. Side Effect State Machine
console.log('B1. Side Effect State Machine');

const SE_VALID_TRANSITIONS = {
  'PENDING': ['IN_PROGRESS'],
  'RETRY_PENDING': ['IN_PROGRESS'],
  'IN_PROGRESS': ['SUCCEEDED', 'FAILED', 'RETRY_PENDING'],
  'SUCCEEDED': [],
  'FAILED': ['RETRY_PENDING'],
  'SKIPPED': [],
};

function isTerminal(status) {
  return ['SUCCEEDED', 'FAILED', 'SKIPPED'].includes(status);
}

function isRetryable(status) {
  return ['PENDING', 'RETRY_PENDING'].includes(status);
}

function canTransition(from, to) {
  const allowed = SE_VALID_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

assert(isTerminal('SUCCEEDED'), 'SUCCEEDED: terminal');
assert(isTerminal('FAILED'), 'FAILED: terminal');
assert(isTerminal('SKIPPED'), 'SKIPPED: terminal');
assert(!isTerminal('PENDING'), 'PENDING: not terminal');
assert(!isTerminal('IN_PROGRESS'), 'IN_PROGRESS: not terminal');

assert(isRetryable('PENDING'), 'PENDING: retryable');
assert(isRetryable('RETRY_PENDING'), 'RETRY_PENDING: retryable');
assert(!isRetryable('IN_PROGRESS'), 'IN_PROGRESS: not retryable');
assert(!isRetryable('SUCCEEDED'), 'SUCCEEDED: not retryable');
assert(!isRetryable('FAILED'), 'FAILED: not retryable');

assert(canTransition('PENDING', 'IN_PROGRESS'), 'PENDING → IN_PROGRESS: valid');
assert(canTransition('IN_PROGRESS', 'SUCCEEDED'), 'IN_PROGRESS → SUCCEEDED: valid');
assert(canTransition('IN_PROGRESS', 'FAILED'), 'IN_PROGRESS → FAILED: valid');
assert(!canTransition('SUCCEEDED', 'PENDING'), 'SUCCEEDED → PENDING: invalid');
assert(!canTransition('IN_PROGRESS', 'IN_PROGRESS'), 'IN_PROGRESS → IN_PROGRESS: invalid (no-op)');
assert(!canTransition('PENDING', 'SUCCEEDED'), 'PENDING → SUCCEEDED: invalid (skip IN_PROGRESS)');

// B2. Already Claimed Detection
console.log('\nB2. Already Claimed Detection');

function isAlreadyClaimed(status) {
  return isTerminal(status) || status === 'IN_PROGRESS';
}

assert(isAlreadyClaimed('SUCCEEDED'), 'SUCCEEDED: already claimed');
assert(isAlreadyClaimed('FAILED'), 'FAILED: already claimed');
assert(isAlreadyClaimed('IN_PROGRESS'), 'IN_PROGRESS: already claimed');
assert(!isAlreadyClaimed('PENDING'), 'PENDING: not claimed');
assert(!isAlreadyClaimed('RETRY_PENDING'), 'RETRY_PENDING: not claimed');

// B3. Attempt Counter
console.log('\nB3. Attempt Counter');

function incrementAttempt(currentAttempt) {
  return currentAttempt + 1;
}

assert(incrementAttempt(0) === 1, 'Attempt 0 → 1');
assert(incrementAttempt(1) === 2, 'Attempt 1 → 2');
assert(incrementAttempt(5) === 6, 'Attempt 5 → 6');

// B4. Idempotent Insert (ON CONFLICT DO NOTHING)
console.log('\nB4. Idempotent Insert (ON CONFLICT DO NOTHING)');

function idempotentInsert(sideEffects, actionKey, newSE) {
  const exists = sideEffects.find(se => se.action_key === actionKey);
  if (exists) return exists; // DO NOTHING
  sideEffects.push(newSE);
  return newSE;
}

const seStore = [];
const se1 = idempotentInsert(seStore, telegramKey, {
  action_key: telegramKey, action_type: 'TELEGRAM_ALERT', status: 'PENDING',
});
assert(se1.status === 'PENDING', 'First insert: PENDING');
assert(seStore.length === 1, 'Store: 1 item');

const se2 = idempotentInsert(seStore, telegramKey, {
  action_key: telegramKey, action_type: 'TELEGRAM_ALERT', status: 'PENDING',
});
assert(se2 === se1, 'Duplicate insert: returns existing (DO NOTHING)');
assert(seStore.length === 1, 'Store: still 1 item');

// B5. Different action keys are independent
const emailKey2 = createActionKey('email');
const se3 = idempotentInsert(seStore, emailKey2, {
  action_key: emailKey2, action_type: 'PROSPECT_EMAIL', status: 'PENDING',
});
assert(seStore.length === 2, 'Different action key: new item');
assert(se3.action_key === emailKey2, 'email key inserted');

// ── PART C: Reason Code Computation ────────────────────────
console.log('\n=== PART C: Reason Code Computation ===\n');

// C1. S-Codes for Side Effects
console.log('C1. S-Codes for Side Effects');

function getSuccessCode(actionType) {
  if (actionType === 'TELEGRAM_ALERT') return 'S-001';
  if (actionType === 'PROSPECT_EMAIL') return 'S-003';
  return null;
}

function getFailureCode(actionType) {
  if (actionType === 'TELEGRAM_ALERT') return 'S-002';
  if (actionType === 'PROSPECT_EMAIL') return 'S-004';
  return null;
}

assert(getSuccessCode('TELEGRAM_ALERT') === 'S-001', 'TELEGRAM_ALERT success → S-001');
assert(getSuccessCode('PROSPECT_EMAIL') === 'S-003', 'PROSPECT_EMAIL success → S-003');
assert(getFailureCode('TELEGRAM_ALERT') === 'S-002', 'TELEGRAM_ALERT failure → S-002');
assert(getFailureCode('PROSPECT_EMAIL') === 'S-004', 'PROSPECT_EMAIL failure → S-004');

// C2. No Consent Skip
console.log('\nC2. S-005 EMAIL_SKIPPED_NO_CONSENT');

function getSkipCode() {
  return 'S-005';
}

assert(getSkipCode() === 'S-005', 'Skip → S-005 EMAIL_SKIPPED_NO_CONSENT');

// C3. Already Claimed
console.log('\nC3. S-006 ACTION_KEY_ALREADY_CLAIMED');

function getAlreadyClaimedCode() {
  return 'S-006';
}

assert(getAlreadyClaimedCode() === 'S-006', 'Already claimed → S-006');

// ── PART D: Full Routing Scenarios ─────────────────────────
console.log('\n=== PART D: Full Routing Scenarios ===\n');

// D1. QUALIFIED Scenario
console.log('D1. QUALIFIED Scenario');

const qualifiedScenario = {
  disposition: 'QUALIFIED',
  consent_to_contact: true,
  side_effects: getSideEffects('QUALIFIED', true),
  blocked: getBlockedActions('QUALIFIED'),
  state: getRoutingState('QUALIFIED'),
  event: getRoutingEventCode('QUALIFIED'),
};

assert(qualifiedScenario.side_effects.length === 2, 'QUALIFIED: 2 SEs');
assert(qualifiedScenario.side_effects.includes('TELEGRAM_ALERT'), 'QUALIFIED: Telegram');
assert(qualifiedScenario.side_effects.includes('PROSPECT_EMAIL'), 'QUALIFIED: Email');
assert(qualifiedScenario.state.processing_state === 'ROUTING', 'QUALIFIED: ROUTING');
assert(qualifiedScenario.event === 'ROUTING_QUALIFIED', 'QUALIFIED: event');

// D2. NURTURE with Consent
console.log('\nD2. NURTURE with Consent');

const nurtureConsent = {
  disposition: 'NURTURE',
  consent_to_contact: true,
  side_effects: getSideEffects('NURTURE', true),
  blocked: getBlockedActions('NURTURE'),
  state: getRoutingState('NURTURE'),
  event: getRoutingEventCode('NURTURE'),
};

assert(nurtureConsent.side_effects.length === 1, 'NURTURE+consent: 1 SE');
assert(nurtureConsent.side_effects.includes('PROSPECT_EMAIL'), 'NURTURE+consent: Email');
assert(!nurtureConsent.side_effects.includes('TELEGRAM_ALERT'), 'NURTURE: no Telegram');
assert(nurtureConsent.state.processing_state === 'ROUTING', 'NURTURE: ROUTING');

// D3. NURTURE without Consent
console.log('\nD3. NURTURE without Consent');

const nurtureNoConsent = {
  disposition: 'NURTURE',
  consent_to_contact: false,
  side_effects: getSideEffects('NURTURE', false),
  blocked: getBlockedActions('NURTURE'),
};

assert(nurtureNoConsent.side_effects.length === 0, 'NURTURE no consent: 0 SE');
assert(!shouldSendProspectEmail('NURTURE', false), 'NURTURE no consent: email blocked');

// D4. DISQUALIFIED Scenario
console.log('\nD4. DISQUALIFIED Scenario');

const disqualified = {
  disposition: 'DISQUALIFIED',
  consent_to_contact: true,
  side_effects: getSideEffects('DISQUALIFIED', true),
  state: getRoutingState('DISQUALIFIED'),
  event: getRoutingEventCode('DISQUALIFIED'),
};

assert(disqualified.side_effects.length === 1, 'DISQUALIFIED+consent: 1 SE');
assert(disqualified.state.processing_state === 'COMPLETED', 'DISQUALIFIED: COMPLETED');
assert(disqualified.event === 'ROUTING_DISQUALIFIED', 'DISQUALIFIED: event');

// D5. HUMAN_REVIEW Scenario
console.log('\nD5. HUMAN_REVIEW Scenario');

const humanReview = {
  disposition: 'HUMAN_REVIEW',
  consent_to_contact: true,
  side_effects: getSideEffects('HUMAN_REVIEW', true),
  blocked: getBlockedActions('HUMAN_REVIEW'),
  state: getRoutingState('HUMAN_REVIEW'),
  event: getRoutingEventCode('HUMAN_REVIEW'),
};

assert(humanReview.side_effects.length === 0, 'HUMAN_REVIEW: 0 SE');
assert(humanReview.blocked.includes('TELEGRAM_ALERT'), 'HUMAN_REVIEW: blocks Telegram');
assert(humanReview.blocked.includes('PROSPECT_EMAIL'), 'HUMAN_REVIEW: blocks Email');
assert(humanReview.state.processing_state === 'AWAITING_HUMAN_REVIEW', 'HUMAN_REVIEW: AWAITING_HUMAN_REVIEW');
assert(humanReview.event === 'ROUTING_AWAITING_HUMAN_REVIEW', 'HUMAN_REVIEW: event');

// ── PART E: WF-11/WF-12 Delivery Scenarios ─────────────────
console.log('\n=== PART E: Delivery Scenarios ===\n');

// E1. Successful Telegram Delivery
console.log('E1. Successful Telegram Delivery');

function simulateTelegramDelivery(se) {
  // 1. Check action key
  if (isAlreadyClaimed(se.status)) return { result: 'ALREADY_CLAIMED', code: 'S-006' };

  // 2. Update to IN_PROGRESS
  if (!isRetryable(se.status)) return { result: 'INVALID_STATE', code: null };
  se.status = 'IN_PROGRESS';
  se.attempt_count = incrementAttempt(se.attempt_count);

  // 3. Send (simulated success)
  const messageId = 'tg_msg_' + crypto.randomUUID().slice(0, 8);
  se.status = 'SUCCEEDED';
  se.provider_reference = messageId;
  se.completed_at = new Date();

  return { result: 'SUCCESS', code: getSuccessCode(se.action_type), messageId };
}

const tgSE = {
  action_key: telegramKey, action_type: 'TELEGRAM_ALERT', status: 'PENDING',
  attempt_count: 0, provider_reference: null, completed_at: null,
};
const tgResult = simulateTelegramDelivery(tgSE);
assert(tgResult.result === 'SUCCESS', 'Telegram: SUCCESS');
assert(tgResult.code === 'S-001', 'Telegram: S-001');
assert(tgSE.status === 'SUCCEEDED', 'Telegram: status SUCCEEDED');
assert(tgSE.attempt_count === 1, 'Telegram: attempt_count=1');
assert(tgSE.provider_reference !== null, 'Telegram: provider_reference set');

// E2. Already Claimed Telegram
console.log('\nE2. Already Claimed Telegram');

const tgDuplicate = simulateTelegramDelivery(tgSE);
assert(tgDuplicate.result === 'ALREADY_CLAIMED', 'Telegram duplicate: ALREADY_CLAIMED');
assert(tgDuplicate.code === 'S-006', 'Telegram duplicate: S-006');
assert(tgSE.status === 'SUCCEEDED', 'Telegram: status unchanged');

// E3. Successful Email Delivery
console.log('\nE3. Successful Email Delivery');

function simulateEmailDelivery(se, consentToContact) {
  // 0. Check consent
  if (!consentToContact) {
    se.status = 'SKIPPED';
    return { result: 'SKIPPED', code: 'S-005' };
  }

  // 1. Check action key
  if (isAlreadyClaimed(se.status)) return { result: 'ALREADY_CLAIMED', code: 'S-006' };

  // 2. Update to IN_PROGRESS
  if (!isRetryable(se.status)) return { result: 'INVALID_STATE', code: null };
  se.status = 'IN_PROGRESS';
  se.attempt_count = incrementAttempt(se.attempt_count);

  // 3. Send (simulated success)
  se.status = 'SUCCEEDED';
  se.provider_reference = 'email_' + crypto.randomUUID().slice(0, 8);
  se.completed_at = new Date();

  return { result: 'SUCCESS', code: getSuccessCode(se.action_type) };
}

const emailSE = {
  action_key: emailKey, action_type: 'PROSPECT_EMAIL', status: 'PENDING',
  attempt_count: 0, provider_reference: null, completed_at: null,
};
const emailResult = simulateEmailDelivery(emailSE, true);
assert(emailResult.result === 'SUCCESS', 'Email: SUCCESS');
assert(emailResult.code === 'S-003', 'Email: S-003');
assert(emailSE.status === 'SUCCEEDED', 'Email: status SUCCEEDED');

// E4. Email Skipped No Consent
console.log('\nE4. Email Skipped No Consent');

const emailNoConsent = {
  action_key: createActionKey('email'), action_type: 'PROSPECT_EMAIL', status: 'PENDING',
  attempt_count: 0, provider_reference: null, completed_at: null,
};
const skipResult = simulateEmailDelivery(emailNoConsent, false);
assert(skipResult.result === 'SKIPPED', 'Email no consent: SKIPPED');
assert(skipResult.code === 'S-005', 'Email no consent: S-005');
assert(emailNoConsent.status === 'SKIPPED', 'Email no consent: status SKIPPED');

// E5. Failed Delivery
console.log('\nE5. Failed Delivery');

function simulateFailedDelivery(se) {
  if (isAlreadyClaimed(se.status)) return { result: 'ALREADY_CLAIMED', code: 'S-006' };
  se.status = 'IN_PROGRESS';
  se.attempt_count = incrementAttempt(se.attempt_count);

  // Simulated failure
  se.status = 'FAILED';
  se.error_classification = 'API_TIMEOUT';
  se.completed_at = new Date();

  return { result: 'FAILURE', code: getFailureCode(se.action_type), error: 'API_TIMEOUT' };
}

const failSE = {
  action_key: createActionKey('telegram'), action_type: 'TELEGRAM_ALERT', status: 'PENDING',
  attempt_count: 0, provider_reference: null, completed_at: null,
};
const failResult = simulateFailedDelivery(failSE);
assert(failResult.result === 'FAILURE', 'Failure: FAILURE');
assert(failResult.code === 'S-002', 'Failure: S-002');
assert(failSE.status === 'FAILED', 'Failure: status FAILED');
assert(failSE.error_classification === 'API_TIMEOUT', 'Failure: error_classification');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);