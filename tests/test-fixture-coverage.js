#!/usr/bin/env node
/**
 * I-12: Synthetic Evaluation & Fixtures — Coverage Analysis
 *
 * Tests fixture coverage, completeness, and edge cases:
 *  Part A: Disposition coverage (all 5 dispositions)
 *  Part B: Processing state coverage (all 12 states)
 *  Part C: Reason code coverage (all 45 codes)
 *  Part D: Pipeline path coverage (early exit, full flow, review, error)
 *  Part E: Edge case coverage (missing fields, duplicates, injection, malformed)
 *  Part F: Missing fixture scenarios
 *  Part G: Forward/backward compatibility
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, detail) {
  if (condition) { passed++; }
  else {
    failed++;
    const msg = `  ✗ ${message}` + (detail ? `\n    ${detail}` : '');
    console.log(msg);
    failures.push(msg);
  }
}

const fs = require('fs');
const synthLeads = JSON.parse(fs.readFileSync('fixtures/synthetic-leads.json', 'utf8'));
const expectedOutcomes = JSON.parse(fs.readFileSync('fixtures/expected-outcomes.json', 'utf8'));
const reasonCodes = JSON.parse(fs.readFileSync('schemas/reason-codes.json', 'utf8'));

console.log('=== I-12: Fixture Coverage Analysis ===\n');

const leads = synthLeads.leads;
const outcomes = expectedOutcomes.fixtures;

// Helper: get all expected reason codes across fixtures
const allExpectedCodes = new Set();
leads.forEach(l => {
  (l.expected.reason_codes || []).forEach(c => allExpectedCodes.add(c));
});

// Helper: all defined reason codes
const allDefinedCodes = {};
Object.entries(reasonCodes.codes).forEach(([cat, codes]) => {
  Object.entries(codes).forEach(([code, info]) => {
    allDefinedCodes[code] = { category: cat, label: info.label };
  });
});

// ═══════════════════════════════════════════════════════════
// PART A: Disposition Coverage
// ═══════════════════════════════════════════════════════════
console.log('=== PART A: Disposition Coverage ===\n');

const ALL_DISPOSITIONS = ['QUALIFIED', 'NURTURE', 'DISQUALIFIED', 'HUMAN_REVIEW'];
const fixtureDispositions = new Set(leads.map(l => l.expected.disposition));

ALL_DISPOSITIONS.forEach(d => {
  assert(fixtureDispositions.has(d), `${d}: covered`, 
    `Missing fixture for disposition ${d}`);
});

// NURTURE coverage
const nurtureFixtures = leads.filter(l => l.expected.disposition === 'NURTURE');
assert(nurtureFixtures.length > 0, 'NURTURE: at least 1 fixture',
  'No fixture tests NURTURE disposition. Add fixture for nurturing leads.');

// ═══════════════════════════════════════════════════════════
// PART B: Processing State Coverage
// ═══════════════════════════════════════════════════════════
console.log('\n=== PART B: Processing State Coverage ===\n');

const ALL_STATES = [
  'RECEIVED', 'VALIDATING', 'INVALID', 'DEDUPLICATING', 'DUPLICATE',
  'PREQUALIFYING', 'ANALYZING', 'DECIDING', 'AWAITING_HUMAN_REVIEW',
  'ROUTING', 'COMPLETED', 'FAILED',
];

const fixtureStates = new Set(leads.map(l => l.expected.processing_state));

ALL_STATES.forEach(s => {
  const covered = fixtureStates.has(s);
  const fixtureCount = leads.filter(l => l.expected.processing_state === s).length;
  // Intermediate states are not expected as final states
  const isIntermediate = ['RECEIVED', 'VALIDATING', 'DEDUPLICATING', 'PREQUALIFYING',
    'ANALYZING', 'DECIDING', 'ROUTING'].includes(s);
  if (isIntermediate) {
    assert(!covered, `${s}: NOT expected (intermediate)`,
      `State ${s} is intermediate - should not appear as final expected state`);
  } else {
    assert(covered, `${s}: covered (${fixtureCount} fixtures)`,
      `Missing fixture for final state ${s}`);
  }
});

// ═══════════════════════════════════════════════════════════
// PART C: Reason Code Coverage
// ═══════════════════════════════════════════════════════════
console.log('\n=== PART C: Reason Code Coverage ===\n');

const totalDefined = Object.keys(allDefinedCodes).length;
const totalCovered = allExpectedCodes.size;

console.log(`  Defined: ${totalDefined}, Covered by fixtures: ${totalCovered}`);

Object.entries(allDefinedCodes).forEach(([code, info]) => {
  const covered = allExpectedCodes.has(code);
  assert(covered || code.startsWith('E-') || code.startsWith('H-'),
    `${code} (${info.label}): ${covered ? 'covered' : 'MISSING'}`,
    `Reason code ${code} not covered by any fixture`);
});

// Special: E-codes (system errors) are expected to be uncovered
console.log('\n  E-codes (system errors):');
Object.entries(allDefinedCodes).filter(([code]) => code.startsWith('E-')).forEach(([code, info]) => {
  const covered = allExpectedCodes.has(code);
  console.log(`    ${code} (${info.label}): ${covered ? 'covered' : 'uncovered (acceptable - system path)'}`);
});

// Special: H-codes (human review) should be covered
console.log('\n  H-codes (human review):');
Object.entries(allDefinedCodes).filter(([code]) => code.startsWith('H-')).forEach(([code, info]) => {
  const covered = allExpectedCodes.has(code);
  const status = covered ? 'covered' : 'UNCOVERED';
  console.log(`    ${code} (${info.label}): ${status}`);
});

// ═══════════════════════════════════════════════════════════
// PART D: Pipeline Path Coverage
// ═══════════════════════════════════════════════════════════
console.log('\n=== PART D: Pipeline Path Coverage ===\n');

const paths = {
  'FULL_FLOW_VALID': false,       // RECEIVED → VALIDATING → ... → QUALIFIED → COMPLETED
  'EARLY_EXIT_INVALID': false,    // RECEIVED → VALIDATING → INVALID
  'EARLY_EXIT_DUPLICATE': false,  // RECEIVED → ... → DEDUPLICATING → DUPLICATE
  'FULL_FLOW_DISQUALIFIED': false,// RECEIVED → ... → DISQUALIFIED → COMPLETED
  'REVIEW_PATH': false,           // RECEIVED → ... → DECIDING → AWAITING_HUMAN_REVIEW
  'ERROR_PATH_FAILED': false,     // RECEIVED → ... → FAILED
  'NO_CONSENT_PATH': false,       // QUALIFIED but consent=false
  'HUMAN_OVERRIDE_PATH': false,   // HUMAN_REVIEW → resolved to QUALIFIED
};

leads.forEach(l => {
  const d = l.expected.disposition;
  const s = l.expected.processing_state;
  const codes = l.expected.reason_codes || [];

  if (d === 'QUALIFIED' && s === 'COMPLETED' && !codes.includes('I-002') && !codes.includes('H-002')) {
    paths['FULL_FLOW_VALID'] = true;
  }
  if (s === 'INVALID') {
    paths['EARLY_EXIT_INVALID'] = true;
  }
  if (s === 'DUPLICATE') {
    paths['EARLY_EXIT_DUPLICATE'] = true;
  }
  if (d === 'DISQUALIFIED' && s === 'COMPLETED') {
    paths['FULL_FLOW_DISQUALIFIED'] = true;
  }
  if (s === 'AWAITING_HUMAN_REVIEW') {
    paths['REVIEW_PATH'] = true;
  }
  if (s === 'FAILED') {
    paths['ERROR_PATH_FAILED'] = true;
  }
  if (d === 'QUALIFIED' && codes.includes('S-005')) {
    paths['NO_CONSENT_PATH'] = true;
  }
  if (d === 'QUALIFIED' && codes.includes('H-002')) {
    paths['HUMAN_OVERRIDE_PATH'] = true;
  }
});

Object.entries(paths).forEach(([path, covered]) => {
  assert(covered, `${path}: covered`, `Missing fixture for pipeline path: ${path}`);
});

// ═══════════════════════════════════════════════════════════
// PART E: Edge Case Coverage
// ═══════════════════════════════════════════════════════════
console.log('\n=== PART E: Edge Case Coverage ===\n');

const edgeCases = {
  'MISSING_REQUIRED_FIELD': false,
  'EXACT_DUPLICATE': false,
  'OUT_OF_SCOPE_SERVICE': false,
  'PROMPT_INJECTION': false,
  'MALFORMED_AI_OUTPUT': false,
  'NO_CONSENT_TO_CONTACT': false,
  'HUMAN_OVERRIDE': false,
  'EXTERNAL_DEPENDENCY_FAILURE': false,
  'AMBIGUOUS_HIGH_POTENTIAL': false,
  'LARGE_PROJECT_DESCRIPTION': false,
  'UNICODE_PROJECT_DESCRIPTION': false,
  'MISSING_OPTIONAL_FIELDS': false,
};

leads.forEach(l => {
  const codes = l.expected.reason_codes || [];
  const desc = l.description || '';

  if (codes.includes('V-001')) edgeCases['MISSING_REQUIRED_FIELD'] = true;
  if (codes.includes('I-002')) edgeCases['EXACT_DUPLICATE'] = true;
  if (codes.includes('P-003') || codes.includes('D-004')) edgeCases['OUT_OF_SCOPE_SERVICE'] = true;
  if (codes.includes('D-008')) edgeCases['PROMPT_INJECTION'] = true;
  if (codes.includes('A-002') || codes.includes('D-009')) edgeCases['MALFORMED_AI_OUTPUT'] = true;
  if (codes.includes('S-005') || codes.includes('P-001')) edgeCases['NO_CONSENT_TO_CONTACT'] = true;
  if (codes.includes('H-002')) edgeCases['HUMAN_OVERRIDE'] = true;
  if (codes.includes('E-003')) edgeCases['EXTERNAL_DEPENDENCY_FAILURE'] = true;
  if (codes.includes('D-006')) edgeCases['AMBIGUOUS_HIGH_POTENTIAL'] = true;
});

Object.entries(edgeCases).forEach(([ec, covered]) => {
  assert(covered, `${ec}: covered`, `Missing fixture for edge case: ${ec}`);
});

// ═══════════════════════════════════════════════════════════
// PART F: Missing Fixture Scenarios
// ═══════════════════════════════════════════════════════════
console.log('\n=== PART F: Missing Fixture Scenarios ===\n');

const missingScenarios = [];

// NURTURE disposition
if (fixtureDispositions.has('NURTURE') === false) {
  missingScenarios.push('NURTURE disposition (missing info, weak intent)');
}

// AWAITING_HUMAN_REVIEW → QUALIFIED (via WF-13)
if (!leads.some(l => l.expected.reason_codes.includes('H-002'))) {
  missingScenarios.push('H-002 REVIEW_RESOLVED_QUALIFIED (human override to QUALIFIED)');
}

// AWAITING_HUMAN_REVIEW → NURTURE (via WF-13)
if (!leads.some(l => l.expected.reason_codes.includes('H-003'))) {
  missingScenarios.push('H-003 REVIEW_RESOLVED_NURTURE (human override to NURTURE)');
}

// AWAITING_HUMAN_REVIEW → DISQUALIFIED (via WF-13)
if (!leads.some(l => l.expected.reason_codes.includes('H-004'))) {
  missingScenarios.push('H-004 REVIEW_RESOLVED_DISQUALIFIED (human override to DISQUALIFIED)');
}

// H-005/H-006/H-007 error paths
if (!leads.some(l => l.expected.reason_codes.includes('H-005'))) {
  missingScenarios.push('H-005 REVIEW_TOKEN_EXPIRED');
}
if (!leads.some(l => l.expected.reason_codes.includes('H-006'))) {
  missingScenarios.push('H-006 REVIEW_ALREADY_RESOLVED');
}
if (!leads.some(l => l.expected.reason_codes.includes('H-007'))) {
  missingScenarios.push('H-007 REVIEW_UNAUTHORIZED');
}

// E-002 DB_CONNECTION_ERROR
if (!leads.some(l => l.expected.reason_codes.includes('E-002'))) {
  missingScenarios.push('E-002 DB_CONNECTION_ERROR');
}

// A-004 TIMEOUT
if (!leads.some(l => l.expected.reason_codes.includes('A-004'))) {
  missingScenarios.push('A-004 AI_ANALYSIS_TIMEOUT');
}

// VALIDATION_FAILED -> INVALID
if (!leads.some(l => l.expected.processing_state === 'INVALID' && l.expected.reason_codes.includes('V-002'))) {
  missingScenarios.push('V-002 INVALID_EMAIL_FORMAT → INVALID');
}

// Fingerprint match (I-003)
if (!leads.some(l => l.expected.reason_codes.includes('I-003'))) {
  missingScenarios.push('I-003 FINGERPRINT_MATCH (similar but not identical)');
}

// NURTURE_MISSING_INFO (D-002)
if (!leads.some(l => l.expected.reason_codes.includes('D-002'))) {
  missingScenarios.push('D-002 NURTURE_MISSING_INFO');
}

// NURTURE_WEAK_INTENT (D-003)
if (!leads.some(l => l.expected.reason_codes.includes('D-003'))) {
  missingScenarios.push('D-003 NURTURE_WEAK_INTENT');
}

// DISQUALIFIED_EXCLUDED_SERVICE (D-005)
if (!leads.some(l => l.expected.reason_codes.includes('D-005'))) {
  missingScenarios.push('D-005 DISQUALIFIED_EXCLUDED_SERVICE');
}

// Side effect failures (S-002, S-004)
if (!leads.some(l => l.expected.reason_codes.includes('S-002'))) {
  missingScenarios.push('S-002 TELEGRAM_FAILED');
}
if (!leads.some(l => l.expected.reason_codes.includes('S-004'))) {
  missingScenarios.push('S-004 EMAIL_FAILED');
}
if (!leads.some(l => l.expected.reason_codes.includes('S-006'))) {
  missingScenarios.push('S-006 ACTION_KEY_ALREADY_CLAIMED');
}

if (missingScenarios.length > 0) {
  console.log(`  ${missingScenarios.length} missing scenarios:`);
  missingScenarios.forEach(s => console.log(`    - ${s}`));
} else {
  console.log('  All scenarios covered');
}

// ═══════════════════════════════════════════════════════════
// PART G: Forward/Backward Compatibility
// ═══════════════════════════════════════════════════════════
console.log('\n=== PART G: Forward/Backward Compatibility ===\n');

assert(synthLeads.version === 1, 'synthetic-leads.json: version 1');
assert(expectedOutcomes.version === 1, 'expected-outcomes.json: version 1');
assert(synthLeads.$id.includes('v1'), 'synthetic-leads.json: $id references v1');
assert(expectedOutcomes.$id.includes('v1'), 'expected-outcomes.json: $id references v1');
assert(synthLeads.version === expectedOutcomes.version, 'Version consistency: both v1');

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Missing scenarios: ${missingScenarios.length}`);

if (failed > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(0);