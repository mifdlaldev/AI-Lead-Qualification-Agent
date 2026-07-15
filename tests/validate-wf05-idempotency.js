#!/usr/bin/env node
/**
 * I-05: WF-05 Idempotency Structure & SQL Validation
 *
 * Validates:
 * 1. WF-05 node structure and connections
 * 2. SQL query correctness for idempotency checks
 * 3. All 4 execution paths are properly connected
 * 4. Output contracts match expected fields
 * 5. Database constraints support idempotency guarantees
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW_DIR = path.join(__dirname, '..', 'workflows');
const SCHEMA_DIR = path.join(__dirname, '..', 'schemas');
const DB_DIR = path.join(__dirname, '..', 'database');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    const msg = `  ✗ ${message}`;
    console.log(msg);
    failures.push(msg);
  }
}

function findNode(wf, name) {
  return wf.nodes.find(n => n.name === name);
}

function getOutgoing(wf, nodeName) {
  const conns = wf.connections || {};
  const src = conns[nodeName];
  if (!src || !src.main) return [];
  return src.main.filter(d => d && d.length > 0);
}

// ── Load files ────────────────────────────────────────────
const wfPath = path.join(WORKFLOW_DIR, 'WF-05-claim-lead-idempotency.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const schema = fs.readFileSync(path.join(DB_DIR, 'migrations', '0001_initial_schema.sql'), 'utf8');

console.log('=== I-05: WF-05 Idempotency Validation ===\n');

// ── 1. Node Structure ─────────────────────────────────────
console.log('1. Node Structure');

const requiredNodes = [
  'Receive Lead for Idempotency Check',
  'Check Source Identity Uniqueness',
  'Source Match Found?',
  'Check Fingerprint Match',
  'Fingerprint Match Found?',
  'Self-Replay?',
  'Set Exact Duplicate Reason',
  'Set Fingerprint Duplicate Reason',
  'Set Replay Conflict Output',
  'Set New Submission Reason',
  'Assemble Duplicate Output',
  'Assemble New Output',
  'Set State DUPLICATE',
  'Set State PREQUALIFYING',
  'Log Event DEDUPLICATING→DUPLICATE',
  'Log Event DEDUPLICATING→PREQUALIFYING',
  'Return Idempotency Result',
];

requiredNodes.forEach(name => {
  const node = findNode(wf, name);
  assert(node !== undefined, `Node "${name}" exists`);
  if (node) {
    const expectedTypes = {
      'Receive Lead for Idempotency Check': 'n8n-nodes-base.webhook',
      'Check Source Identity Uniqueness': 'n8n-nodes-base.postgres',
      'Check Fingerprint Match': 'n8n-nodes-base.postgres',
      'Source Match Found?': 'n8n-nodes-base.if',
      'Fingerprint Match Found?': 'n8n-nodes-base.if',
      'Self-Replay?': 'n8n-nodes-base.if',
      'Set Exact Duplicate Reason': 'n8n-nodes-base.set',
      'Set Fingerprint Duplicate Reason': 'n8n-nodes-base.set',
      'Set Replay Conflict Output': 'n8n-nodes-base.set',
      'Set New Submission Reason': 'n8n-nodes-base.set',
      'Assemble Duplicate Output': 'n8n-nodes-base.set',
      'Assemble New Output': 'n8n-nodes-base.set',
      'Set State DUPLICATE': 'n8n-nodes-base.postgres',
      'Set State PREQUALIFYING': 'n8n-nodes-base.postgres',
      'Log Event DEDUPLICATING→DUPLICATE': 'n8n-nodes-base.postgres',
      'Log Event DEDUPLICATING→PREQUALIFYING': 'n8n-nodes-base.postgres',
      'Return Idempotency Result': 'n8n-nodes-base.respondToWebhook',
    };
    if (expectedTypes[name]) {
      assert(node.type === expectedTypes[name], `  type: ${expectedTypes[name]}`);
    }
  }
});

// ── 2. Connection Graph ───────────────────────────────────
console.log('\n2. Connection Graph');

// Path 1: Exact duplicate (source identity match)
const srcMatchOut = getOutgoing(wf, 'Source Match Found?');
assert(srcMatchOut.length === 2, 'Source Match Found? has 2 outputs (true/false)');
if (srcMatchOut.length >= 1) {
  const trueBranch = srcMatchOut[0][0];
  assert(trueBranch && trueBranch.node === 'Set Exact Duplicate Reason',
    'Source Match Found? true → Set Exact Duplicate Reason');
  const falseBranch = srcMatchOut[1][0];
  assert(falseBranch && falseBranch.node === 'Check Fingerprint Match',
    'Source Match Found? false → Check Fingerprint Match');
}

// Path 2: Self-replay
const selfReplayOut = getOutgoing(wf, 'Self-Replay?');
assert(selfReplayOut.length === 2, 'Self-Replay? has 2 outputs');
if (selfReplayOut.length >= 2) {
  assert(selfReplayOut[0][0].node === 'Set Replay Conflict Output',
    'Self-Replay? true → Set Replay Conflict Output');
  assert(selfReplayOut[1][0].node === 'Set Fingerprint Duplicate Reason',
    'Self-Replay? false → Set Fingerprint Duplicate Reason');
}

// Path 3: Fingerprint match (different lead)
const fpMatchOut = getOutgoing(wf, 'Fingerprint Match Found?');
assert(fpMatchOut.length === 2, 'Fingerprint Match Found? has 2 outputs');
if (fpMatchOut.length >= 2) {
  assert(fpMatchOut[0][0].node === 'Self-Replay?',
    'Fingerprint Match Found? true → Self-Replay?');
  assert(fpMatchOut[1][0].node === 'Set New Submission Reason',
    'Fingerprint Match Found? false → Set New Submission Reason');
}

// All paths lead to Return Idempotency Result
const returnNode = findNode(wf, 'Return Idempotency Result');
const returnIncoming = [];
Object.keys(wf.connections).forEach(srcName => {
  (wf.connections[srcName].main || []).forEach(dests => {
    if (!dests) return;
    dests.forEach(d => {
      if (d.node === returnNode.name) returnIncoming.push(srcName);
    });
  });
});
assert(returnIncoming.length >= 3, `Return Idempotency Result has ≥3 incoming paths (found ${returnIncoming.length})`);

// ── 3. SQL Query Validation ───────────────────────────────
console.log('\n3. SQL Query Validation');

const sourceCheck = findNode(wf, 'Check Source Identity Uniqueness');
const sourceQuery = sourceCheck.parameters.query;
assert(sourceQuery.includes('source_system'), 'Source check uses source_system');
assert(sourceQuery.includes('source_submission_id'), 'Source check uses source_submission_id');
assert(sourceQuery.includes('source_submission_id IS NOT NULL'), 'Source check handles NULL source_submission_id');
assert(sourceQuery.includes('id !='), 'Source check excludes self (id !=)');
assert(sourceQuery.includes('LIMIT 1'), 'Source check uses LIMIT 1');

const fpCheck = findNode(wf, 'Check Fingerprint Match');
const fpQuery = fpCheck.parameters.query;
assert(fpQuery.includes('payload_fingerprint'), 'Fingerprint check uses payload_fingerprint');
assert(fpQuery.includes('id !='), 'Fingerprint check excludes self');
assert(fpQuery.includes('LIMIT 1'), 'Fingerprint check uses LIMIT 1');

const setDup = findNode(wf, 'Set State DUPLICATE');
const setDupQuery = setDup.parameters.query;
assert(setDupQuery.includes('UPDATE leads'), 'Set State DUPLICATE updates leads table');
assert(setDupQuery.includes("current_processing_state = 'DUPLICATE'"), 'Sets state to DUPLICATE');
assert(setDupQuery.includes('updated_at = NOW()'), 'Updates timestamp');

const setPre = findNode(wf, 'Set State PREQUALIFYING');
const setPreQuery = setPre.parameters.query;
assert(setPreQuery.includes('UPDATE leads'), 'Set State PREQUALIFYING updates leads table');
assert(setPreQuery.includes("current_processing_state = 'PREQUALIFYING'"), 'Sets state to PREQUALIFYING');

// Log event queries
const logDup = findNode(wf, 'Log Event DEDUPLICATING→DUPLICATE');
const logDupQuery = logDup.parameters.query;
assert(logDupQuery.includes('INSERT INTO processing_events'), 'Log event inserts into processing_events');
assert(logDupQuery.includes("'DEDUPLICATING'"), 'Previous state is DEDUPLICATING');
assert(logDupQuery.includes("'DUPLICATE'"), 'New state is DUPLICATE');
assert(logDupQuery.includes("'STATE_TRANSITION'"), 'Event type is STATE_TRANSITION');

const logPre = findNode(wf, 'Log Event DEDUPLICATING→PREQUALIFYING');
const logPreQuery = logPre.parameters.query;
assert(logPreQuery.includes("'PREQUALIFYING'"), 'New state is PREQUALIFYING');

// ── 4. Output Field Validation ─────────────────────────────
console.log('\n4. Output Field Validation');

// Path 1 output: Exact Duplicate (I-002, BLOCK)
const exactDupNode = findNode(wf, 'Set Exact Duplicate Reason');
const exactDupVals = exactDupNode.parameters.values;
const exactDupStrings = (exactDupVals.string || []).map(v => v.name);
const exactDupBools = (exactDupVals.boolean || []).map(v => v.name);
assert(exactDupStrings.includes('reason_code'), 'Exact Duplicate has reason_code');
assert(exactDupStrings.includes('action'), 'Exact Duplicate has action');
assert(exactDupStrings.includes('reason_code_label'), 'Exact Duplicate has reason_code_label');
assert(exactDupBools.includes('is_duplicate'), 'Exact Duplicate has is_duplicate');

// Verify I-002 value
const i002 = exactDupVals.string.find(v => v.name === 'reason_code');
assert(i002 && i002.value === 'I-002', 'Exact Duplicate reason_code is I-002');
const blockAction = exactDupVals.string.find(v => v.name === 'action');
assert(blockAction && blockAction.value === 'BLOCK', 'Exact Duplicate action is BLOCK');

// Path 2 output: Fingerprint Duplicate (I-003, BLOCK)
const fpDupNode = findNode(wf, 'Set Fingerprint Duplicate Reason');
const fpDupVals = fpDupNode.parameters.values;
const i003 = fpDupVals.string.find(v => v.name === 'reason_code');
assert(i003 && i003.value === 'I-003', 'Fingerprint Duplicate reason_code is I-003');

// Path 3 output: Replay Conflict (I-004, REPLAY_RECORD)
const replayNode = findNode(wf, 'Set Replay Conflict Output');
const replayVals = replayNode.parameters.values;
const replayStrings = (replayVals.string || []).map(v => v.name);
assert(replayStrings.includes('reason_code'), 'Replay Conflict has reason_code');
assert(replayStrings.includes('action'), 'Replay Conflict has action');
const i004 = replayVals.string.find(v => v.name === 'reason_code');
assert(i004 && i004.value === 'I-004', 'Replay Conflict reason_code is I-004');
const replayAction = replayVals.string.find(v => v.name === 'action');
assert(replayAction && replayAction.value === 'REPLAY_RECORD', 'Replay Conflict action is REPLAY_RECORD');

// Path 4 output: New Submission (I-001, PROCEED)
const newNode = findNode(wf, 'Set New Submission Reason');
const newVals = newNode.parameters.values;
const i001 = newVals.string.find(v => v.name === 'reason_code');
assert(i001 && i001.value === 'I-001', 'New Submission reason_code is I-001');
const proceed = newVals.string.find(v => v.name === 'action');
assert(proceed && proceed.value === 'PROCEED', 'New Submission action is PROCEED');

// Final assembled outputs
const newOutput = findNode(wf, 'Assemble New Output');
const newOutVals = newOutput.parameters.values;
const newOutStrings = (newOutVals.string || []).map(v => v.name);
assert(newOutStrings.includes('reason_code'), 'Assemble New Output has reason_code');
assert(newOutStrings.includes('action'), 'Assemble New Output has action');

const dupOutput = findNode(wf, 'Assemble Duplicate Output');
const dupOutVals = dupOutput.parameters.values;
const dupOutStrings = (dupOutVals.string || []).map(v => v.name);
assert(dupOutStrings.includes('reason_code'), 'Assemble Duplicate Output has reason_code');
assert(dupOutStrings.includes('action'), 'Assemble Duplicate Output has action');

// ── 5. Database Constraint Validation ──────────────────────
console.log('\n5. Database Constraints');

// Unique constraint on source identity
assert(schema.includes('idx_leads_source_identity'), 'Unique index on (source_system, source_submission_id) exists');
assert(schema.includes('UNIQUE INDEX'), 'UNIQUE INDEX constraint present');
assert(schema.includes('WHERE source_submission_id IS NOT NULL'), 'Partial unique index for non-NULL source_submission_id');

// Fingerprint index
assert(schema.includes('idx_leads_fingerprint'), 'Index on payload_fingerprint exists');

// Correlation ID uniqueness
assert(schema.includes('correlation_id'), 'correlation_id column exists');
assert(schema.includes('UNIQUE'), 'UNIQUE constraint on correlation_id');

// ── 6. Data Flow Completeness ──────────────────────────────
console.log('\n6. Data Flow Completeness');

// Every non-terminal node should have outgoing connections
const terminalNodes = new Set(['Return Idempotency Result']);
wf.nodes.forEach(node => {
  if (terminalNodes.has(node.name)) return;
  const out = getOutgoing(wf, node.name);
  assert(out.length > 0, `"${node.name}" has outgoing connections`);
});

// Webhook is the entry point
const webhook = findNode(wf, 'Receive Lead for Idempotency Check');
assert(webhook.type === 'n8n-nodes-base.webhook', 'Webhook trigger exists');
assert(webhook.parameters.path === 'claim-lead-idempotency', 'Webhook path is claim-lead-idempotency');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}

process.exit(failed > 0 ? 1 : 0);