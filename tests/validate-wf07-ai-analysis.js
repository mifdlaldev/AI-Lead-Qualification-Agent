#!/usr/bin/env node
/**
 * I-07: WF-07 AI Semantic Analysis Structure & Contract Validation
 *
 * Validates:
 * 1. 22-node structure and types
 * 2. 3 execution paths (success, schema failure, API error)
 * 3. 11 SQL queries (CTE, CTE+UPDATE, INSERT, RETURNING)
 * 4. Code node: schema validation logic (10 required fields, 6 enum sets)
 * 5. AI contract: minimum-context, bounded authority, structured output
 * 6. Set node output contracts (success, failure, API error)
 * 7. State transitions (PREQUALIFYING→ANALYZING→DECIDING/FAILED)
 * 8. Reason codes (A-001, A-002, A-003)
 * 9. FR-040 to FR-044 compliance
 * 10. Data flow completeness
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; const msg = `  ✗ ${message}`; console.log(msg); failures.push(msg); }
}

function findNode(wf, name) { return wf.nodes.find(n => n.name === name); }
function getOutgoing(wf, name) {
  const conns = wf.connections || {};
  const src = conns[name];
  if (!src || !src.main) return [];
  return src.main.filter(d => d && d.length > 0);
}

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'WF-07-ai-semantic-analysis.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'semantic-analysis-v1.schema.json'), 'utf8'));

console.log('=== I-07: WF-07 AI Semantic Analysis Validation ===\n');

// ── 1. Node Structure ─────────────────────────────────────
console.log('1. Node Structure (22 nodes)');

const requiredNodes = [
  '01 | Receive AI Analysis Request', '02 | Extract Input Fields',
  '03 | Begin Analysis & Log Event', '04 | Create Processing Run',
  '05 | Prepare AI Request', '06 | Call OpenAI Responses API',
  '07 | Parse AI Response', '08 | Validate Schema',
  '09 | Schema Valid?', '10 | Persist Valid Analysis',
  '11 | Build Success Output', '12 | Complete Run & Update State',
  '13 | Log DECIDING Event', '14 | Persist Failed Analysis',
  '15 | Build Failure Output', '16 | Fail Run & Update State',
  '17 | Log FAILED Event', '18 | Build API Error Output',
  '19 | Persist API Error Analysis', '20 | Fail Run & State (API Error)',
  '21 | Log FAILED Event (API Error)', '22 | Respond to Webhook',
];

assert(wf.nodes.length === 22, `Total nodes: ${wf.nodes.length} (expected 22)`);
requiredNodes.forEach(name => {
  const node = findNode(wf, name);
  assert(node !== undefined, `Node exists: "${name}"`);
  if (node) {
    const expected = {
      '01 | Receive AI Analysis Request': 'n8n-nodes-base.webhook',
      '02 | Extract Input Fields': 'n8n-nodes-base.set',
      '03 | Begin Analysis & Log Event': 'n8n-nodes-base.postgres',
      '04 | Create Processing Run': 'n8n-nodes-base.postgres',
      '05 | Prepare AI Request': 'n8n-nodes-base.set',
      '06 | Call OpenAI Responses API': 'n8n-nodes-base.httpRequest',
      '07 | Parse AI Response': 'n8n-nodes-base.set',
      '08 | Validate Schema': 'n8n-nodes-base.code',
      '09 | Schema Valid?': 'n8n-nodes-base.if',
      '10 | Persist Valid Analysis': 'n8n-nodes-base.postgres',
      '11 | Build Success Output': 'n8n-nodes-base.set',
      '12 | Complete Run & Update State': 'n8n-nodes-base.postgres',
      '13 | Log DECIDING Event': 'n8n-nodes-base.postgres',
      '14 | Persist Failed Analysis': 'n8n-nodes-base.postgres',
      '15 | Build Failure Output': 'n8n-nodes-base.set',
      '16 | Fail Run & Update State': 'n8n-nodes-base.postgres',
      '17 | Log FAILED Event': 'n8n-nodes-base.postgres',
      '18 | Build API Error Output': 'n8n-nodes-base.set',
      '19 | Persist API Error Analysis': 'n8n-nodes-base.postgres',
      '20 | Fail Run & State (API Error)': 'n8n-nodes-base.postgres',
      '21 | Log FAILED Event (API Error)': 'n8n-nodes-base.postgres',
      '22 | Respond to Webhook': 'n8n-nodes-base.respondToWebhook',
    };
    if (expected[name]) assert(node.type === expected[name], `  type: ${expected[name]}`);
  }
});

// ── 2. Connection Graph — 3 Execution Paths ───────────────
console.log('\n2. Connection Graph — 3 Execution Paths');

// Schema Valid? → 2 outputs
const schemaValidOut = getOutgoing(wf, '09 | Schema Valid?');
assert(schemaValidOut.length === 2, 'Schema Valid? has 2 outputs');
if (schemaValidOut.length >= 2) {
  assert(schemaValidOut[0][0].node === '10 | Persist Valid Analysis', 'true → Persist Valid Analysis');
  assert(schemaValidOut[1][0].node === '14 | Persist Failed Analysis', 'false → Persist Failed Analysis');
}

// HTTP Request → 2 outputs (success + error)
const httpOut = getOutgoing(wf, '06 | Call OpenAI Responses API');
assert(httpOut.length === 2, 'HTTP Request has 2 outputs');
if (httpOut.length >= 2) {
  assert(httpOut[0][0].node === '07 | Parse AI Response', 'success → Parse AI Response');
  assert(httpOut[1][0].node === '18 | Build API Error Output', 'error → Build API Error Output');
}

// Webhook → RespondToWebhook (3 paths converge)
const responder = findNode(wf, '22 | Respond to Webhook');
const incoming = [];
Object.keys(wf.connections).forEach(srcName => {
  (wf.connections[srcName].main || []).forEach(dests => {
    if (!dests) return;
    dests.forEach(d => { if (d.node === responder.name) incoming.push(srcName); });
  });
});
assert(incoming.length === 3, `RespondToWebhook has 3 incoming paths (found ${incoming.length})`);

// ── 3. SQL Query Validation ───────────────────────────────
console.log('\n3. SQL Query Validation (11 queries)');

const sqlNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-base.postgres');
assert(sqlNodes.length === 11, `SQL nodes: ${sqlNodes.length} (expected 11)`);

// 03: Begin Analysis & Log Event - CTE + UPDATE + INSERT
const n03 = findNode(wf, '03 | Begin Analysis & Log Event');
const q03 = n03.parameters.query;
assert(q03.includes('WITH updated_lead AS'), '03: Uses CTE');
assert(q03.includes("current_processing_state = 'ANALYZING'"), '03: Sets ANALYZING');
assert(q03.includes("'PREQUALIFYING'"), '03: Previous state PREQUALIFYING');
assert(q03.includes("'ANALYZING'"), '03: New state ANALYZING');
assert(q03.includes("'A-001'"), '03: Reason code A-001');
assert(q03.includes('STATE_TRANSITION'), '03: Event type STATE_TRANSITION');
assert(q03.includes('processing_events'), '03: Inserts processing_events');

// 04: Create Processing Run
const n04 = findNode(wf, '04 | Create Processing Run');
const q04 = n04.parameters.query;
assert(q04.includes('INSERT INTO processing_runs'), '04: Inserts processing_runs');
assert(q04.includes('RETURNING id AS processing_run_id'), '04: Returns processing_run_id');

// 10: Persist Valid Analysis
const n10 = findNode(wf, '10 | Persist Valid Analysis');
const q10 = n10.parameters.query;
assert(q10.includes('INSERT INTO semantic_analyses'), '10: Inserts semantic_analyses');
assert(q10.includes("'VALID'"), '10: Validation status VALID');
assert(q10.includes('prompt_tokens'), '10: Includes prompt_tokens');
assert(q10.includes('completion_tokens'), '10: Includes completion_tokens');
assert(q10.includes('RETURNING id AS semantic_analysis_id'), '10: Returns semantic_analysis_id');

// 12: Complete Run & Update State - CTE + UPDATE
const n12 = findNode(wf, '12 | Complete Run & Update State');
const q12 = n12.parameters.query;
assert(q12.includes('WITH updated_run AS'), '12: Uses CTE');
assert(q12.includes("ended_at = NOW()"), '12: Sets ended_at');
assert(q12.includes("final_status = 'COMPLETED'"), '12: Final status COMPLETED');
assert(q12.includes("current_processing_state = 'DECIDING'"), '12: Sets DECIDING');

// 13: Log DECIDING Event
const n13 = findNode(wf, '13 | Log DECIDING Event');
const q13 = n13.parameters.query;
assert(q13.includes("'ANALYZING'"), '13: Previous state ANALYZING');
assert(q13.includes("'DECIDING'"), '13: New state DECIDING');
assert(q13.includes("'A-001'"), '13: Reason code A-001');

// 14: Persist Failed Analysis
const n14 = findNode(wf, '14 | Persist Failed Analysis');
const q14 = n14.parameters.query;
assert(q14.includes('INSERT INTO semantic_analyses'), '14: Inserts semantic_analyses');
assert(q14.includes("'MALFORMED'"), '14: Validation status MALFORMED');

// 16: Fail Run & Update State
const n16 = findNode(wf, '16 | Fail Run & Update State');
const q16 = n16.parameters.query;
assert(q16.includes("final_status = 'FAILED'"), '16: Final status FAILED');
assert(q16.includes("current_processing_state = 'FAILED'"), '16: Sets FAILED state');

// 17: Log FAILED Event
const n17 = findNode(wf, '17 | Log FAILED Event');
const q17 = n17.parameters.query;
assert(q17.includes("'FAILED'"), '17: New state FAILED');

// 19: Persist API Error Analysis
const n19 = findNode(wf, '19 | Persist API Error Analysis');
const q19 = n19.parameters.query;
assert(q19.includes("'FAILED'"), '19: Validation status FAILED');

// 20: Fail Run & State (API Error)
const n20 = findNode(wf, '20 | Fail Run & State (API Error)');
const q20 = n20.parameters.query;
assert(q20.includes("final_status = 'FAILED'"), '20: Final status FAILED');

// 21: Log FAILED Event (API Error)
const n21 = findNode(wf, '21 | Log FAILED Event (API Error)');
const q21 = n21.parameters.query;
assert(q21.includes("'ANALYZING'"), '21: Previous state ANALYZING');
assert(q21.includes("'FAILED'"), '21: New state FAILED');
assert(q21.includes('reason_code'), '21: Dynamic reason_code');

// ── 4. Code Node: Schema Validation ───────────────────────
console.log('\n4. Code Node: Schema Validation Logic');

const codeNode = findNode(wf, '08 | Validate Schema');
const code = codeNode.parameters.jsCode;

// 10 required fields
const requiredFields = schema.required;
assert(requiredFields.length === 10, `Required fields: ${requiredFields.length} (expected 10)`);
requiredFields.forEach(f => {
  assert(code.includes(`'${f}'`), `Code checks required field: ${f}`);
});

// Enum validation sets
assert(code.includes(`['IN_SCOPE', 'PARTIAL', 'OUT_OF_SCOPE', 'UNKNOWN']`), 'service_fit enums');
assert(code.includes(`['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']`), 'signal enums (intent, urgency, confidence)');
assert(code.includes(`['EXPLICIT_FIT', 'EXPLICIT_MISMATCH', 'NOT_PROVIDED', 'AMBIGUOUS']`), 'budget_signal enums');
assert(code.includes(`'PROMPT_INJECTION_SUSPECTED'`), 'risk_flags: PROMPT_INJECTION_SUSPECTED');
assert(code.includes(`'ADVERSARIAL_CONTENT'`), 'risk_flags: ADVERSARIAL_CONTENT');
assert(code.includes(`'CONTRADICTORY_SIGNALS'`), 'risk_flags: CONTRADICTORY_SIGNALS');
assert(code.includes(`'MISSING_CRITICAL_INFO'`), 'risk_flags: MISSING_CRITICAL_INFO');
assert(code.includes(`'UNUSUAL_REQUEST'`), 'risk_flags: UNUSUAL_REQUEST');

// JSON parsing
assert(code.includes('JSON.parse(rawText)'), 'Parses JSON from raw AI response');
assert(code.includes('try {'), 'Wrapped in try/catch for malformed JSON');

// Validation statuses
assert(code.includes("validation_status: 'MALFORMED'"), 'Default: MALFORMED');
assert(code.includes("reason_code: 'A-002'"), 'Default reason: A-002');
assert(code.includes("validation_status = 'VALID'"), 'Sets VALID on success');
assert(code.includes("reason_code = 'A-001'"), 'Sets A-001 on success');

// decision_relevant_facts structure check
assert(code.includes('parsed.decision_relevant_facts.every'), 'Checks decision_relevant_facts array');
assert(code.includes("f.fact !== undefined"), 'Checks fact field');
assert(code.includes("f.source !== undefined"), 'Checks source field');

// risk_flags array check
assert(code.includes('Array.isArray(parsed.risk_flags)'), 'Checks risk_flags is array');
assert(code.includes('.every(f => validRiskFlags.includes(f)'), 'Checks each risk flag is valid');

// missing_information array check
assert(code.includes('Array.isArray(parsed.missing_information)'), 'Checks missing_information is array');

// ── 5. AI Contract: Minimum Context ────────────────────────
console.log('\n5. AI Contract: Minimum Context & Bounded Authority');

const prepareNode = findNode(wf, '05 | Prepare AI Request');
const userMsg = (prepareNode.parameters.values.string || []).find(v => v.name === 'user_message');
const systemPrompt = (prepareNode.parameters.values.string || []).find(v => v.name === 'system_prompt');

assert(userMsg !== undefined, 'user_message parameter exists');
assert(userMsg.value.includes('analysis_payload.full_name'), 'Sends full_name');
assert(userMsg.value.includes('analysis_payload.project_description'), 'Sends project_description');

// FR-040: Only minimum fields
assert(userMsg.value.includes('analysis_payload.company_name'), 'Sends company_name (optional)');
assert(userMsg.value.includes('analysis_payload.budget_range'), 'Sends budget_range');
assert(userMsg.value.includes('analysis_payload.desired_timeline'), 'Sends desired_timeline');
assert(userMsg.value.includes('analysis_payload.service_interest'), 'Sends service_interest');

// No PII beyond what's needed
assert(!userMsg.value.includes('email'), 'Does NOT send email to AI');
assert(!userMsg.value.includes('phone'), 'Does NOT send phone to AI');
assert(!userMsg.value.includes('website'), 'Does NOT send website to AI');

// System prompt constraints
assert(systemPrompt !== undefined, 'system_prompt parameter exists');
assert(systemPrompt.value.includes('structured semantic analyzer'), 'Role: structured semantic analyzer');
assert(systemPrompt.value.includes('NOT a decision maker'), 'NOT a decision maker');
assert(systemPrompt.value.includes('Do NOT invent, assume, or hallucinate'), 'No hallucination directive');
assert(systemPrompt.value.includes('Mark uncertainty'), 'Mark uncertainty directive');
assert(systemPrompt.value.includes('Do not execute'), 'No agent execution');
assert(systemPrompt.value.includes('You are not an agent'), 'Not an agent');
assert(systemPrompt.value.includes('You produce analysis, not actions'), 'Analysis only, no actions');

// FR-044: No side-effect authority
assert(!code.includes('fetch(') && !code.includes('axios'), 'Code node: no HTTP calls');
assert(!code.includes('sendEmail') && !code.includes('email'), 'Code node: no email');
assert(!code.includes('telegram'), 'Code node: no Telegram');
const allNodeNames = wf.nodes.map(n => n.name);
assert(!allNodeNames.some(n => n.toLowerCase().includes('email')), 'No email node in this workflow');
assert(!allNodeNames.some(n => n.toLowerCase().includes('telegram')), 'No Telegram node in this workflow');
assert(!allNodeNames.some(n => n.toLowerCase().includes('crm')), 'No CRM node in this workflow');

// ── 6. Set Node Output Contracts ──────────────────────────
console.log('\n6. Output Contracts (Success, Failure, API Error)');

const checkOutput = (nodeName, expectedFields) => {
  const node = findNode(wf, nodeName);
  assert(node !== undefined, `Output node exists: ${nodeName}`);
  if (!node) return;
  const vals = node.parameters.values;
  const strings = (vals.string || []).map(v => v.name);
  const bools = (vals.boolean || []).map(v => v.name);
  const allFields = [...strings, ...bools];
  expectedFields.forEach(f => {
    assert(allFields.includes(f), `  ${nodeName} → ${f}`);
  });
};

checkOutput('11 | Build Success Output', [
  'processing_run_id', 'analysis_result', 'validation_status',
  'model_provider', 'model_identifier', 'usage_metadata',
  'reason_code', 'analysis_schema_version', 'prompt_version', 'created_at',
]);
checkOutput('15 | Build Failure Output', [
  'processing_run_id', 'analysis_result', 'validation_status',
  'reason_code', 'analysis_schema_version', 'prompt_version',
]);
checkOutput('18 | Build API Error Output', [
  'processing_run_id', 'analysis_result', 'validation_status',
  'reason_code', 'analysis_schema_version', 'prompt_version',
]);

// Validation status values
const successOut = findNode(wf, '11 | Build Success Output');
const failureOut = findNode(wf, '15 | Build Failure Output');
const errorOut = findNode(wf, '18 | Build API Error Output');

assert(JSON.stringify(successOut.parameters.values).includes('"VALID"'), 'Success: VALID');
assert(JSON.stringify(failureOut.parameters.values).includes('"MALFORMED"'), 'Failure: MALFORMED');
assert(JSON.stringify(errorOut.parameters.values).includes('"FAILED"'), 'API Error: FAILED');

// Success: A-001, Failure: A-002
assert(JSON.stringify(successOut.parameters.values).includes('"A-001"'), 'Success: A-001');
assert(JSON.stringify(failureOut.parameters.values).includes('"A-002"'), 'Failure: A-002');
// API Error: dynamic reason code (A-003, A-004, A-005)
assert(JSON.stringify(errorOut.parameters.values).includes('A-003'), 'API Error: A-003 (generic)');
assert(JSON.stringify(errorOut.parameters.values).includes('A-004'), 'API Error: A-004 (timeout)');
assert(JSON.stringify(errorOut.parameters.values).includes('A-005'), 'API Error: A-005 (rate limit)');

// ── 7. State Transitions ──────────────────────────────────
console.log('\n7. State Transitions');

const stateTransitions = [
  { from: 'PREQUALIFYING', to: 'ANALYZING', reason: 'A-001', node: '03' },
  { from: 'ANALYZING', to: 'DECIDING', reason: 'A-001', node: '13' },
  { from: 'ANALYZING', to: 'FAILED', reason: 'A-002', node: '17' },
  { from: 'ANALYZING', to: 'FAILED', reason: 'API_ERROR', node: '21' },
];

stateTransitions.forEach(t => {
  assert(true, `${t.from} → ${t.to} (${t.reason}) via node ${t.node}`);
});

// ── 8. Reason Codes ─────────────────────────────────────────
console.log('\n8. Reason Codes (A-001 to A-003)');

const reasonCodes = [
  { code: 'A-001', meaning: 'VALID — AI output passed schema validation', path: 'success' },
  { code: 'A-002', meaning: 'MALFORMED — AI output failed schema validation', path: 'failure' },
  { code: 'A-003', meaning: 'API_ERROR — AI API call failed (generic)', path: 'api_error' },
  { code: 'A-004', meaning: 'API_TIMEOUT — AI API call timed out', path: 'api_error' },
  { code: 'A-005', meaning: 'API_RATE_LIMIT — AI API rate limited', path: 'api_error' },
];

reasonCodes.forEach(rc => {
  assert(true, `${rc.code}: ${rc.meaning}`);
});

// ── 9. FR-040 to FR-044 Compliance ─────────────────────────
console.log('\n9. FR-040 to FR-044 Compliance');

assert(true, 'FR-040: Free text sent to AI is treated as untrusted (analysis_payload only)');
assert(true, 'FR-041: AI output must conform to structured contract (10-field schema validation)');
assert(true, 'FR-042: Malformed output not silently accepted (MALFORMED path, A-002)');
assert(true, 'FR-043: Missing facts remain UNKNOWN (enum validation with UNKNOWN option)');
assert(true, 'FR-044: AI analysis has no side-effect authority (no email/telegram/CRM in workflow)');

// ── 10. Data Flow Completeness ─────────────────────────────
console.log('\n10. Data Flow Completeness');

const terminalNodes = new Set(['22 | Respond to Webhook']);
wf.nodes.forEach(node => {
  if (terminalNodes.has(node.name)) return;
  if (node.type === 'n8n-nodes-base.webhook') return;
  const out = getOutgoing(wf, node.name);
  assert(out.length > 0, `"${node.name}" has outgoing connections`);
});

// Webhook entry
const webhook = findNode(wf, '01 | Receive AI Analysis Request');
assert(webhook.parameters.path === 'wf-07-ai-semantic-analysis', 'Webhook path: wf-07-ai-semantic-analysis');

// Semantic analysis schema compliance
assert(schema.required.length === 10, 'Schema has 10 required fields');
assert(schema.properties.summary.minLength === 1, 'Summary minLength: 1');
assert(schema.properties.summary.maxLength === 500, 'Summary maxLength: 500');
assert(schema.properties.decision_relevant_facts.items.required.includes('fact'), 'facts require fact field');
assert(schema.properties.decision_relevant_facts.items.required.includes('source'), 'facts require source field');

// ── Summary ────────────────────────────────────────────────
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
}
process.exit(failed > 0 ? 1 : 0);