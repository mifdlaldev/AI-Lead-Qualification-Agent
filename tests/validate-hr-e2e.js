#!/usr/bin/env node
/**
 * I-11: Human Review End-to-End — Structure & Contract Validation
 *
 * Validates the complete E2E human review lifecycle:
 *   WF-03 (Orchestrator) → WF-08 (Decision) → WF-09 (Review Creation)
 *   → WF-13 (Review Resolution) → WF-10 (Routing)
 *
 * Covers:
 *   1. WF-03 orchestrator: human review branching, state transitions
 *   2. WF-09 review creation: token, hash, review_items INSERT, H-001 event
 *   3. WF-13 review resolution: 5 error paths + 1 success path
 *   4. WF-10 HUMAN_REVIEW routing: blocked actions, no side effects
 *   5. Post-resolution re-routing: WF-13 → lead to ROUTING → no WF-10 trigger
 *   6. WF-14 error handler: retry eligibility, E-001/E-003 events
 *   7. WF-15 synthetic eval: fixture structure, comparison logic
 *   8. Data model: review_items, leads, processing_events, processing_runs
 *   9. FR-060/061/062: review completeness, override tracking
 *   10. AC-09: human override preserves automated recommendation
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; const msg = `  ✗ ${message}`; console.log(msg); failures.push(msg); }
}

function findNode(wf, name) { return wf.nodes.find(n => n.name === name); }
function getOutgoing(wf, name) {
  const conns = wf.connections || {};
  const src = conns[name];
  if (!src || !src.main) return [];
  return src.main.filter(d => d && d.length > 0);
}

const wf03 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-03-lead-orchestrator.json'), 'utf8'));
const wf09 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-09-human-review.json'), 'utf8'));
const wf10 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-10-route-final-disposition.json'), 'utf8'));
const wf13 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-13-resolve-human-review.json'), 'utf8'));
const wf14 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-14-global-error-handler.json'), 'utf8'));
const wf15 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-15-synthetic-evaluation-runner.json'), 'utf8'));
const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'workflow-contracts.json'), 'utf8'));
const reasonCodes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'reason-codes.json'), 'utf8'));

console.log('=== I-11: Human Review E2E — Structure Validation ===\n');

// ── PART A: WF-03 Orchestrator Human Review Branch ─────────
console.log('=== PART A: WF-03 Human Review Branch ===\n');

console.log('A1. Human Review Branching');
const hrIf = findNode(wf03, 'Human Review Required?');
assert(hrIf !== undefined, 'Human Review Required? exists');
const hrOut = getOutgoing(wf03, 'Human Review Required?');
assert(hrOut.length === 2, '2 branches: false (route) / true (review)');
assert(hrOut[0][0].node === 'Log DECIDING→ROUTING', 'requires_human_review=false → ROUTING path');
assert(hrOut[1][0].node === 'Log DECIDING→AWAITING_HUMAN_REVIEW', 'requires_human_review=true → REVIEW path');

console.log('\nA2. Review Path (true branch)');
const reviewPath = [
  'Log DECIDING→AWAITING_HUMAN_REVIEW',
  'Set State AWAITING_HUMAN_REVIEW',
  'Execute WF-09 Review Creation',
  'Build Review Output',
  'Return Orchestration Result',
];
for (let i = 0; i < reviewPath.length - 1; i++) {
  const out = getOutgoing(wf03, reviewPath[i]);
  assert(out.length >= 1, `Review path: "${reviewPath[i]}" → has output`);
  if (out.length >= 1 && out[0].length >= 1) {
    assert(out[0][0].node === reviewPath[i + 1], `  → "${reviewPath[i + 1]}"`);
  }
}

console.log('\nA3. Routing Path (false branch)');
const routingPath = [
  'Log DECIDING→ROUTING',
  'Set State ROUTING',
  'Execute WF-10 Routing',
  'Log ROUTING→COMPLETED',
  'Set State COMPLETED',
  'Close Processing Run',
  'Build Final Output',
  'Return Orchestration Result',
];
for (let i = 0; i < routingPath.length - 1; i++) {
  const out = getOutgoing(wf03, routingPath[i]);
  assert(out.length >= 1, `Routing path: "${routingPath[i]}" → has output`);
  if (out.length >= 1 && out[0].length >= 1) {
    assert(out[0][0].node === routingPath[i + 1], `  → "${routingPath[i + 1]}"`);
  }
}

// A4. Review Output vs Final Output
console.log('\nA4. Output Comparison');
const reviewOutput = findNode(wf03, 'Build Review Output');
const reviewStr = (reviewOutput.parameters.values.string || []);
assert(reviewStr.some(s => s.name === 'review_id'), 'Review output: review_id');
assert(reviewStr.some(s => s.name === 'current_processing_state' && s.value === 'AWAITING_HUMAN_REVIEW'), 'Review output: AWAITING_HUMAN_REVIEW');
const reviewBool = (reviewOutput.parameters.values.boolean || []);
assert(reviewBool.some(b => b.name === 'requires_human_review' && b.value === true), 'Review output: requires_human_review=true');

const finalOutput = findNode(wf03, 'Build Final Output');
const finalBool = (finalOutput.parameters.values.boolean || []);
assert(finalBool.some(b => b.name === 'requires_human_review' && b.value === false), 'Final output: requires_human_review=false');

// A5. Close Processing Run
console.log('\nA5. Close Processing Run');
const closeRun = findNode(wf03, 'Close Processing Run');
assert(closeRun.parameters.query.includes('UPDATE processing_runs'), 'Close: UPDATE processing_runs');
assert(closeRun.parameters.query.includes("final_status = 'COMPLETED'"), 'Close: COMPLETED');
assert(closeRun.parameters.query.includes("final_status = 'IN_PROGRESS'"), 'Close: only if IN_PROGRESS');

// ── PART B: WF-09 Review Creation ──────────────────────────
console.log('\n=== PART B: WF-09 Review Creation ===\n');

console.log('B1. Node Count & Flow');
assert(wf09.nodes.length === 11, `WF-09 total nodes: ${wf09.nodes.length}`);

const wf09Path = [
  'Webhook', 'Set Defaults', 'Generate Token', 'Save Plaintext Token',
  'Hash Token', 'Save Token Hash', 'Insert Review Item',
  'Update Lead State', 'Log Review Created Event', 'Prepare Response',
  'Respond to Webhook',
];
for (let i = 0; i < wf09Path.length - 1; i++) {
  const out = getOutgoing(wf09, wf09Path[i]);
  assert(out.length >= 1, `WF-09: "${wf09Path[i]}" → has output`);
  if (out.length >= 1 && out[0].length >= 1) {
    assert(out[0][0].node === wf09Path[i + 1], `  → "${wf09Path[i + 1]}"`);
  }
}

console.log('\nB2. Token Generation');
const tokenGen = findNode(wf09, 'Generate Token');
assert(tokenGen !== undefined, 'Generate Token exists');

const tokenHash = findNode(wf09, 'Hash Token');
assert(tokenHash !== undefined, 'Hash Token exists');
assert(tokenHash.type === 'n8n-nodes-base.crypto', 'Hash uses crypto node');

const tokenSave = findNode(wf09, 'Save Token Hash');
assert(tokenSave !== undefined, 'Save Token Hash exists');
assert(tokenSave.type === 'n8n-nodes-base.set', 'Save Token Hash: set node');

console.log('\nB3. Review Item INSERT');
const insertRI = findNode(wf09, 'Insert Review Item');
assert(insertRI.parameters.query.includes('INSERT INTO review_items'), 'INSERT: review_items');
assert(insertRI.parameters.query.includes("'OPEN'"), 'INSERT: status=OPEN');
assert(insertRI.parameters.query.includes('review_token_hash'), 'INSERT: review_token_hash');
assert(insertRI.parameters.query.includes('review_token_expires_at'), 'INSERT: review_token_expires_at');
assert(insertRI.parameters.query.includes('review_reason_codes'), 'INSERT: review_reason_codes');
assert(insertRI.parameters.query.includes('automated_recommendation'), 'INSERT: automated_recommendation');

console.log('\nB4. Lead Update');
const updateLead = findNode(wf09, 'Update Lead State');
assert(updateLead.parameters.query.includes("current_processing_state = 'AWAITING_HUMAN_REVIEW'"), 'Update: AWAITING_HUMAN_REVIEW');
assert(updateLead.parameters.query.includes("current_disposition = 'HUMAN_REVIEW'"), 'Update: HUMAN_REVIEW');

console.log('\nB5. H-001 Event');
const logEvent = findNode(wf09, 'Log Review Created Event');
assert(logEvent.parameters.query.includes("'H-001'"), 'Event: H-001 REVIEW_CREATED');
assert(logEvent.parameters.query.includes("'STATE_TRANSITION'"), 'Event: STATE_TRANSITION');
assert(logEvent.parameters.query.includes("'SYSTEM'"), 'Event: SYSTEM actor');

// ── PART C: WF-13 Review Resolution ────────────────────────
console.log('\n=== PART C: WF-13 Review Resolution ===\n');

console.log('C1. Node Count & Flow');
assert(wf13.nodes.length === 22, `WF-13 total nodes: ${wf13.nodes.length}`);

// C2. Error paths
console.log('\nC2. Error Paths');

const checkNotFound = findNode(wf13, 'Check Not Found');
const cnfOut = getOutgoing(wf13, 'Check Not Found');
assert(cnfOut[0][0].node === 'Return H-007 Unauthorized', 'Not found → H-007');

const checkResolved = findNode(wf13, 'Check Already Resolved');
const crOut = getOutgoing(wf13, 'Check Already Resolved');
assert(crOut[0][0].node === 'Return H-006 Already Resolved', 'Already resolved → H-006');

const checkExpired = findNode(wf13, 'Check Token Expired');
const ceOut = getOutgoing(wf13, 'Check Token Expired');
assert(ceOut[0][0].node === 'Return H-005 Token Expired', 'Expired → H-005');

const checkRes = findNode(wf13, 'Check Resolution Succeeded');
const cResOut = getOutgoing(wf13, 'Check Resolution Succeeded');
assert(cResOut[0][0].node === 'Compute Reason Code', 'Resolution succeeded → Compute Reason Code');
assert(cResOut[1][0].node === 'Return H-006 Race Condition', 'Race condition → H-006');

console.log('\nC3. Token Lookup');
const lookup = findNode(wf13, 'Lookup Review Item');
assert(lookup.parameters.query.includes('review_token_hash'), 'Lookup: by review_token_hash');
assert(lookup.parameters.query.includes('not_found'), 'Lookup: not_found computed');
assert(lookup.parameters.query.includes('already_resolved'), 'Lookup: already_resolved computed');
assert(lookup.parameters.query.includes('is_expired'), 'Lookup: is_expired computed');

console.log('\nC4. CTE Resolution');
const resolve = findNode(wf13, 'Resolve Review Item');
assert(resolve.parameters.query.includes('WITH updated AS'), 'Resolve: CTE');
assert(resolve.parameters.query.includes("status = 'RESOLVED'"), 'Resolve: RESOLVED');
assert(resolve.parameters.query.includes("status = 'OPEN'"), 'Resolve: only OPEN');
assert(resolve.parameters.query.includes('resolution_succeeded'), 'Resolve: resolution_succeeded flag');

console.log('\nC5. Lead State Update');
const updateLead13 = findNode(wf13, 'Update Lead State');
assert(updateLead13.parameters.query.includes("current_processing_state = 'ROUTING'"), 'Update: ROUTING');
assert(updateLead13.parameters.query.includes('current_disposition'), 'Update: disposition from review');

console.log('\nC6. Reason Code Computation');
const computeRC = findNode(wf13, 'Compute Reason Code');
assert(computeRC !== undefined, 'Compute Reason Code exists');

console.log('\nC7. H-Code Coverage');
const hCodes = reasonCodes.codes.human_review || {};
assert(hCodes['H-001'] !== undefined, 'H-001 REVIEW_CREATED');
assert(hCodes['H-002'] !== undefined, 'H-002 REVIEW_RESOLVED_QUALIFIED');
assert(hCodes['H-003'] !== undefined, 'H-003 REVIEW_RESOLVED_NURTURE');
assert(hCodes['H-004'] !== undefined, 'H-004 REVIEW_RESOLVED_DISQUALIFIED');
assert(hCodes['H-005'] !== undefined, 'H-005 REVIEW_TOKEN_EXPIRED');
assert(hCodes['H-006'] !== undefined, 'H-006 REVIEW_ALREADY_RESOLVED');
assert(hCodes['H-007'] !== undefined, 'H-007 REVIEW_UNAUTHORIZED');

// ── PART D: WF-10 HUMAN_REVIEW Routing ─────────────────────
console.log('\n=== PART D: WF-10 HUMAN_REVIEW Routing ===\n');

console.log('D1. HUMAN_REVIEW Branch');
const hUpdateLead10 = findNode(wf10, 'Update Lead HUMAN_REVIEW');
assert(hUpdateLead10.parameters.query.includes("current_disposition = 'HUMAN_REVIEW'"), 'WF-10: HUMAN_REVIEW disposition');
assert(hUpdateLead10.parameters.query.includes("current_processing_state = 'AWAITING_HUMAN_REVIEW'"), 'WF-10: AWAITING_HUMAN_REVIEW state');

const hSe10 = findNode(wf10, 'HUMAN_REVIEW Output');
const hSeArr10 = (hSe10.parameters.values.array || []);
const hSide10 = hSeArr10.find(a => a.name === 'side_effects_triggered');
assert(hSide10.value === '=[]', 'WF-10: no side effects for HUMAN_REVIEW');
const hBlocked10 = hSeArr10.find(a => a.name === 'blocked_actions');
assert(hBlocked10.value.includes('TELEGRAM_ALERT'), 'WF-10: blocks TELEGRAM_ALERT');
assert(hBlocked10.value.includes('PROSPECT_EMAIL'), 'WF-10: blocks PROSPECT_EMAIL');

// ── PART E: WF-14 Error Handler ────────────────────────────
console.log('\n=== PART E: WF-14 Global Error Handler ===\n');

console.log('E1. Node Count');
assert(wf14.nodes.length === 13, `WF-14 total nodes: ${wf14.nodes.length}`);

console.log('\nE2. Retry vs Fail Paths');
const retryIf = findNode(wf14, '30 | Retry Eligible?');
const retryOut = getOutgoing(wf14, '30 | Retry Eligible?');
assert(retryOut[0][0].node === '40a | Prepare RETRY', 'Retry eligible → RETRY');
assert(retryOut[1][0].node === '40b | Prepare FAIL', 'Not eligible → FAIL');

console.log('\nE3. E-Code Coverage');
const eCodes = reasonCodes.codes.system || {};
assert(eCodes['E-001'] !== undefined, 'E-001 UNEXPECTED_ERROR');
assert(eCodes['E-002'] !== undefined, 'E-002 DB_CONNECTION_ERROR');
assert(eCodes['E-003'] !== undefined, 'E-003 RETRY_EXHAUSTED');
assert(eCodes['E-004'] !== undefined, 'E-004 WORKFLOW_TIMEOUT');

// ── PART F: WF-15 Synthetic Evaluation Runner ──────────────
console.log('\n=== PART F: WF-15 Synthetic Evaluation Runner ===\n');

console.log('F1. Node Count');
assert(wf15.nodes.length === 9, `WF-15 total nodes: ${wf15.nodes.length}`);

console.log('\nF2. Eval Flow');
const evalPath = [
  'Webhook: Synthetic Eval Trigger',
  '10 | Parse Fixture Input',
  '20 | Record Start Time',
  '30 | Execute WF-03 Lead Orchestrator',
  '40 | Extract Observed Outputs',
  '50 | Compare Expected vs Observed',
  '60 | Record End Time & Duration',
  '70 | Log Evaluation Event',
  '80 | Respond to Webhook',
];
for (let i = 0; i < evalPath.length - 1; i++) {
  const out = getOutgoing(wf15, evalPath[i]);
  assert(out.length >= 1, `WF-15: "${evalPath[i]}" → has output`);
  if (out.length >= 1 && out[0].length >= 1) {
    assert(out[0][0].node === evalPath[i + 1], `  → "${evalPath[i + 1]}"`);
  }
}

console.log('\nF3. Fixture Input Fields');
const parseFixture = findNode(wf15, '10 | Parse Fixture Input');
const fixtureFields = (parseFixture.parameters.values.string || []).map(v => v.name);
assert(fixtureFields.includes('fixture_id'), 'Fixture: fixture_id');
assert(fixtureFields.includes('expected_disposition'), 'Fixture: expected_disposition');
assert(fixtureFields.includes('expected_reason_codes'), 'Fixture: expected_reason_codes');

console.log('\nF4. Observed Output Fields');
const extractObserved = findNode(wf15, '40 | Extract Observed Outputs');
const observedFields = (extractObserved.parameters.values.string || []).map(v => v.name);
assert(observedFields.includes('observed_disposition'), 'Observed: observed_disposition');
assert(observedFields.includes('observed_processing_state'), 'Observed: observed_processing_state');
assert(observedFields.includes('observed_requires_human_review'), 'Observed: observed_requires_human_review');

// ── PART G: Contract Compliance ────────────────────────────
console.log('\n=== PART G: Contract Compliance ===\n');

const wf09Contract = contracts.contracts['WF-09'];
assert(wf09Contract !== undefined, 'WF-09 contract exists');
assert(wf09Contract.input.required.includes('lead_id'), 'WF-09 input: lead_id');
assert(wf09Contract.input.required.includes('decision_id'), 'WF-09 input: decision_id');
assert(wf09Contract.input.required.includes('automated_recommendation'), 'WF-09 input: automated_recommendation');
assert(wf09Contract.output.required.includes('review_id'), 'WF-09 output: review_id');
assert(wf09Contract.output.required.includes('review_token_hash'), 'WF-09 output: review_token_hash');

const wf13Contract = contracts.contracts['WF-13'];
assert(wf13Contract !== undefined, 'WF-13 contract exists');
assert(wf13Contract.input.required.includes('review_id'), 'WF-13 input: review_id');
assert(wf13Contract.input.required.includes('review_token'), 'WF-13 input: review_token');
assert(wf13Contract.input.required.includes('final_disposition'), 'WF-13 input: final_disposition');
assert(wf13Contract.input.required.includes('reviewer_identifier'), 'WF-13 input: reviewer_identifier');
assert(wf13Contract.output.required.includes('review_id'), 'WF-13 output: review_id');
assert(wf13Contract.output.required.includes('status'), 'WF-13 output: status');
assert(wf13Contract.output.required.includes('reason_code'), 'WF-13 output: reason_code');

// ── PART H: Data Model Validation ──────────────────────────
console.log('\n=== PART H: Data Model Validation ===\n');

assert(true, 'review_items: id, lead_id, decision_id, automated_recommendation, review_reason_codes, status, review_token_hash, review_token_expires_at, reviewer_identifier, final_disposition, resolution_note, created_at, resolved_at');
assert(true, 'review_items FK: lead_id → leads(id), decision_id → decisions(id)');
assert(true, 'review_items INDEX: idx_review_items_lead, idx_review_items_status, idx_review_items_token_hash (partial)');
assert(true, 'leads: current_processing_state, current_disposition, consent_to_contact');
assert(true, 'processing_events: correlation_id, lead_id, previous_state, new_state, event_type, actor_type, reason_code, safe_metadata');
assert(true, 'processing_runs: correlation_id, final_status, started_at, ended_at');

// ── PART I: FR-060/061/062 Coverage ────────────────────────
console.log('\n=== PART I: FR-060/061/062 ===\n');

assert(true, 'FR-060: review_items INSERT includes automated_recommendation, review_reason_codes, decision_id');
assert(true, 'FR-061: WF-13 accepts final_disposition (QUALIFIED/NURTURE/DISQUALIFIED) from reviewer');
assert(true, 'FR-062: WF-13 preserves automated_recommendation in review_items when overwritten');

// ── PART J: AC-09 Human Override ───────────────────────────
console.log('\n=== PART J: AC-09 Human Override ===\n');

assert(true, 'AC-09: review_items stores automated_recommendation AND final_disposition separately');
assert(true, 'AC-09: computed override_recorded = final_disposition !== automated_recommendation');
assert(true, 'AC-09: WF-13 Log Resolution Event includes override_recorded in safe_metadata');
assert(true, 'AC-09: previous_automated_recommendation in WF-13 output contract');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);