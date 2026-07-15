#!/usr/bin/env node

/**
 * tests/validate-workflow-structure.js
 *
 * Validates all 15 n8n workflow JSON files against structural contracts.
 *
 * Run: node tests/validate-workflow-structure.js
 * Exit: 0 if all pass, 1 if any workflow fails.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const CONTRACTS_PATH = path.join(__dirname, '..', 'schemas', 'workflow-contracts.json');

// Expected output for each workflow (from contracts)
const WORKFLOW_CONTRACTS = {
  'WF-01': ['correlation_id', 'lead_id', 'source_system', 'received_at'],
  'WF-02': ['correlation_id', 'lead_id', 'source_system', 'received_at'],
  'WF-03': ['lead_id', 'correlation_id', 'disposition', 'processing_state', 'reason_codes', 'decision_id', 'evidence', 'completed_at'],
  'WF-04': ['is_valid', 'reason_codes', 'normalized_lead', 'recoverability'],
  'WF-05': ['is_duplicate', 'reason_code', 'action'],
  'WF-06': ['passed', 'reason_codes', 'requires_ai_analysis'],
  'WF-07': ['processing_run_id', 'analysis_result', 'validation_status', 'reason_code'],
  'WF-08': ['decision_id', 'disposition', 'reason_codes', 'requires_human_review', 'policy_version'],
  'WF-09': ['review_id', 'review_token_hash', 'review_token_expires_at', 'status', 'reason_code'],
  'WF-10': ['routing_complete', 'side_effects_triggered'],
  'WF-11': ['action_key', 'status', 'reason_code'],
  'WF-12': ['action_key', 'status', 'reason_code'],
  'WF-13': ['review_id', 'status', 'reason_code', 'final_disposition'],
  'WF-14': ['recovery_action', 'event_id', 'alert_sent', 'processing_state'],
  'WF-15': ['run_id', 'fixture_id', 'observed', 'expected', 'match', 'evidence'],
};

// Workflows that do NOT require a webhook trigger
const NO_WEBHOOK_WF = ['WF-14'];

// Workflows that do NOT require a respondToWebhook node
const NO_RESPOND_WF = ['WF-14', 'WF-15'];

// UUID format regex (n8n uses hex strings, not strict RFC 4122 v4)
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Secret patterns to detect
const SECRET_PATTERNS = [
  { re: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI-style API key' },
  { re: /api_key\s*[:=]\s*['"][a-zA-Z0-9_\-]{8,}['"]/, name: 'api_key assignment' },
  { re: /token\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{8,}['"]/, name: 'token assignment' },
  { re: /password\s*[:=]\s*['"][^'"]+['"]/, name: 'password assignment' },
  { re: /secret\s*[:=]\s*['"][^'"]{4,}['"]/, name: 'secret assignment' },
  { re: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/, name: 'Bearer token' },
  { re: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)?\s*PRIVATE KEY-----/, name: 'private key' },
];

// Valid node types to check for
const WEBHOOK_TYPES = ['n8n-nodes-base.webhook'];
const RESPOND_TYPES = ['n8n-nodes-base.respondToWebhook'];
const POSTGRES_TYPES = ['n8n-nodes-base.postgres'];
const ERROR_TRIGGER_TYPES = ['n8n-nodes-base.errorTrigger'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function getWorkflowFiles() {
  const files = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  return files;
}

function extractWorkflowId(filename) {
  const m = filename.match(/^(WF-\d{2})/);
  return m ? m[1] : null;
}

function collectNodeNames(nodes) {
  return new Set(nodes.map(n => n.name));
}

function collectAllNodeIds(nodes) {
  return new Set(nodes.map(n => n.id));
}

// Collect all field names that a Set node produces (from its values.string[].name)
function collectSetNodeOutputFields(node) {
  const fields = [];
  const params = node.parameters || {};
  const values = params.values || {};
  const stringVals = values.string || [];
  const numberVals = values.number || [];
  const booleanVals = values.boolean || [];
  const arrayVals = values.array || [];
  const objectVals = values.object || [];
  for (const entry of stringVals) {
    if (entry.name) fields.push(entry.name);
  }
  for (const entry of numberVals) {
    if (entry.name) fields.push(entry.name);
  }
  for (const entry of booleanVals) {
    if (entry.name) fields.push(entry.name);
  }
  for (const entry of arrayVals) {
    if (entry.name) fields.push(entry.name);
  }
  for (const entry of objectVals) {
    if (entry.name) fields.push(entry.name);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Per-workflow validators
// ---------------------------------------------------------------------------

function validateNodeIds(nodes, wfId, errors) {
  for (const node of nodes) {
    if (!UUID_V4_RE.test(node.id)) {
      errors.push(`${wfId}: Node "${node.name}" has invalid UUID v4 id: ${node.id}`);
    }
  }
}

function validateNoDuplicateNames(nodes, wfId, errors) {
  const seen = new Map();
  for (const node of nodes) {
    if (seen.has(node.name)) {
      errors.push(`${wfId}: Duplicate node name "${node.name}" (first at node id ${seen.get(node.name)})`);
    } else {
      seen.set(node.name, node.id);
    }
  }
}

function validateConnections(wf, wfId, errors) {
  const nodeNames = collectNodeNames(wf.nodes);
  const connections = wf.connections || {};

  // Check that all source nodes in connections exist
  for (const srcName of Object.keys(connections)) {
    if (!nodeNames.has(srcName)) {
      errors.push(`${wfId}: Connection references nonexistent source node "${srcName}"`);
      continue;
    }
    const outputs = connections[srcName].main || [];
    for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
      const targets = outputs[outIdx] || [];
      for (const target of targets) {
        if (!nodeNames.has(target.node)) {
          errors.push(`${wfId}: Connection from "${srcName}" references nonexistent target node "${target.node}"`);
        }
      }
    }
  }
}

function validateNoOrphanedNodes(wf, wfId, errors) {
  const nodeNames = collectNodeNames(wf.nodes);
  const connections = wf.connections || {};

  // Nodes that are targets of at least one connection
  const referenced = new Set();
  for (const srcName of Object.keys(connections)) {
    const outputs = connections[srcName].main || [];
    for (const targets of outputs) {
      for (const target of targets) {
        referenced.add(target.node);
      }
    }
  }

  // Nodes that are sources of at least one connection
  const sources = new Set(Object.keys(connections));

  // The first node in the workflow (trigger) is the entry point
  // It doesn't need to be a target
  const firstNode = wf.nodes[0] ? wf.nodes[0].name : null;

  // Also nodes that are the last in the chain (no outgoing connections)
  // are not orphaned if they are reachable
  for (const name of nodeNames) {
    if (name === firstNode) continue; // Entry point
    if (referenced.has(name)) continue; // Has incoming
    if (sources.has(name)) continue; // Has outgoing (shouldn't happen without incoming)
    // Check if this is the error trigger node (WF-14)
    const node = wf.nodes.find(n => n.name === name);
    if (node && ERROR_TRIGGER_TYPES.includes(node.type)) continue;
    errors.push(`${wfId}: Orphaned node "${name}" — no incoming connections`);
  }
}

function validateRequiredNodes(wf, wfId, errors) {
  const nodeTypes = wf.nodes.map(n => n.type);
  const hasWebhook = nodeTypes.some(t => WEBHOOK_TYPES.includes(t));
  const hasRespond = nodeTypes.some(t => RESPOND_TYPES.includes(t));
  const hasPostgres = nodeTypes.some(t => POSTGRES_TYPES.includes(t));
  const hasErrorTrigger = nodeTypes.some(t => ERROR_TRIGGER_TYPES.includes(t));

  // Webhook trigger (except WF-14 which uses errorTrigger)
  if (!NO_WEBHOOK_WF.includes(wfId)) {
    if (!hasWebhook && !hasErrorTrigger) {
      errors.push(`${wfId}: Missing webhook trigger node`);
    }
  }

  // respondToWebhook (except WF-14, WF-15)
  if (!NO_RESPOND_WF.includes(wfId)) {
    if (!hasRespond) {
      errors.push(`${wfId}: Missing respondToWebhook node`);
    }
  }

  // Postgres nodes (all workflows should have at least one if they interact with DB)
  // This is a soft check — some workflows may be pure logic
  // We'll note absence but not fail
}

function validateSettings(wf, wfId, errors) {
  if (!wf.settings) {
    errors.push(`${wfId}: Missing settings object`);
    return;
  }
  if (!wf.settings.callerPolicy) {
    errors.push(`${wfId}: Missing settings.callerPolicy`);
  }
}

function validateNoSecrets(wf, wfId, errors) {
  const wfStr = JSON.stringify(wf);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.re.test(wfStr)) {
      errors.push(`${wfId}: Potential embedded secret detected (${pattern.name})`);
    }
  }
}

function validateOutputStructure(wf, wfId, errors) {
  const contractFields = WORKFLOW_CONTRACTS[wfId];
  if (!contractFields) {
    return;
  }

  // If the workflow uses ExecuteWorkflow nodes, output is dynamic (comes from sub-workflows)
  const hasExecuteWorkflow = wf.nodes.some(n => n.type === 'n8n-nodes-base.executeWorkflow');
  if (hasExecuteWorkflow) {
    return;
  }

  // Collect output fields from all Set nodes and Code nodes
  const outputFields = new Set();
  for (const node of wf.nodes) {
    if (node.type === 'n8n-nodes-base.set') {
      for (const f of collectSetNodeOutputFields(node)) {
        outputFields.add(f);
      }
    }
    if (node.type === 'n8n-nodes-base.code') {
      const jsCode = (node.parameters || {}).jsCode || '';
      const fields = extractCodeNodeFields(jsCode);
      for (const f of fields) {
        outputFields.add(f);
      }
    }
  }

  const missingFields = [];
  for (const field of contractFields) {
    if (!outputFields.has(field)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    errors.push(`${wfId}: Output missing required fields from contract: ${missingFields.join(', ')}`);
  }
}

// Extract field names from a Code node's return statement
function extractCodeNodeFields(jsCode) {
  const fields = [];
  const jsKeywords = new Set([
    'if', 'else', 'for', 'while', 'return', 'function', 'const', 'let', 'var',
    'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'new', 'this',
    'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue',
    'do', 'in', 'of', 'class', 'extends', 'super', 'import', 'export', 'default',
  ]);

  // Match return [{ ... }] or return [{ ... }];
  const returnArrayMatch = jsCode.match(/return\s+\[\s*\{([\s\S]*?)\}\s*\]\s*;?\s*$/);
  if (returnArrayMatch) {
    const body = returnArrayMatch[1];
    const propRe = /(\w+)\s*:/g;
    let m;
    while ((m = propRe.exec(body)) !== null) {
      if (!jsKeywords.has(m[1])) {
        fields.push(m[1]);
      }
    }
  }

  // Match: return { ... } or return $.return({ ... })
  const returnObjMatch = jsCode.match(/return\s+(?:\$\.return\s*\(\s*)?\{([\s\S]*?)\}\s*\)?\s*;?\s*$/);
  if (returnObjMatch) {
    const body = returnObjMatch[1];
    const propRe = /(\w+)\s*:/g;
    let m;
    while ((m = propRe.exec(body)) !== null) {
      if (!jsKeywords.has(m[1])) {
        fields.push(m[1]);
      }
    }
  }

  // Match: items.push({ ... }) patterns
  const pushMatch = jsCode.match(/\.push\s*\(\s*\{([\s\S]*?)\}\s*\)/g);
  if (pushMatch) {
    for (const push of pushMatch) {
      const propRe = /(\w+)\s*:/g;
      let m;
      while ((m = propRe.exec(push)) !== null) {
        fields.push(m[1]);
      }
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const workflowFiles = getWorkflowFiles();

  if (workflowFiles.length === 0) {
    console.error('ERROR: No workflow JSON files found in', WORKFLOWS_DIR);
    process.exit(1);
  }

  console.log(`Validating ${workflowFiles.length} workflow files from ${WORKFLOWS_DIR}\n`);

  const results = [];
  let totalErrors = 0;

  for (const file of workflowFiles) {
    const wfId = extractWorkflowId(file);
    const filePath = path.join(WORKFLOWS_DIR, file);
    const errors = [];

    let wf;
    try {
      wf = loadJsonFile(filePath);
    } catch (e) {
      errors.push(`${wfId || file}: Failed to parse JSON: ${e.message}`);
      results.push({ wfId: wfId || file, file, passed: false, errors });
      totalErrors += errors.length;
      continue;
    }

    if (!wf.nodes || !Array.isArray(wf.nodes)) {
      errors.push(`${wfId || file}: Missing or invalid 'nodes' array`);
      results.push({ wfId: wfId || file, file, passed: false, errors });
      totalErrors += errors.length;
      continue;
    }

    // Run all validations
    validateNodeIds(wf.nodes, wfId, errors);
    validateNoDuplicateNames(wf.nodes, wfId, errors);
    validateConnections(wf, wfId, errors);
    validateNoOrphanedNodes(wf, wfId, errors);
    validateRequiredNodes(wf, wfId, errors);
    validateSettings(wf, wfId, errors);
    validateNoSecrets(wf, wfId, errors);
    validateOutputStructure(wf, wfId, errors);

    const passed = errors.length === 0;
    results.push({ wfId, file, passed, errors });
    totalErrors += errors.length;
  }

  // Print summary table
  console.log('='.repeat(80));
  console.log('WORKFLOW STRUCTURE VALIDATION RESULTS');
  console.log('='.repeat(80));
  console.log(`${'Workflow'.padEnd(12)} ${'File'.padEnd(35)} ${'Status'.padEnd(10)} Errors`);
  console.log('-'.repeat(80));

  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const errorCount = r.errors.length;
    console.log(`${(r.wfId || 'UNKNOWN').padEnd(12)} ${r.file.padEnd(35)} ${status.padEnd(10)} ${errorCount}`);
  }

  console.log('-'.repeat(80));
  const passCount = results.filter(r => r.passed).length;
  console.log(`Total: ${passCount}/${results.length} passed, ${totalErrors} error(s)`);
  console.log('='.repeat(80));

  // Print detailed errors for failures
  if (totalErrors > 0) {
    console.log('\n--- DETAILED ERRORS ---\n');
    for (const r of results) {
      if (r.errors.length > 0) {
        console.log(`[${r.wfId}] ${r.file}:`);
        for (const err of r.errors) {
          console.log(`  ✗ ${err}`);
        }
        console.log('');
      }
    }
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();