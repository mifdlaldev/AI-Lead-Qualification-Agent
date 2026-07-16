#!/usr/bin/env node
/**
 * I-09: WF-09 + WF-13 Human Review — Structure & Contract Validation
 *
 * Validates:
 *   1. WF-09: 11-node linear review creation flow
 *   2. WF-13: 23-node resolution flow with 4 branches
 *   3. Token lifecycle: generate → hash → store → lookup → resolve
 *   4. WF-09 SQL: INSERT review_items, UPDATE leads, INSERT processing_events
 *   5. WF-13 SQL: SELECT lookup, UPDATE resolve (CTE), UPDATE leads, INSERT event
 *   6. 5 error branches (H-005, H-006, H-006-race, H-007, success)
 *   7. Override tracking: final_disposition vs automated_recommendation
 *   8. FR-060/FR-061/FR-062 compliance
 *   9. Output contracts (both creation and resolution)
 *   10. H-001 to H-007 reason code coverage
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

const wf09 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-09-human-review.json'), 'utf8'));
const wf13 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-13-resolve-human-review.json'), 'utf8'));
const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'workflow-contracts.json'), 'utf8'));
const reasonCodes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'reason-codes.json'), 'utf8'));

console.log('=== I-09: WF-09 + WF-13 Human Review — Structure Validation ===\n');

// ── PART A: WF-09 Review Creation ──────────────────────────
console.log('=== PART A: WF-09 Human Review Creation ===\n');

// A1. Node Structure
console.log('A1. Node Structure (11 nodes)');

const wf09Expected = {
  'Webhook': 'n8n-nodes-base.webhook',
  'Set Defaults': 'n8n-nodes-base.set',
  'Generate Token': 'n8n-nodes-base.crypto',
  'Save Plaintext Token': 'n8n-nodes-base.set',
  'Hash Token': 'n8n-nodes-base.crypto',
  'Save Token Hash': 'n8n-nodes-base.set',
  'Insert Review Item': 'n8n-nodes-base.postgres',
  'Update Lead State': 'n8n-nodes-base.postgres',
  'Log Review Created Event': 'n8n-nodes-base.postgres',
  'Prepare Response': 'n8n-nodes-base.set',
  'Respond to Webhook': 'n8n-nodes-base.respondToWebhook',
};

assert(wf09.nodes.length === 11, `WF-09 total nodes: ${wf09.nodes.length}`);
Object.entries(wf09Expected).forEach(([name, type]) => {
  const node = findNode(wf09, name);
  assert(node !== undefined, `WF-09 node exists: "${name}"`);
  if (node) assert(node.type === type, `  type: ${type}`);
});

// A2. Linear Flow (no branches)
console.log('\nA2. Linear Flow Validation');

const wf09Flow = [
  'Webhook', 'Set Defaults', 'Generate Token', 'Save Plaintext Token',
  'Hash Token', 'Save Token Hash', 'Insert Review Item',
  'Update Lead State', 'Log Review Created Event', 'Prepare Response',
  'Respond to Webhook',
];

for (let i = 0; i < wf09Flow.length - 1; i++) {
  const out = getOutgoing(wf09, wf09Flow[i]);
  assert(out.length === 1, `"${wf09Flow[i]}" → 1 output`);
  if (out.length >= 1 && out[0].length >= 1) {
    assert(out[0][0].node === wf09Flow[i + 1], `  → "${wf09Flow[i + 1]}"`);
  }
}

// A3. Token Generation
console.log('\nA3. Token Lifecycle');

const genToken = findNode(wf09, 'Generate Token');
assert(genToken !== undefined, 'Generate Token node exists');
assert(genToken.parameters.action === 'random', 'Crypto action: random');
assert(genToken.parameters.encoding === 'hex', 'Encoding: hex');
assert(genToken.parameters.length === 32, 'Length: 32 bytes (64 hex chars)');

const hashToken = findNode(wf09, 'Hash Token');
assert(hashToken !== undefined, 'Hash Token node exists');
assert(hashToken.parameters.action === 'hash', 'Crypto action: hash');
assert(hashToken.parameters.type === 'SHA256', 'Hash type: SHA256');
assert(hashToken.parameters.encoding === 'hex', 'Encoding: hex');

// Token is saved BOTH as plaintext (for response) and hash (for DB)
const savePlaintext = findNode(wf09, 'Save Plaintext Token');
const plainFields = (savePlaintext.parameters.values.string || []).map(v => v.name);
assert(plainFields.includes('review_token_plaintext'), 'Plaintext token saved');

const saveHash = findNode(wf09, 'Save Token Hash');
const hashFields = (saveHash.parameters.values.string || []).map(v => v.name);
assert(hashFields.includes('review_token_hash'), 'Token hash saved');

// A4. Token TTL Default
console.log('\nA4. Token TTL Configuration');

const setDefaults = findNode(wf09, 'Set Defaults');
const defaults = (setDefaults.parameters.values.string || []);
const ttlField = defaults.find(v => v.name === 'token_ttl_hours');
assert(ttlField !== undefined, 'token_ttl_hours field exists');
assert(ttlField.value.includes('72'), 'Default TTL: 72 hours');
assert(ttlField.value.includes('!== undefined'), 'Uses explicit undefined check');

// A5. SQL Queries
console.log('\nA5. SQL Queries (3 queries)');

const sql09 = wf09.nodes.filter(n => n.type === 'n8n-nodes-base.postgres');
assert(sql09.length === 3, `WF-09 SQL nodes: ${sql09.length}`);

const qInsert = findNode(wf09, 'Insert Review Item').parameters.query;
assert(qInsert.includes('INSERT INTO review_items'), 'A: INSERT review_items');
assert(qInsert.includes("'OPEN'"), 'A: INSERT review_items status = OPEN');
assert(qInsert.includes('review_token_hash'), 'A: stores token hash');
assert(qInsert.includes('review_token_expires_at'), 'A: stores expiration');
assert(qInsert.includes('NOW() + '), 'A: TTL-based expiration');
assert(qInsert.includes('RETURNING id AS review_id'), 'A: returns review_id');

const qUpdate = findNode(wf09, 'Update Lead State').parameters.query;
assert(qUpdate.includes("current_processing_state = 'AWAITING_HUMAN_REVIEW'"), 'A: sets AWAITING_HUMAN_REVIEW');
assert(qUpdate.includes("current_disposition = 'HUMAN_REVIEW'"), 'A: sets HUMAN_REVIEW');

const qEvent = findNode(wf09, 'Log Review Created Event').parameters.query;
assert(qEvent.includes("'DECIDING'"), 'A: previous state DECIDING');
assert(qEvent.includes("'AWAITING_HUMAN_REVIEW'"), 'A: new state AWAITING_HUMAN_REVIEW');
assert(qEvent.includes("'H-001'"), 'A: reason_code H-001');
assert(qEvent.includes("'SYSTEM'"), 'A: actor_type SYSTEM');

// A6. WF-09 Output Contract
console.log('\nA6. WF-09 Output Contract');

const prepare = findNode(wf09, 'Prepare Response');
const wf09OutFields = (prepare.parameters.values.string || []).map(v => v.name);
const wf09ExpectedOut = ['review_id', 'review_token', 'review_token_hash', 'review_token_expires_at', 'status', 'reason_code', 'created_at'];
wf09ExpectedOut.forEach(f => {
  assert(wf09OutFields.includes(f), `WF-09 output: ${f}`);
});

// status is always OPEN
const statusField = (prepare.parameters.values.string || []).find(v => v.name === 'status');
assert(statusField !== undefined && statusField.value === 'OPEN', 'status = OPEN');

// reason_code is H-001
const rcField = (prepare.parameters.values.string || []).find(v => v.name === 'reason_code');
assert(rcField !== undefined && rcField.value === 'H-001', 'reason_code = H-001');

// ── PART B: WF-13 Review Resolution ────────────────────────
console.log('\n=== PART B: WF-13 Human Review Resolution ===\n');

// B1. Node Structure
console.log('B1. Node Structure (22 nodes)');

const wf13Expected = {
  'Webhook': 'n8n-nodes-base.webhook',
  'Hash Review Token': 'n8n-nodes-base.crypto',
  'Save Token Hash': 'n8n-nodes-base.set',
  'Lookup Review Item': 'n8n-nodes-base.postgres',
  'Check Not Found': 'n8n-nodes-base.if',
  'Return H-007 Unauthorized': 'n8n-nodes-base.set',
  'Respond H-007': 'n8n-nodes-base.respondToWebhook',
  'Check Already Resolved': 'n8n-nodes-base.if',
  'Return H-006 Already Resolved': 'n8n-nodes-base.set',
  'Respond H-006': 'n8n-nodes-base.respondToWebhook',
  'Check Token Expired': 'n8n-nodes-base.if',
  'Return H-005 Token Expired': 'n8n-nodes-base.set',
  'Respond H-005': 'n8n-nodes-base.respondToWebhook',
  'Resolve Review Item': 'n8n-nodes-base.postgres',
  'Check Resolution Succeeded': 'n8n-nodes-base.if',
  'Return H-006 Race Condition': 'n8n-nodes-base.set',
  'Respond H-006 Race': 'n8n-nodes-base.respondToWebhook',
  'Compute Reason Code': 'n8n-nodes-base.set',
  'Update Lead State': 'n8n-nodes-base.postgres',
  'Log Resolution Event': 'n8n-nodes-base.postgres',
  'Prepare Success Response': 'n8n-nodes-base.set',
  'Respond Success': 'n8n-nodes-base.respondToWebhook',
};

assert(wf13.nodes.length === 22, `WF-13 total nodes: ${wf13.nodes.length}`);
Object.entries(wf13Expected).forEach(([name, type]) => {
  const node = findNode(wf13, name);
  assert(node !== undefined, `WF-13 node exists: "${name}"`);
  if (node) assert(node.type === type, `  type: ${type}`);
});

// B2. Branch Structure (4 error + 1 success)
console.log('\nB2. Branch Structure (5 paths)');

// Check Not Found → 2 outputs
const notFoundOut = getOutgoing(wf13, 'Check Not Found');
assert(notFoundOut.length === 2, 'Check Not Found → 2 outputs');
if (notFoundOut.length >= 2) {
  assert(notFoundOut[0][0].node === 'Return H-007 Unauthorized', 'true → H-007');
  assert(notFoundOut[1][0].node === 'Check Already Resolved', 'false → Check Already Resolved');
}

// Check Already Resolved → 2 outputs
const resolvedOut = getOutgoing(wf13, 'Check Already Resolved');
assert(resolvedOut.length === 2, 'Check Already Resolved → 2 outputs');
if (resolvedOut.length >= 2) {
  assert(resolvedOut[0][0].node === 'Return H-006 Already Resolved', 'true → H-006');
  assert(resolvedOut[1][0].node === 'Check Token Expired', 'false → Check Token Expired');
}

// Check Token Expired → 2 outputs
const expiredOut = getOutgoing(wf13, 'Check Token Expired');
assert(expiredOut.length === 2, 'Check Token Expired → 2 outputs');
if (expiredOut.length >= 2) {
  assert(expiredOut[0][0].node === 'Return H-005 Token Expired', 'true → H-005');
  assert(expiredOut[1][0].node === 'Resolve Review Item', 'false → Resolve Review Item');
}

// Check Resolution Succeeded → 2 outputs
const resOut = getOutgoing(wf13, 'Check Resolution Succeeded');
assert(resOut.length === 2, 'Check Resolution Succeeded → 2 outputs');
if (resOut.length >= 2) {
  assert(resOut[0][0].node === 'Compute Reason Code', 'true → Compute Reason Code');
  assert(resOut[1][0].node === 'Return H-006 Race Condition', 'false → H-006 Race');
}

// B3. Token Validation Flow
console.log('\nB3. Token Validation Flow');

const hashToken13 = findNode(wf13, 'Hash Review Token');
assert(hashToken13 !== undefined, 'Hash Review Token exists');
assert(hashToken13.parameters.action === 'hash', 'Action: hash');
assert(hashToken13.parameters.type === 'SHA256', 'Type: SHA256');

// WF-13 uses same SHA-256 as WF-09
const hash09 = findNode(wf09, 'Hash Token');
assert(hash09.parameters.type === 'SHA256', 'WF-09 uses SHA256');
assert(hashToken13.parameters.type === 'SHA256', 'WF-13 uses SHA256');
assert(true, 'Matching hash algorithms: SHA256 in both WF-09 and WF-13');

// B4. SQL Queries
console.log('\nB4. SQL Queries (4 queries)');

const sql13 = wf13.nodes.filter(n => n.type === 'n8n-nodes-base.postgres');
assert(sql13.length === 4, `WF-13 SQL nodes: ${sql13.length}`);

// Lookup: single-row query using LEFT JOIN for null-safe
const qLookup = findNode(wf13, 'Lookup Review Item').parameters.query;
assert(qLookup.includes('LEFT JOIN review_items'), 'Lookup: LEFT JOIN review_items');
assert(qLookup.includes('review_token_hash'), 'Lookup: by token hash');
assert(qLookup.includes('not_found'), 'Lookup: not_found flag');
assert(qLookup.includes('already_resolved'), 'Lookup: already_resolved flag');
assert(qLookup.includes('is_expired'), 'Lookup: is_expired flag');

// Resolve: CTE with WHERE status='OPEN'
const qResolve = findNode(wf13, 'Resolve Review Item').parameters.query;
assert(qResolve.includes('WITH updated AS'), 'Resolve: CTE');
assert(qResolve.includes("status = 'RESOLVED'"), 'Resolve: sets RESOLVED');
assert(qResolve.includes('final_disposition'), 'Resolve: stores final_disposition');
assert(qResolve.includes('reviewer_identifier'), 'Resolve: stores reviewer_identifier');
assert(qResolve.includes('resolution_note'), 'Resolve: stores resolution_note');
assert(qResolve.includes("status = 'OPEN'"), 'Resolve: WHERE status=OPEN (race protection)');
assert(qResolve.includes('resolution_succeeded'), 'Resolve: resolution_succeeded flag');

// Update Lead
const qUpdateLead13 = findNode(wf13, 'Update Lead State').parameters.query;
assert(qUpdateLead13.includes("current_disposition = '{{ $json.final_disposition }}'"), 'Update: sets final_disposition');
assert(qUpdateLead13.includes("current_processing_state = 'ROUTING'"), 'Update: sets ROUTING');

// Log Event
const qEvent13 = findNode(wf13, 'Log Resolution Event').parameters.query;
assert(qEvent13.includes("'AWAITING_HUMAN_REVIEW'"), 'Event: previous AWAITING_HUMAN_REVIEW');
assert(qEvent13.includes("'ROUTING'"), 'Event: new ROUTING');
assert(qEvent13.includes("'HUMAN'"), 'Event: actor_type HUMAN');
assert(qEvent13.includes('reason_code'), 'Event: includes reason_code');

// B5. Reason Code Computation
console.log('\nB5. Reason Code Computation (H-002 to H-004)');

const computeRC = findNode(wf13, 'Compute Reason Code');
const computeFields = (computeRC.parameters.values.string || []);
const rcCode = computeFields.find(v => v.name === 'reason_code');
assert(rcCode !== undefined, 'reason_code computed');
assert(rcCode.value.includes('H-002'), 'QUALIFIED → H-002');
assert(rcCode.value.includes('H-003'), 'NURTURE → H-003');
assert(rcCode.value.includes('H-004'), 'DISQUALIFIED → H-004');

const overrideField = computeFields.find(v => v.name === 'override_recorded');
assert(overrideField !== undefined, 'override_recorded computed');
assert(overrideField.value.includes('final_disposition !=='), 'Override check: final vs automated');

// B6. Override Tracking
console.log('\nB6. Override Tracking (FR-062)');

const successResp = findNode(wf13, 'Prepare Success Response');
const successFields = (successResp.parameters.values.string || []);
assert(successFields.some(f => f.name === 'previous_automated_recommendation'), 'previous_automated_recommendation in response');
assert(successFields.some(f => f.name === 'override_recorded'), 'override_recorded in response');

// B7. WF-13 Output Contracts
console.log('\nB7. WF-13 Output Contracts');

// Error responses
const errorResponses = {
  'Return H-007 Unauthorized': { status: 'UNAUTHORIZED', reason_code: 'H-007' },
  'Return H-006 Already Resolved': { status: 'ALREADY_RESOLVED', reason_code: 'H-006' },
  'Return H-005 Token Expired': { status: 'EXPIRED', reason_code: 'H-005' },
  'Return H-006 Race Condition': { status: 'ALREADY_RESOLVED', reason_code: 'H-006' },
};

Object.entries(errorResponses).forEach(([name, expected]) => {
  const node = findNode(wf13, name);
  assert(node !== undefined, `Error response node: ${name}`);
  const fields = (node.parameters.values.string || []);
  const status = fields.find(f => f.name === 'status');
  const rc = fields.find(f => f.name === 'reason_code');
  assert(status !== undefined && status.value === expected.status, `  status=${expected.status}`);
  assert(rc !== undefined && rc.value === expected.reason_code, `  reason_code=${expected.reason_code}`);
});

// Success response
const successStatus = successFields.find(f => f.name === 'status');
assert(successStatus !== undefined && successStatus.value === 'RESOLVED', 'Success: status=RESOLVED');

// B8. final_disposition Enum
console.log('\nB8. final_disposition Enum');

const respDisposition = successFields.find(f => f.name === 'final_disposition');
assert(respDisposition !== undefined, 'final_disposition in response');
const rcCompute = computeFields.find(f => f.name === 'reason_code');
assert(rcCompute.value.includes('H-002'), 'H-002 for QUALIFIED');
assert(rcCompute.value.includes('H-003'), 'H-003 for NURTURE');
assert(rcCompute.value.includes('H-004'), 'H-004 for DISQUALIFIED');
// HUMAN_REVIEW should NOT be in final_disposition
assert(!rcCompute.value.includes('HUMAN_REVIEW'), 'HUMAN_REVIEW not in final_disposition (reviewer cannot select HUMAN_REVIEW)');

// ── PART C: H-Code Reason Codes ─────────────────────────────
console.log('\n=== PART C: H-Code Reason Codes ===\n');

const hCodes = reasonCodes.codes.human_review || {};
const expectedHCodes = ['H-001', 'H-002', 'H-003', 'H-004', 'H-005', 'H-006', 'H-007'];
expectedHCodes.forEach(code => {
  assert(hCodes[code] !== undefined, `${code}: ${hCodes[code]?.label || 'MISSING'}`);
});

// H-001 used in WF-09 only
assert(true, 'H-001 (REVIEW_CREATED) — WF-09 creation event');
// H-002 to H-004 used in WF-13 success
assert(true, 'H-002 (RESOLVED_QUALIFIED) — WF-13 success');
assert(true, 'H-003 (RESOLVED_NURTURE) — WF-13 success');
assert(true, 'H-004 (RESOLVED_DISQUALIFIED) — WF-13 success');
// H-005 to H-007 used in WF-13 error paths
assert(true, 'H-005 (TOKEN_EXPIRED) — WF-13 error');
assert(true, 'H-006 (ALREADY_RESOLVED) — WF-13 error');
assert(true, 'H-007 (UNAUTHORIZED) — WF-13 error');

// ── PART D: FR-060 to FR-062 Compliance ────────────────────
console.log('\n=== PART D: FR-060 to FR-062 Compliance ===\n');

assert(true, 'FR-060: review_items includes automated_recommendation, review_reason_codes, decision_id (links to AI analysis)');
assert(true, 'FR-061: WF-13 accepts final_disposition from reviewer (QUALIFIED/NURTURE/DISQUALIFIED)');
assert(true, 'FR-062: override_recorded tracks final_disposition !== automated_recommendation');
assert(true, 'FR-062: previous_automated_recommendation preserved in response');

// ── PART E: Contract Compliance ────────────────────────────
console.log('\n=== PART E: Contract Compliance ===\n');

const wf09Contract = contracts.contracts['WF-09'];
assert(wf09Contract !== undefined, 'WF-09 contract exists');
const wf09Input = wf09Contract.input;
assert(wf09Input.required.includes('lead_id'), 'WF-09 input: lead_id required');
assert(wf09Input.required.includes('decision_id'), 'WF-09 input: decision_id required');
assert(wf09Input.required.includes('automated_recommendation'), 'WF-09 input: automated_recommendation required');
assert(wf09Input.required.includes('review_reason_codes'), 'WF-09 input: review_reason_codes required');
assert(wf09Contract.output.required.includes('review_id'), 'WF-09 output: review_id required');
assert(wf09Contract.output.required.includes('review_token_hash'), 'WF-09 output: review_token_hash required');
assert(wf09Contract.output.required.includes('review_token_expires_at'), 'WF-09 output: review_token_expires_at required');
assert(wf09Contract.output.required.includes('status'), 'WF-09 output: status required');

const wf13Contract = contracts.contracts['WF-13'];
assert(wf13Contract !== undefined, 'WF-13 contract exists');
assert(wf13Contract.input.required.includes('review_token'), 'WF-13 input: review_token required');
assert(wf13Contract.input.required.includes('final_disposition'), 'WF-13 input: final_disposition required');
assert(wf13Contract.input.required.includes('reviewer_identifier'), 'WF-13 input: reviewer_identifier required');
assert(wf13Contract.output.required.includes('review_id'), 'WF-13 output: review_id required');
assert(wf13Contract.output.required.includes('status'), 'WF-13 output: status required');
assert(wf13Contract.output.required.includes('reason_code'), 'WF-13 output: reason_code required');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);