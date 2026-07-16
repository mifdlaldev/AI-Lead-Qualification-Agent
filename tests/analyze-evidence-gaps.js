#!/usr/bin/env node
/**
 * I-12: Synthetic Evaluation & Fixtures — Evidence Gaps
 *
 * Analyzes gaps in evidence generation, reproducibility, and sanitization:
 *  1. Evidence directory structure
 *  2. Evidence generation pipeline
 *  3. Reproducibility (AC-11)
 *  4. Privacy (NFR-020/021/022)
 *  5. Adversarial fixtures
 *  6. Missing evidence artifacts
 */

let critical = 0, high = 0, medium = 0, low = 0;
const findings = [];

function finding(severity, id, title, detail) {
  if (severity === 'CRITICAL') critical++;
  else if (severity === 'HIGH') high++;
  else if (severity === 'MEDIUM') medium++;
  else low++;
  findings.push({ severity, id, title, detail });
  console.log(`[${severity}] ${id}: ${title}`);
  console.log(`  ${detail}\n`);
}

const fs = require('fs');
const path = require('path');

console.log('=== I-12: Evidence Gaps Analysis ===\n');

// ═══════════════════════════════════════════════════════════
// CRITICAL: No evidence has been generated
// ═══════════════════════════════════════════════════════════

const evidenceDir = path.join(__dirname, '..', 'evidence');
const evidenceContents = fs.readdirSync(evidenceDir);
const hasActualEvidence = evidenceContents.some(f => f !== '.gitkeep' && f !== 'README.md');

if (!hasActualEvidence) {
  finding('CRITICAL', 'GAP-I12-001',
    'No evidence has been generated — evidence/ is empty',
    'evidence/ only contains .gitkeep and README.md. No benchmark runs, no run-summary.json, no per-fixture results, no metrics.json. WF-15 has never been executed. Without evidence, AC-11 cannot be verified and FR-090/091 cannot be satisfied.');
}

// ═══════════════════════════════════════════════════════════
// HIGH: Missing evidence artifacts
// ═══════════════════════════════════════════════════════════

finding('HIGH', 'GAP-I12-002',
  'No run-summary.json — evidence structure not populated',
  'evidence/README.md defines v1.0.0/run-summary.json, v1.0.0/per-fixture-results/, and v1.0.0/metrics.json. None of these exist. Without a run, the synthetic evaluation pipeline is untested E2E.');

finding('HIGH', 'GAP-I12-003',
  'No adversarial fixtures in fixtures/adversarial/',
  'fixtures/adversarial/ is empty. NFR-010 requires adversarial testing. Without adversarial fixtures (prompt injection, boundary values, malformed payloads), the system\'s security posture against malicious inputs is untested.');

finding('HIGH', 'GAP-I12-004',
  'NURTURE disposition has zero fixtures',
  '11 fixtures cover QUALIFIED (5), HUMAN_REVIEW (3), DISQUALIFIED (1), NONE (2). NURTURE has 0 fixtures. The NURTURE path (WF-10 routing, WF-12 email) is completely untested. NURTURE is a valid final disposition but has no synthetic evidence.');

finding('HIGH', 'GAP-I12-005',
  'No evidence of side effect execution',
  'S-001 (TELEGRAM_SENT), S-003 (EMAIL_SENT) are not covered by any fixture expected reason codes. The notification system (WF-11 Telegram, WF-12 Email) is never tested E2E. No evidence that side effects are actually triggered for QUALIFIED leads.');

finding('HIGH', 'GAP-I12-006',
  'No fixtures for review resolution paths (H-002, H-003, H-004)',
  'SYNTH-009 covers H-001 (review created) + H-002 (resolved to QUALIFIED). But H-003 (resolved to NURTURE) and H-004 (resolved to DISQUALIFIED) have no fixtures. The AWAITING_HUMAN_REVIEW → NURTURE and AWAITING_HUMAN_REVIEW → DISQUALIFIED paths are untested.');

finding('HIGH', 'GAP-I12-007',
  'No evidence for review error paths (H-005, H-006, H-007)',
  'H-005 (token expired), H-006 (already resolved), H-007 (unauthorized) have no fixtures. WF-13 error paths are untested. No evidence that the system correctly rejects expired tokens, double-submissions, or unauthorized access.');

finding('HIGH', 'GAP-I12-008',
  'No evidence for DB failure recovery (E-002)',
  'E-001 (unexpected error) is covered by no fixture. E-002 (DB connection error), E-003 (retry exhausted, covered by SYNTH-010), and E-004 (workflow timeout) are mostly uncovered. The error handler (WF-14) is barely tested in fixtures.');

// ═══════════════════════════════════════════════════════════
// MEDIUM: Reproducibility and quality
// ═══════════════════════════════════════════════════════════

finding('MEDIUM', 'GAP-I12-009',
  'No nondeterminism documentation',
  'AC-11 requires "subject to explicitly documented nondeterminism." No document lists which fields are nondeterministic (AI analysis output, timestamps, UUIDs). Without this, reproducibility claims are unverifiable.');

finding('MEDIUM', 'GAP-I12-010',
  'Fixture expected outcomes are frozen but not version-locked',
  'synthetic-leads.json and expected-outcomes.json are version 1, but there is no changelog. If fixtures change, there is no way to know which version of expected outcomes matches which version of the implementation.');

finding('MEDIUM', 'GAP-I12-011',
  'No fixture for V-002 (INVALID_EMAIL_FORMAT)',
  'SYNTH-002 tests missing email field (V-001). But V-002 (invalid email format like "not-an-email") has no fixture. Input validation for email format is untested.');

finding('MEDIUM', 'GAP-I12-012',
  'No fixture for V-003 (EMPTY_PROJECT_DESCRIPTION)',
  'V-003 (empty project description) has no fixture. This is distinct from missing project description — it tests the case where the field exists but is empty string.');

finding('MEDIUM', 'GAP-I12-013',
  'No fixture for I-003 (FINGERPRINT_MATCH)',
  'I-002 (exact duplicate) is covered by SYNTH-003. But I-003 (fingerprint match — similar but not identical) has no fixture. The deduplication system\'s fuzzy matching is untested.');

finding('MEDIUM', 'GAP-I12-014',
  'No fixture for A-004 (AI_ANALYSIS_TIMEOUT)',
  'A-003 (API error) is covered by SYNTH-010. But A-004 (timeout) has no fixture. The retry/timeout behavior of the AI analysis node is untested.');

finding('MEDIUM', 'GAP-I12-015',
  'No fixture for D-002 (NURTURE_MISSING_INFO) or D-003 (NURTURE_WEAK_INTENT)',
  'NURTURE disposition has zero fixtures, so D-002 and D-003 are completely uncovered. The decision engine\'s NURTURE path is untested.');

finding('MEDIUM', 'GAP-I12-016',
  'No fixture for D-007 (HUMAN_REVIEW_LOW_CONFIDENCE)',
  'D-006 (ambiguity) is covered by SYNTH-005. But D-007 (low confidence) has no fixture. The decision engine\'s confidence-based routing to human review is partially tested.');

finding('MEDIUM', 'GAP-I12-017',
  'No evidence comparison with expected side effects',
  'WF-15 compares disposition and reason codes but does not compare side_effects_triggered. The expected-outcomes.json has expected_side_effects field, but WF-15 does not use it. Side effect verification is missing from the evaluation pipeline.');

finding('MEDIUM', 'GAP-I12-018',
  'No benchmark timing metrics',
  'WF-15 records start_time and end_time but does not compute per-workflow duration or aggregate timing statistics. Performance metrics (NFR-001) cannot be measured from the evidence pipeline.');

// ═══════════════════════════════════════════════════════════
// LOW: Minor quality issues
// ═══════════════════════════════════════════════════════════

finding('LOW', 'GAP-I12-019',
  'synthetic-leads.json and expected-outcomes.json are redundant',
  'Both files contain the same fixture data (expected disposition, reason codes, state). expected-outcomes.json duplicates fixture_data from synthetic-leads.json. This creates a maintenance burden — any fixture change requires updating two files.');

finding('LOW', 'GAP-I12-020',
  'No fixture for UNICODE characters in project_description',
  'All fixtures use ASCII-only project descriptions. The system should handle Unicode (CJK, emoji, RTL text) in user input. No fixture tests this.');

finding('LOW', 'GAP-I12-021',
  'No fixture for very large project_description',
  'All fixtures have reasonable-length project descriptions (~200-500 chars). The system should handle very long descriptions (10K+ chars). No fixture tests this boundary.');

finding('LOW', 'GAP-I12-022',
  'No fixture with missing optional fields',
  'All fixtures have all optional fields populated (budget_range, desired_timeline, service_interest, lead_source, utm_*). The system should handle leads with only required fields. No fixture tests this.');

finding('LOW', 'GAP-I12-023',
  'evidence/README.md references v1.0.0 but no version is defined',
  'The README says evidence goes in v1.0.0/ but the synthetic-leads.json is version 1, not 1.0.0. Version numbering is inconsistent.');

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════

console.log('=== Summary ===');
console.log(`CRITICAL: ${critical}`);
console.log(`HIGH: ${high}`);
console.log(`MEDIUM: ${medium}`);
console.log(`LOW: ${low}`);
console.log(`Total findings: ${findings.length}`);

if (critical > 0) {
  console.log('\n⚠️  CRITICAL: No evidence has been generated.');
  console.log('   GAP-I12-001: evidence/ is empty. WF-15 has never been executed.');
  console.log('   AC-11, FR-090, FR-091 cannot be verified without evidence.');
}

process.exit(0);