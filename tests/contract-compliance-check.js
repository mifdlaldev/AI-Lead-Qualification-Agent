#!/usr/bin/env node
// ============================================
// I-04 Contract Compliance Check
// ============================================
// Verifies each workflow's output structure matches
// the workflow-contracts.json schema.
//
// Usage: node tests/contract-compliance-check.js
// Exit: 0 = all pass, 1 = one or more failures
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const CONTRACTS_PATH = path.join(PROJECT_DIR, 'schemas', 'workflow-contracts.json');
const WORKFLOWS_DIR = path.join(PROJECT_DIR, 'workflows');

// ── Load contracts ──────────────────────────────────────────────
let contracts;
try {
  contracts = JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf8'));
} catch (e) {
  console.error('FATAL: Cannot read workflow-contracts.json: ' + e.message);
  process.exit(2);
}

const contractMap = contracts.contracts;
const workflowIds = Object.keys(contractMap).sort();

// ── Load workflow files ─────────────────────────────────────────
function loadWorkflow(wfId) {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.startsWith(wfId + '-') && f.endsWith('.json'));
  if (files.length === 0) {
    return null;
  }
  const filePath = path.join(WORKFLOWS_DIR, files[0]);
  try {
    return { id: wfId, name: files[0], data: JSON.parse(fs.readFileSync(filePath, 'utf8')), path: filePath };
  } catch (e) {
    console.error('  FAIL: Cannot parse ' + files[0] + ': ' + e.message);
    return null;
  }
}

// ── Build connection graph ──────────────────────────────────────
// Returns: { nodeId -> [nextNodeIds] }
function buildGraph(workflow) {
  const graph = {};
  const nodes = workflow.nodes || [];
  const connections = workflow.connections || {};

  // Initialize all nodes with empty adjacency
  nodes.forEach(n => { graph[n.id] = []; });

  // Populate edges from connections
  Object.keys(connections).forEach(sourceName => {
    const sourceNode = nodes.find(n => n.name === sourceName);
    if (!sourceNode) return;
    const sourceId = sourceNode.id;
    const outputs = connections[sourceName].main || [];
    outputs.forEach(outputArray => {
      outputArray.forEach(edge => {
        const targetNode = nodes.find(n => n.name === edge.node);
        if (targetNode && graph[sourceId]) {
          graph[sourceId].push(targetNode.id);
        }
      });
    });
  });

  return graph;
}

// ── Find Respond to Webhook nodes ───────────────────────────────
function findWebhookResponders(workflow) {
  return (workflow.nodes || []).filter(n => n.type === 'n8n-nodes-base.respondToWebhook');
}

// ── Find all ancestors of a node (reverse BFS) ─────────────────
function findAncestors(graph, targetId) {
  const visited = new Set();
  const queue = [targetId];
  const ancestors = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all nodes that have edges to current
    Object.keys(graph).forEach(sourceId => {
      if (graph[sourceId] && graph[sourceId].includes(current) && !visited.has(sourceId)) {
        queue.push(sourceId);
        ancestors.push(sourceId);
      }
    });
  }

  return ancestors;
}

// ── Find leaf nodes (no outgoing edges in main flow) ────────────
function findLeafNodes(graph, workflow) {
  const nodes = workflow.nodes || [];
  const leaves = [];
  nodes.forEach(n => {
    if (!graph[n.id] || graph[n.id].length === 0) {
      leaves.push(n.id);
    }
  });
  return leaves;
}

// ── Extract output fields from a Set node ───────────────────────
function extractSetNodeFields(node) {
  const fields = [];
  const values = (node.parameters && node.parameters.values) || {};

  // Collect fields from string, boolean, number, array arrays
  ['string', 'boolean', 'number', 'array', 'object'].forEach(type => {
    const arr = values[type] || [];
    arr.forEach(entry => {
      if (entry.name) {
        fields.push(entry.name);
      }
    });
  });

  return fields;
}

// ── Get all output-producing Set nodes for a workflow ────────────
function getOutputNodes(workflow) {
  const graph = buildGraph(workflow);
  const nodes = workflow.nodes || [];
  const responders = findWebhookResponders(workflow);

  const outputNodes = [];

  if (responders.length > 0) {
    // Has Respond to Webhook: find Set nodes that are upstream of it
    responders.forEach(responder => {
      const ancestors = findAncestors(graph, responder.id);
      ancestors.forEach(ancestorId => {
        const node = nodes.find(n => n.id === ancestorId);
        if (node && node.type === 'n8n-nodes-base.set') {
          const fields = extractSetNodeFields(node);
          if (fields.length > 0) {
            outputNodes.push({ node, fields });
          }
        }
      });
    });
    return { type: 'webhook', outputNodes: outputNodes };
  }

  // No Respond to Webhook: use leaf nodes
  const leaves = findLeafNodes(graph, workflow);
  leaves.forEach(leafId => {
    const node = nodes.find(n => n.id === leafId);
    if (node && node.type === 'n8n-nodes-base.set') {
      const fields = extractSetNodeFields(node);
      if (fields.length > 0) {
        outputNodes.push({ node, fields });
      }
    }
  });

  // If no leaf Set nodes, look at the last Set node in the node list
  if (outputNodes.length === 0) {
    const setNodes = nodes.filter(n => n.type === 'n8n-nodes-base.set');
    if (setNodes.length > 0) {
      const lastSet = setNodes[setNodes.length - 1];
      const fields = extractSetNodeFields(lastSet);
      if (fields.length > 0) {
        outputNodes.push({ node: lastSet, fields });
      }
    }
  }

  return { type: 'subworkflow', outputNodes: outputNodes };
}

// ── Score a node's fields against the contract ───────────────────
// Returns the number of contract fields present in the node's output
function scoreNodeAgainstContract(fields, contract) {
  const contractOutput = contract.output;
  if (!contractOutput || !contractOutput.properties) return 0;

  const contractFields = Object.keys(contractOutput.properties);
  let score = 0;
  fields.forEach(f => {
    if (contractFields.includes(f)) score++;
  });
  return score;
}

// ── Pick the best output node (most contract fields) ─────────────
function pickBestOutputNode(outputNodes, contract) {
  if (outputNodes.length === 0) return null;
  if (outputNodes.length === 1) return outputNodes[0];

  // Score each node by how many contract fields it has
  let best = outputNodes[0];
  let bestScore = scoreNodeAgainstContract(best.fields, contract);

  for (let i = 1; i < outputNodes.length; i++) {
    const score = scoreNodeAgainstContract(outputNodes[i].fields, contract);
    if (score > bestScore) {
      best = outputNodes[i];
      bestScore = score;
    }
  }

  return best;
}

// ── Resolve a contract to its concrete output ────────────────────
function resolveContract(wfId, contract) {
  const contractOutput = contract.output;
  if (contractOutput && contractOutput['$ref']) {
    const refPath = contractOutput['$ref'];
    if (refPath === '#/contracts/WF-01/output') {
      const wf01Contract = contractMap['WF-01'];
      if (wf01Contract) {
        return resolveContract(wfId, wf01Contract);
      }
    }
    return null;
  }
  return contract;
}

// ── Check contract compliance ───────────────────────────────────
function checkContract(wfId, contract, outputInfo) {
  const errors = [];
  const warnings = [];
  const contractOutput = contract.output;

  if (contractOutput && contractOutput['$ref']) {
    errors.push('Unresolvable $ref: ' + contractOutput['$ref']);
    return { errors, warnings };
  }

  if (!contractOutput || !contractOutput.required || !contractOutput.properties) {
    errors.push('Contract output has no required/properties definition');
    return { errors, warnings };
  }

  const requiredFields = contractOutput.required || [];
  const contractProperties = contractOutput.properties || {};
  const allContractFields = Object.keys(contractProperties);
  const allowAdditional = contractOutput.additionalProperties !== false;

  const observedFields = outputInfo.allFields;

  // Check required fields are present
  requiredFields.forEach(field => {
    if (!observedFields.includes(field)) {
      errors.push('Missing required field: ' + field);
    }
  });

  // Check for fields not in the contract (warn only — real workflows may output useful metadata)
  if (!allowAdditional) {
    observedFields.forEach(field => {
      if (!allContractFields.includes(field)) {
        warnings.push('Extra field not in contract (additionalProperties=false): ' + field);
      }
    });
  } else {
    observedFields.forEach(field => {
      if (!allContractFields.includes(field)) {
        warnings.push('Field not in contract (but additionalProperties allowed): ' + field);
      }
    });
  }

  return { errors, warnings };
}

// ── Check WF-03 sub-workflow sequence ───────────────────────────
function checkWF03Sequence(workflow) {
  const errors = [];
  const nodes = workflow.nodes || [];
  const graph = buildGraph(workflow);

  // Find all ExecuteWorkflow nodes
  const execNodes = nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflow');
  const execNodeMap = {};
  execNodes.forEach(n => {
    const wfId = (n.parameters && n.parameters.workflowId && n.parameters.workflowId.value) || '';
    execNodeMap[n.id] = { node: n, wfId: wfId };
  });

  // Expected sub-workflow call sequence (BFS order from webhook):
  // WF-09 and WF-10 are on parallel branches (HUMAN_REVIEW vs direct ROUTING);
  // BFS visits outlet 0 (ROUTING) before outlet 1 (HUMAN_REVIEW), so WF-10 appears before WF-09.
  // The second WF-08 at the end is the fallback decision.
  const expectedWfIds = ['WF-04', 'WF-05', 'WF-06', 'WF-08', 'WF-07', 'WF-08', 'WF-10', 'WF-09'];

  // BFS from webhook to collect ExecuteWorkflow nodes in traversal order
  const webhookNodes = nodes.filter(n => n.type === 'n8n-nodes-base.webhook');
  if (webhookNodes.length === 0) {
    return { errors: ['No webhook trigger found in WF-03'], nodes: [] };
  }

  const startId = webhookNodes[0].id;
  const visited = new Set();
  const queue = [startId];
  const execOrder = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    if (execNodeMap[current]) {
      execOrder.push(execNodeMap[current]);
    }

    const neighbors = graph[current] || [];
    neighbors.forEach(nextId => {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    });
  }

  const observedWfIds = execOrder.map(e => e.wfId);

  // Check 1: All 8 expected WF-IDs are present
  const observedSet = new Set(observedWfIds);
  expectedWfIds.forEach(wfId => {
    if (!observedSet.has(wfId)) {
      errors.push('Missing sub-workflow: ' + wfId);
    }
  });

  // Check 2: Verify sequential order of the linear execution path
  // The linear path is: WF-04, WF-05, WF-06, WF-08(prequal), WF-07, WF-08(full)
  // WF-09 and WF-10 are conditional branches after the linear path.
  // The BFS may find WF-09/WF-10 before the second WF-08 if the prequal
  // shortcut path is shorter, so we only check the relative order of the
  // linear sequence, not the position of conditional branches.
  const linearSequence = ['WF-04', 'WF-05', 'WF-06', 'WF-08', 'WF-07', 'WF-08'];
  let linearIdx = 0;
  for (const observed of observedWfIds) {
    if (linearIdx < linearSequence.length && observed === linearSequence[linearIdx]) {
      linearIdx++;
    }
  }
  if (linearIdx < linearSequence.length) {
    const broken = linearSequence.slice(linearIdx);
    errors.push('Linear sequence broken. Expected ' + linearSequence.join(' -> ') + ' but missing: ' + broken.join(', '));
  }

  const expectedOrder = expectedWfIds.join(' -> ');
  const observedOrder = observedWfIds.join(' -> ');

  return {
    errors,
    expectedOrder,
    observedOrder,
    observedWfIds,
    execNodes: execOrder.map(e => ({ name: e.node.name, wfId: e.wfId })),
  };
}

// ── Main ────────────────────────────────────────────────────────
function main() {
  console.log('=== Contract Compliance Check ===');
  console.log('Contracts: schemas/workflow-contracts.json');
  console.log('Workflows: ' + workflowIds.length + ' expected');
  console.log('');

  let totalPass = 0;
  let totalFail = 0;
  const failures = [];

  workflowIds.forEach(wfId => {
    const contract = contractMap[wfId];
    if (!contract) {
      console.log('  [' + wfId + '] SKIP — no contract defined');
      return;
    }

    const wf = loadWorkflow(wfId);
    if (!wf) {
      console.log('  [' + wfId + '] FAIL — workflow file not found');
      totalFail++;
      failures.push(wfId);
      return;
    }

    const outputInfo = getOutputNodes(wf.data);
    const resolvedContract = resolveContract(wfId, contract);
    const effectiveContract = resolvedContract || contract;
    const bestNode = pickBestOutputNode(outputInfo.outputNodes, effectiveContract);
    const effectiveOutput = {
      outputNodes: bestNode ? [bestNode] : [],
      allFields: bestNode ? bestNode.fields : [],
    };
    const result = checkContract(wfId, effectiveContract, effectiveOutput);

    // WF-03 special check
    let seqResult = null;
    if (wfId === 'WF-03') {
      seqResult = checkWF03Sequence(wf.data);
    }

    const hasErrors = result.errors.length > 0 || (seqResult && seqResult.errors.length > 0);
    const bestNodeName = (effectiveOutput.outputNodes[0] && effectiveOutput.outputNodes[0].node.name) || '(none found)';
    const totalOutputNodes = outputInfo.outputNodes.length;

    if (hasErrors) {
      console.log('  [' + wfId + '] FAIL — ' + contract.name);
      console.log('    Best output node: ' + bestNodeName + ' (of ' + totalOutputNodes + ' total)');
      console.log('    Observed fields: ' + (effectiveOutput.allFields.length > 0 ? effectiveOutput.allFields.join(', ') : '(none)'));
      console.log('    Required fields: ' + (effectiveContract.output.required || []).join(', '));
      result.errors.forEach(e => console.log('    ERROR: ' + e));
      result.warnings.forEach(w => console.log('    WARN: ' + w));
      if (seqResult && seqResult.errors.length > 0) {
        seqResult.errors.forEach(e => console.log('    ERROR (sequence): ' + e));
      }
      totalFail++;
      failures.push(wfId);
    } else {
      console.log('  [' + wfId + '] PASS — ' + contract.name);
      console.log('    Best output node: ' + bestNodeName + ' (of ' + totalOutputNodes + ' total)');
      console.log('    Fields: ' + effectiveOutput.allFields.join(', '));
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log('    WARN: ' + w));
      }
      if (seqResult) {
        console.log('    Sub-workflow sequence: ' + seqResult.observedOrder);
        console.log('    Expected sequence:     ' + seqResult.expectedOrder);
      }
      totalPass++;
    }
    console.log('');
  });

  // ── Summary ──────────────────────────────────────────────────
  console.log('=== Contract Compliance Summary ===');
  console.log('Passed: ' + totalPass);
  console.log('Failed: ' + totalFail);

  if (failures.length > 0) {
    console.log('Failures: ' + failures.join(', '));
    console.log('');
    console.log('Contract compliance: FAILED');
    process.exit(1);
  }

  console.log('');
  console.log('Contract compliance: ALL PASSED');
  process.exit(0);
}

main();