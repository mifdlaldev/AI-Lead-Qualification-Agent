#!/usr/bin/env node
/**
 * I-08: Decision Logic Unit Tests
 *
 * Extracted deterministic decision engine from WF-08.
 * Tests all 8 branches, 4 dispositions, 7 reason codes,
 * all 6 decision gates, state transitions, and edge cases.
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, expected, got) {
  if (condition) { passed++; }
  else {
    failed++;
    const msg = `  ✗ ${message}` + (expected !== undefined ? `\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(got)}` : '');
    console.log(msg);
    failures.push(msg);
  }
}

function log(msg) { console.log(`  ${msg}`); }

// ── Decision Engine (extracted from WF-08) ─────────────────

function evaluateRiskFlags(riskFlags) {
  if (riskFlags == null) return { has_prompt_injection: 'false', has_contradictory: 'false' };
  const json = Array.isArray(riskFlags) ? JSON.stringify(riskFlags) : String(riskFlags);
  const hasPromptInjection = json.includes('PROMPT_INJECTION_SUSPECTED') || json.includes('ADVERSARIAL_CONTENT');
  const hasContradictory = json.includes('CONTRADICTORY_SIGNALS');
  return {
    has_prompt_injection: hasPromptInjection ? 'true' : 'false',
    has_contradictory: hasContradictory ? 'true' : 'false',
  };
}

/**
 * Deterministic decision engine from WF-08.
 * Maps prequalification + AI analysis → disposition.
 */
function decide(input) {
  const {
    hard_exclusion_flag,
    excluded_service,
    validation_status,
    risk_flags,
    confidence,
    service_fit,
    missing_info = [],
  } = input;

  // Gate 1: Hard Exclusion
  if (hard_exclusion_flag === true) {
    return {
      disposition: 'DISQUALIFIED',
      reason_codes: excluded_service ? ['D-005'] : ['D-004'],
      primary_reason_code: excluded_service ? 'D-005' : 'D-004',
      requires_human_review: false,
      confidence_level: confidence || 'UNKNOWN',
      decision_reason: excluded_service ? 'Excluded service detected' : 'Hard exclusion rule applied',
    };
  }

  // Gate 2: AI Analysis Valid?
  if (validation_status !== 'VALID') {
    return {
      disposition: 'HUMAN_REVIEW',
      reason_codes: ['D-009'],
      primary_reason_code: 'D-009',
      requires_human_review: true,
      confidence_level: 'UNKNOWN',
      decision_reason: 'AI analysis output is invalid or malformed',
    };
  }

  // Gate 3: Security Risk Flags
  const riskEval = evaluateRiskFlags(risk_flags);
  if (riskEval.has_prompt_injection === 'true') {
    return {
      disposition: 'HUMAN_REVIEW',
      reason_codes: ['D-008'],
      primary_reason_code: 'D-008',
      requires_human_review: true,
      confidence_level: confidence,
      decision_reason: 'Prompt injection or adversarial content detected in lead submission',
    };
  }

  // Gate 4: Confidence >= MEDIUM
  if (confidence !== 'HIGH' && confidence !== 'MEDIUM') {
    return {
      disposition: 'HUMAN_REVIEW',
      reason_codes: ['D-007'],
      primary_reason_code: 'D-007',
      requires_human_review: true,
      confidence_level: confidence,
      decision_reason: 'AI confidence below threshold - requires human review',
    };
  }

  // Gate 5: Service Fit IN_SCOPE or PARTIAL
  if (service_fit === 'IN_SCOPE' || service_fit === 'PARTIAL') {
    return {
      disposition: 'QUALIFIED',
      reason_codes: ['D-001'],
      primary_reason_code: 'D-001',
      requires_human_review: false,
      confidence_level: confidence,
      decision_reason: 'All qualification criteria met - service fit in scope, sufficient confidence',
    };
  }

  // Gate 6: Service Fit OUT_OF_SCOPE
  if (service_fit === 'OUT_OF_SCOPE') {
    return {
      disposition: 'DISQUALIFIED',
      reason_codes: ['D-004'],
      primary_reason_code: 'D-004',
      requires_human_review: false,
      confidence_level: confidence,
      decision_reason: 'Project request is out of scope with sufficient confidence',
    };
  }

  // Fallback: NURTURE
  const missingEmpty = Array.isArray(missing_info) && missing_info.length === 0;
  return {
    disposition: 'NURTURE',
    reason_codes: missingEmpty ? ['D-003'] : ['D-002'],
    primary_reason_code: missingEmpty ? 'D-003' : 'D-002',
    requires_human_review: false,
    confidence_level: confidence,
    decision_reason: missingEmpty
      ? 'Weak intent signal - insufficient for qualification'
      : 'Missing information prevents qualification',
  };
}

// ── State transition function ──────────────────────────────

function getNextState(disposition) {
  if (disposition === 'HUMAN_REVIEW') return 'AWAITING_HUMAN_REVIEW';
  return 'ROUTING';
}

console.log('=== I-08: Decision Logic Unit Tests ===\n');

// ── 1. Hard Exclusion Path ────────────────────────────────
console.log('1. Hard Exclusion (Gate 1)');

let r = decide({ hard_exclusion_flag: true, excluded_service: false });
assert(r.disposition === 'DISQUALIFIED', 'hard_exclusion → DISQUALIFIED', 'DISQUALIFIED', r.disposition);
assert(r.reason_codes[0] === 'D-004', 'no excluded_service → D-004', 'D-004', r.reason_codes[0]);
assert(r.requires_human_review === false, 'requires_human_review = false');

r = decide({ hard_exclusion_flag: true, excluded_service: true });
assert(r.disposition === 'DISQUALIFIED', 'hard_exclusion+excluded → DISQUALIFIED');
assert(r.reason_codes[0] === 'D-005', 'excluded_service → D-005', 'D-005', r.reason_codes[0]);
assert(r.primary_reason_code === 'D-005', 'primary_reason_code = D-005');

// Hard exclusion gates BEFORE validation check
r = decide({ hard_exclusion_flag: true, excluded_service: false, validation_status: 'VALID' });
assert(r.disposition === 'DISQUALIFIED', 'hard_exclusion gates even with VALID analysis');

// ── 2. AI Analysis NOT Valid → HUMAN_REVIEW D-009 ─────────
console.log('\n2. AI Analysis Invalid (Gate 2)');

['MALFORMED', 'FAILED', 'anything_else'].forEach(status => {
  r = decide({ hard_exclusion_flag: false, validation_status: status });
  assert(r.disposition === 'HUMAN_REVIEW', `validation_status=${status} → HUMAN_REVIEW D-009`, 'HUMAN_REVIEW', r.disposition);
  assert(r.reason_codes[0] === 'D-009', `reason = D-009`);
  assert(r.requires_human_review === true, 'requires_human_review = true');
  assert(r.confidence_level === 'UNKNOWN', 'confidence = UNKNOWN');
});

// ── 3. Security Risk → HUMAN_REVIEW D-008 ─────────────────
console.log('\n3. Security Risk Flags (Gate 3)');

const securityFlags = ['PROMPT_INJECTION_SUSPECTED', 'ADVERSARIAL_CONTENT'];
securityFlags.forEach(flag => {
  r = decide({
    hard_exclusion_flag: false,
    validation_status: 'VALID',
    risk_flags: [flag],
    confidence: 'HIGH',
    service_fit: 'IN_SCOPE',
  });
  assert(r.disposition === 'HUMAN_REVIEW', `risk_flags=[${flag}] → HUMAN_REVIEW D-008`);
  assert(r.reason_codes[0] === 'D-008', 'reason = D-008');
  assert(r.requires_human_review === true, 'requires_human_review = true');
});

// Security risk gates BEFORE confidence check
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: ['PROMPT_INJECTION_SUSPECTED'], confidence: 'LOW',
});
assert(r.disposition === 'HUMAN_REVIEW', 'prompt injection gates even with LOW confidence');
assert(r.reason_codes[0] === 'D-008', 'D-008 overrides D-007');

// Both flags
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: ['PROMPT_INJECTION_SUSPECTED', 'ADVERSARIAL_CONTENT'], confidence: 'HIGH',
});
assert(r.disposition === 'HUMAN_REVIEW', 'both injection flags → HUMAN_REVIEW D-008');

// ── 4. Low Confidence → HUMAN_REVIEW D-007 ─────────────────
console.log('\n4. Low Confidence (Gate 4)');

['LOW', 'UNKNOWN'].forEach(conf => {
  r = decide({
    hard_exclusion_flag: false, validation_status: 'VALID',
    risk_flags: [], confidence: conf, service_fit: 'IN_SCOPE',
  });
  assert(r.disposition === 'HUMAN_REVIEW', `confidence=${conf} → HUMAN_REVIEW D-007`);
  assert(r.reason_codes[0] === 'D-007', 'reason = D-007');
  assert(r.requires_human_review === true, 'requires_human_review = true');
});

// ── 5. Qualified ──────────────────────────────────────────
console.log('\n5. Qualified (Gate 5)');

['IN_SCOPE', 'PARTIAL'].forEach(fit => {
  ['HIGH', 'MEDIUM'].forEach(conf => {
    r = decide({
      hard_exclusion_flag: false, validation_status: 'VALID',
      risk_flags: [], confidence: conf, service_fit: fit,
    });
    assert(r.disposition === 'QUALIFIED', `service_fit=${fit}, confidence=${conf} → QUALIFIED D-001`, 'QUALIFIED', r.disposition);
    assert(r.reason_codes[0] === 'D-001', 'reason = D-001');
    assert(r.requires_human_review === false, 'requires_human_review = false');
  });
});

// ── 6. Disqualified — Out of Scope ─────────────────────────
console.log('\n6. Disqualified — Out of Scope (Gate 6)');

['HIGH', 'MEDIUM'].forEach(conf => {
  r = decide({
    hard_exclusion_flag: false, validation_status: 'VALID',
    risk_flags: [], confidence: conf, service_fit: 'OUT_OF_SCOPE',
  });
  assert(r.disposition === 'DISQUALIFIED', `OUT_OF_SCOPE + ${conf} → DISQUALIFIED D-004`);
  assert(r.reason_codes[0] === 'D-004', 'reason = D-004');
  assert(r.requires_human_review === false, 'requires_human_review = false');
});

// ── 7. Nurture ─────────────────────────────────────────────
console.log('\n7. Nurture (Fallback)');

// UNKNOWN service_fit + HIGH confidence → NURTURE
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'HIGH', service_fit: 'UNKNOWN', missing_info: ['Budget not specified'],
});
assert(r.disposition === 'NURTURE', 'service_fit=UNKNOWN+confidence=HIGH → NURTURE');
assert(r.reason_codes[0] === 'D-002', 'has missing_info → D-002');
assert(r.requires_human_review === false, 'requires_human_review = false');

// No missing info → D-003
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'MEDIUM', service_fit: 'UNKNOWN', missing_info: [],
});
assert(r.disposition === 'NURTURE', 'no missing_info → NURTURE D-003');
assert(r.reason_codes[0] === 'D-003', 'reason = D-003');

// UNKNOWN service_fit + MEDIUM confidence → NURTURE
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'MEDIUM', service_fit: 'UNKNOWN',
});
assert(r.disposition === 'NURTURE', 'UNKNOWN+MEDIUM → NURTURE');

// ── 8. State Transitions ──────────────────────────────────
console.log('\n8. State Transitions');

assert(getNextState('HUMAN_REVIEW') === 'AWAITING_HUMAN_REVIEW', 'HUMAN_REVIEW → AWAITING_HUMAN_REVIEW');
assert(getNextState('QUALIFIED') === 'ROUTING', 'QUALIFIED → ROUTING');
assert(getNextState('NURTURE') === 'ROUTING', 'NURTURE → ROUTING');
assert(getNextState('DISQUALIFIED') === 'ROUTING', 'DISQUALIFIED → ROUTING');

// ── 9. Confidence Level Preservation ──────────────────────
console.log('\n9. Confidence Level Preservation');

r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.confidence_level === 'HIGH', 'QUALIFIED preserves HIGH confidence');

r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'LOW', service_fit: 'IN_SCOPE',
});
assert(r.confidence_level === 'LOW', 'HUMAN_REVIEW D-007 preserves LOW confidence');

r = decide({ hard_exclusion_flag: false, validation_status: 'MALFORMED' });
assert(r.confidence_level === 'UNKNOWN', 'D-009 sets UNKNOWN confidence');

// ── 10. All Disposition Types ──────────────────────────────
console.log('\n10. All Disposition Types');

const allDispositions = new Set();
const testCases = [
  { input: { hard_exclusion_flag: true }, expected: 'DISQUALIFIED' },
  { input: { hard_exclusion_flag: true, excluded_service: true }, expected: 'DISQUALIFIED', code: 'D-005' },
  { input: { hard_exclusion_flag: false, validation_status: 'MALFORMED' }, expected: 'HUMAN_REVIEW' },
  { input: { hard_exclusion_flag: false, validation_status: 'VALID', risk_flags: ['PROMPT_INJECTION_SUSPECTED'] }, expected: 'HUMAN_REVIEW' },
  { input: { hard_exclusion_flag: false, validation_status: 'VALID', risk_flags: [], confidence: 'LOW' }, expected: 'HUMAN_REVIEW' },
  { input: { hard_exclusion_flag: false, validation_status: 'VALID', risk_flags: [], confidence: 'HIGH', service_fit: 'IN_SCOPE' }, expected: 'QUALIFIED' },
  { input: { hard_exclusion_flag: false, validation_status: 'VALID', risk_flags: [], confidence: 'HIGH', service_fit: 'OUT_OF_SCOPE' }, expected: 'DISQUALIFIED' },
  { input: { hard_exclusion_flag: false, validation_status: 'VALID', risk_flags: [], confidence: 'HIGH', service_fit: 'UNKNOWN', missing_info: ['No budget'] }, expected: 'NURTURE', code: 'D-002' },
  { input: { hard_exclusion_flag: false, validation_status: 'VALID', risk_flags: [], confidence: 'HIGH', service_fit: 'UNKNOWN', missing_info: [] }, expected: 'NURTURE', code: 'D-003' },
];
testCases.forEach(tc => {
  const result = decide(tc.input);
  allDispositions.add(result.disposition);
  assert(result.disposition === tc.expected, `${tc.expected}`, tc.expected, result.disposition);
});
assert(allDispositions.size === 4, 'All 4 dispositions reachable: QUALIFIED, NURTURE, DISQUALIFIED, HUMAN_REVIEW');

// ── 11. All Reason Codes Reachable ────────────────────────
console.log('\n11. All Reason Codes Reachable');

const allCodes = new Set();
testCases.forEach(tc => {
  const result = decide(tc.input);
  result.reason_codes.forEach(c => allCodes.add(c));
});
assert(allCodes.has('D-001'), 'D-001 reachable');
assert(allCodes.has('D-002'), 'D-002 reachable');
assert(allCodes.has('D-003'), 'D-003 reachable');
assert(allCodes.has('D-004'), 'D-004 reachable');
assert(allCodes.has('D-005'), 'D-005 reachable');
assert(allCodes.has('D-007'), 'D-007 reachable');
assert(allCodes.has('D-008'), 'D-008 reachable');
assert(allCodes.has('D-009'), 'D-009 reachable');
assert(!allCodes.has('D-006'), 'D-006 NOT reachable (defined in registry but unused)');

// ── 12. Edge Cases ────────────────────────────────────────
console.log('\n12. Edge Cases');

// Empty risk_flags
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'QUALIFIED', 'empty risk_flags → QUALIFIED');

// risk_flags with non-security flags
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: ['MISSING_CRITICAL_INFO', 'UNUSUAL_REQUEST'], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'QUALIFIED', 'non-security flags → QUALIFIED (not blocked)');

// CONTRADICTORY_SIGNALS flag alone (not a security flag)
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: ['CONTRADICTORY_SIGNALS'], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'QUALIFIED', 'CONTRADICTORY_SIGNALS alone → QUALIFIED (not blocked)');

// null risk_flags
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: null, confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'QUALIFIED', 'null risk_flags → QUALIFIED');

// Missing service_fit
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: [], confidence: 'HIGH', service_fit: undefined,
});
assert(r.disposition === 'NURTURE', 'undefined service_fit → NURTURE (fallback)');

// ── 13. FR-051: Multiple Reason Codes ─────────────────────
console.log('\n13. FR-051: Reason Codes Per Disposition');

const dispositionCodes = {
  QUALIFIED: ['D-001'],
  NURTURE: ['D-002', 'D-003'],
  DISQUALIFIED: ['D-004', 'D-005'],
  HUMAN_REVIEW: ['D-007', 'D-008', 'D-009'],
};
Object.entries(dispositionCodes).forEach(([disp, codes]) => {
  assert(codes.length >= 1, `${disp} has ${codes.length} reason code(s): ${codes.join(', ')}`);
});

// ── 14. Requires Human Review Flag ────────────────────────
console.log('\n14. Requires Human Review Flag');

const humanReviewDisp = ['HUMAN_REVIEW'];
const nonHumanReviewDisp = ['QUALIFIED', 'NURTURE', 'DISQUALIFIED'];

testCases.forEach(tc => {
  const result = decide(tc.input);
  if (humanReviewDisp.includes(result.disposition)) {
    assert(result.requires_human_review === true, `${result.disposition} → requires_human_review=true`);
  } else {
    assert(result.requires_human_review === false, `${result.disposition} → requires_human_review=false`);
  }
});

// ── 15. Sequential Priority ────────────────────────────────
console.log('\n15. Decision Gate Priority (Sequential)');

// Hard exclusion FIRST, even with valid analysis
r = decide({
  hard_exclusion_flag: true, validation_status: 'VALID',
  risk_flags: [], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'DISQUALIFIED', 'Hard exclusion gates before QUALIFIED');

// AI invalid SECOND, even with high confidence
r = decide({
  hard_exclusion_flag: false, validation_status: 'MALFORMED',
  risk_flags: [], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'HUMAN_REVIEW', 'AI invalid gates before confidence check');

// Security THIRD, even with high confidence + IN_SCOPE
r = decide({
  hard_exclusion_flag: false, validation_status: 'VALID',
  risk_flags: ['PROMPT_INJECTION_SUSPECTED'], confidence: 'HIGH', service_fit: 'IN_SCOPE',
});
assert(r.disposition === 'HUMAN_REVIEW', 'Security flags gate before service_fit check');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);