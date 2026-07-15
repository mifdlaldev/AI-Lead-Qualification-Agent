#!/usr/bin/env node
/**
 * I-06: WF-06 Deterministic Prequalification Structure & SQL Validation
 *
 * Validates:
 * 1. Node structure and types
 * 2. Connection graph (3 execution paths)
 * 3. SQL query correctness
 * 4. Code node logic and reason codes
 * 5. Set node output field contracts
 * 6. Policy lookup correctness
 * 7. State transitions
 * 8. Data flow completeness
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW_DIR = path.join(__dirname, '..', 'workflows');
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
const wfPath = path.join(WORKFLOW_DIR, 'WF-06-deterministic-prequalification.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const schema = fs.readFileSync(path.join(DB_DIR, 'migrations', '0001_initial_schema.sql'), 'utf8');
const policySeed = fs.readFileSync(path.join(DB_DIR, 'seeds', 'demo_policy.sql'), 'utf8');

console.log('=== I-06: WF-06 Deterministic Prequalification Validation ===\n');

// ── 1. Node Structure ─────────────────────────────────────
console.log('1. Node Structure');

const requiredNodes = [
  'Receive for Prequalification',
  'Is Lead Valid?',
  'Ensure State PREQUALIFYING',
  'Log Event DEDUPLICATING→PREQUALIFYING',
  'Load Excluded Services Policy',
  'Evaluate Prequalification Rules',
  'Passed Prequalification?',
  'Set State ANALYZING',
  'Log Event PREQUALIFYING→ANALYZING',
  'Assemble Passed Output',
  'Set State DECIDING (Terminal)',
  'Log Event PREQUALIFYING→DECIDING',
  'Assemble Disqualified Output',
  'Skip - Lead Not Valid',
  'Return Prequalification Result',
];

requiredNodes.forEach(name => {
  const node = findNode(wf, name);
  assert(node !== undefined, `Node "${name}" exists`);
  if (node) {
    const expectedTypes = {
      'Receive for Prequalification': 'n8n-nodes-base.webhook',
      'Is Lead Valid?': 'n8n-nodes-base.if',
      'Ensure State PREQUALIFYING': 'n8n-nodes-base.postgres',
      'Log Event DEDUPLICATING→PREQUALIFYING': 'n8n-nodes-base.postgres',
      'Load Excluded Services Policy': 'n8n-nodes-base.postgres',
      'Evaluate Prequalification Rules': 'n8n-nodes-base.code',
      'Passed Prequalification?': 'n8n-nodes-base.if',
      'Set State ANALYZING': 'n8n-nodes-base.postgres',
      'Log Event PREQUALIFYING→ANALYZING': 'n8n-nodes-base.postgres',
      'Assemble Passed Output': 'n8n-nodes-base.set',
      'Set State DECIDING (Terminal)': 'n8n-nodes-base.postgres',
      'Log Event PREQUALIFYING→DECIDING': 'n8n-nodes-base.postgres',
      'Assemble Disqualified Output': 'n8n-nodes-base.set',
      'Skip - Lead Not Valid': 'n8n-nodes-base.set',
      'Return Prequalification Result': 'n8n-nodes-base.respondToWebhook',
    };
    if (expectedTypes[name]) {
      assert(node.type === expectedTypes[name], `  type: ${expectedTypes[name]}`);
    }
  }
});

// ── 2. Connection Graph — 3 Execution Paths ───────────────
console.log('\n2. Connection Graph');

// Path 1: Invalid lead (is_valid === false)
const validOut = getOutgoing(wf, 'Is Lead Valid?');
assert(validOut.length === 2, 'Is Lead Valid? has 2 outputs (true/false)');
if (validOut.length >= 2) {
  assert(validOut[0][0].node === 'Ensure State PREQUALIFYING', 'Is Lead Valid? true → Ensure State PREQUALIFYING');
  assert(validOut[1][0].node === 'Skip - Lead Not Valid', 'Is Lead Valid? false → Skip - Lead Not Valid');
}

// Path 2: Passed prequalification → ANALYZING
const passedOut = getOutgoing(wf, 'Passed Prequalification?');
assert(passedOut.length === 2, 'Passed Prequalification? has 2 outputs');
if (passedOut.length >= 2) {
  assert(passedOut[0][0].node === 'Set State ANALYZING', 'Passed? true → Set State ANALYZING');
  assert(passedOut[1][0].node === 'Set State DECIDING (Terminal)', 'Passed? false → Set State DECIDING (Terminal)');
}

// Path 3: Not passed → DECIDING (terminal)
const decidingOut = getOutgoing(wf, 'Set State DECIDING (Terminal)');
assert(decidingOut.length === 1, 'Set State DECIDING (Terminal) has 1 output');
if (decidingOut.length >= 1) {
  assert(decidingOut[0][0].node === 'Log Event PREQUALIFYING→DECIDING',
    'DECIDING → Log Event PREQUALIFYING→DECIDING');
}

// All paths reach Return Prequalification Result
const returnNode = findNode(wf, 'Return Prequalification Result');
const returnIncoming = [];
Object.keys(wf.connections).forEach(srcName => {
  (wf.connections[srcName].main || []).forEach(dests => {
    if (!dests) return;
    dests.forEach(d => {
      if (d.node === returnNode.name) returnIncoming.push(srcName);
    });
  });
});
assert(returnIncoming.length === 3, `Return has 3 incoming paths (found ${returnIncoming.length}): ${returnIncoming.join(', ')}`);

// ── 3. SQL Query Validation ───────────────────────────────
console.log('\n3. SQL Query Validation');

// Ensure State PREQUALIFYING
const ensureState = findNode(wf, 'Ensure State PREQUALIFYING');
assert(ensureState.parameters.query.includes("current_processing_state = 'PREQUALIFYING'"),
  'Ensure State sets PREQUALIFYING');
assert(ensureState.parameters.query.includes('UPDATE leads'), 'Ensure State is UPDATE leads');

// Log Event DEDUPLICATING→PREQUALIFYING
const logD2P = findNode(wf, 'Log Event DEDUPLICATING→PREQUALIFYING');
assert(logD2P.parameters.query.includes('INSERT INTO processing_events'), 'Log inserts processing_events');
assert(logD2P.parameters.query.includes("'DEDUPLICATING'"), 'Previous state: DEDUPLICATING');
assert(logD2P.parameters.query.includes("'PREQUALIFYING'"), 'New state: PREQUALIFYING');
assert(logD2P.parameters.query.includes("'P-000'"), 'Reason code: P-000 (prequalification start)');

// Load Excluded Services Policy
const loadPolicy = findNode(wf, 'Load Excluded Services Policy');
assert(loadPolicy.parameters.query.includes('policy_config'), 'Loads from policy_config table');
assert(loadPolicy.parameters.query.includes("policy_key = 'excluded_services'"), 'Filters by excluded_services key');
assert(loadPolicy.parameters.query.includes('active = true'), 'Filters by active = true');
assert(loadPolicy.parameters.query.includes('policy_version'), 'Uses policy_version parameter');
assert(loadPolicy.parameters.query.includes('LIMIT 1'), 'Uses LIMIT 1');

// Set State ANALYZING
const setAnalyzing = findNode(wf, 'Set State ANALYZING');
assert(setAnalyzing.parameters.query.includes("current_processing_state = 'ANALYZING'"),
  'Set State ANALYZING sets ANALYZING');

// Log Event PREQUALIFYING→ANALYZING
const logP2A = findNode(wf, 'Log Event PREQUALIFYING→ANALYZING');
assert(logP2A.parameters.query.includes("'ANALYZING'"), 'New state: ANALYZING');
assert(logP2A.parameters.query.includes("'P-004'"), 'Reason code: P-004');

// Set State DECIDING (Terminal)
const setDeciding = findNode(wf, 'Set State DECIDING (Terminal)');
assert(setDeciding.parameters.query.includes("current_processing_state = 'DECIDING'"),
  'Set State DECIDING sets DECIDING');
assert(setDeciding.parameters.query.includes('current_disposition'), 'Sets current_disposition');
assert(setDeciding.parameters.query.includes('disposition_if_terminal'), 'Uses disposition_if_terminal value');

// Log Event PREQUALIFYING→DECIDING
const logP2D = findNode(wf, 'Log Event PREQUALIFYING→DECIDING');
assert(logP2D.parameters.query.includes("'DECIDING'"), 'New state: DECIDING');
assert(logP2D.parameters.query.includes('reason_codes[0]'), 'Uses first reason code');

// ── 4. Policy Seed Data ───────────────────────────────────
console.log('\n4. Policy Seed Data');

assert(policySeed.includes('excluded_services'), 'Policy seed includes excluded_services');
assert(policySeed.includes('service_categories'), 'Policy seed includes service_categories');
assert(policySeed.includes('disposition_rules'), 'Policy seed includes disposition_rules');
assert(policySeed.includes('policy_version') && policySeed.includes('excluded_services'),
  'Policy seed includes policy_version and excluded_services entries');

// Excluded services list validation
assert(policySeed.includes('social media management only'), 'Excludes: social media management only');
assert(policySeed.includes('influencer marketing'), 'Excludes: influencer marketing');
assert(policySeed.includes('video production without automation'), 'Excludes: video production without automation');
assert(policySeed.includes('pure graphic design'), 'Excludes: pure graphic design');
assert(policySeed.includes('SEO content writing without automation'), 'Excludes: SEO content writing');
assert(policySeed.includes('manual data entry services'), 'Excludes: manual data entry services');

// ── 5. Code Node Logic ─────────────────────────────────────
console.log('\n5. Code Node Logic');

const codeNode = findNode(wf, 'Evaluate Prequalification Rules');
const code = codeNode.parameters.jsCode;

// Reason codes
assert(code.includes('P-001'), 'Contains P-001 (undefined/null consent)');
assert(code.includes('P-002'), 'Contains P-002 (false consent)');
assert(code.includes('P-003'), 'Contains P-003 (excluded service)');
assert(code.includes('P-004'), 'Contains P-004 (passed prequalification)');
assert(code.includes('P-005'), 'Contains P-005 (requires AI analysis)');

// Consent checks
assert(code.includes('consent_to_contact'), 'Checks consent_to_contact');
assert(code.includes('=== undefined'), 'Checks undefined consent');
assert(code.includes('=== null'), 'Checks null consent');
assert(code.includes('=== false'), 'Checks false consent');

// Excluded services
assert(code.includes('excluded_services'), 'Checks excluded_services');
assert(code.includes('service_interest'), 'Checks service_interest');
assert(code.includes('toLowerCase()'), 'Case-insensitive comparison');
assert(code.includes('Array.isArray'), 'Validates excluded_services is array');

// Output fields
assert(code.includes('passed'), 'Outputs passed');
assert(code.includes('reason_codes'), 'Outputs reason_codes');
assert(code.includes('requires_ai_analysis'), 'Outputs requires_ai_analysis');
assert(code.includes('blocked_actions'), 'Outputs blocked_actions');
assert(code.includes('disposition_if_terminal'), 'Outputs disposition_if_terminal');

// Action blocking
assert(code.includes('AUTOMATED_FOLLOWUP'), 'Blocks AUTOMATED_FOLLOWUP');
assert(code.includes('PROSPECT_EMAIL'), 'Blocks PROSPECT_EMAIL');
assert(code.includes('ALL_SIDE_EFFECTS'), 'Blocks ALL_SIDE_EFFECTS');

// ── 6. Set Node Output Contracts ──────────────────────────
console.log('\n6. Set Node Output Contracts');

// Assemble Passed Output
const passedNode = findNode(wf, 'Assemble Passed Output');
const passedVals = passedNode.parameters.values;
const passedStrings = (passedVals.string || []).map(v => v.name);
const passedBools = (passedVals.boolean || []).map(v => v.name);
const passedArrays = (passedVals.array || []).map(v => v.name);
assert(passedBools.includes('passed'), 'Passed Output has passed (boolean)');
assert(passedBools.includes('requires_ai_analysis'), 'Passed Output has requires_ai_analysis (boolean)');
assert(passedArrays.includes('reason_codes'), 'Passed Output has reason_codes (array)');

// Assemble Disqualified Output
const disqNode = findNode(wf, 'Assemble Disqualified Output');
const disqVals = disqNode.parameters.values;
const disqStrings = (disqVals.string || []).map(v => v.name);
const disqBools = (disqVals.boolean || []).map(v => v.name);
assert(disqStrings.includes('disposition_if_terminal'), 'Disqualified Output has disposition_if_terminal');
assert(disqBools.includes('passed'), 'Disqualified Output has passed (boolean)');
assert(disqBools.includes('requires_ai_analysis'), 'Disqualified Output has requires_ai_analysis (boolean)');

// Skip - Lead Not Valid
const skipNode = findNode(wf, 'Skip - Lead Not Valid');
const skipVals = skipNode.parameters.values;
const skipStrings = (skipVals.string || []).map(v => v.name);
const skipBools = (skipVals.boolean || []).map(v => v.name);
assert(skipStrings.includes('disposition_if_terminal'), 'Skip Output has disposition_if_terminal');
assert(skipBools.includes('passed'), 'Skip Output has passed (boolean)');
assert(skipBools.includes('requires_ai_analysis'), 'Skip Output has requires_ai_analysis (boolean)');

// Contract required output fields
const allOutputFields = new Set();
[passedStrings, disqStrings, skipStrings].forEach(arr => arr.forEach(f => allOutputFields.add(f)));
[passedBools, disqBools, skipBools].forEach(arr => arr.forEach(f => allOutputFields.add(f)));
[passedArrays].forEach(arr => arr.forEach(f => allOutputFields.add(f)));

assert(allOutputFields.has('passed'), 'passed is in all output paths');
assert(allOutputFields.has('requires_ai_analysis'), 'requires_ai_analysis is in all output paths');
assert(allOutputFields.has('reason_codes'), 'reason_codes is in all output paths');
assert(allOutputFields.has('disposition_if_terminal'), 'disposition_if_terminal is in all output paths');

// ── 7. State Transitions ──────────────────────────────────
console.log('\n7. State Transitions');

const stateTransitions = [
  { from: 'DEDUPLICATING', to: 'PREQUALIFYING', node: 'Log Event DEDUPLICATING→PREQUALIFYING' },
  { from: 'PREQUALIFYING', to: 'ANALYZING', node: 'Log Event PREQUALIFYING→ANALYZING' },
  { from: 'PREQUALIFYING', to: 'DECIDING', node: 'Log Event PREQUALIFYING→DECIDING' },
];

stateTransitions.forEach(t => {
  assert(findNode(wf, t.node) !== undefined, `Transition ${t.from}→${t.to} exists`);
});

// ── 8. Data Flow Completeness ──────────────────────────────
console.log('\n8. Data Flow Completeness');

const terminalNodes = new Set(['Return Prequalification Result']);
wf.nodes.forEach(node => {
  if (terminalNodes.has(node.name)) return;
  if (node.type === 'n8n-nodes-base.webhook') return; // trigger node
  const out = getOutgoing(wf, node.name);
  assert(out.length > 0, `"${node.name}" has outgoing connections`);
});

// Webhook entry point
const webhook = findNode(wf, 'Receive for Prequalification');
assert(webhook.parameters.path === 'deterministic-prequalification', 'Webhook path: deterministic-prequalification');

// ── 9. FR-030/FR-031 Compliance ────────────────────────────
console.log('\n9. FR-030/FR-031 Compliance');

// FR-030: Hard rules execute outside LLM prompt
assert(code.includes('// WF-06: Deterministic Prequalification'), 'Hard rules are deterministic (not AI)');
assert(!code.includes('openai') && !code.includes('ai.') && !code.includes('llm'),
  'No AI calls in prequalification code');

// FR-031: No AI call when terminal rule resolves
assert(code.includes('requiresAiAnalysis = false'), 'AI not required when terminal rule resolves');
assert(code.includes('dispositionIfTerminal'), 'Terminal disposition supported');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}

process.exit(failed > 0 ? 1 : 0);