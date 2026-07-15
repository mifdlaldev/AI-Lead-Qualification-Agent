#!/usr/bin/env node

/**
 * tests/validate-state-machine.js
 *
 * Extracts all state transitions from WF-03 orchestrator's processing_events
 * INSERT statements, builds the observed transition graph, and validates
 * against the documented state machine.
 *
 * Run: node tests/validate-state-machine.js
 * Exit: 0 if all pass, 1 if any fail.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WF03_PATH = path.join(__dirname, '..', 'workflows', 'WF-03-lead-orchestrator.json');
const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');

// Sub-workflows called by WF-03 that may contain state transitions
const SUB_WORKFLOWS = [
  'WF-04-validate-normalize-lead.json',
  'WF-05-claim-lead-idempotency.json',
  'WF-06-deterministic-prequalification.json',
  'WF-07-ai-semantic-analysis.json',
  'WF-08-qualification-decision.json',
  'WF-09-human-review.json',
  'WF-10-route-final-disposition.json',
  'WF-13-resolve-human-review.json',
];

// Valid transitions from docs/business/state-machine-and-routing.md
const VALID_TRANSITIONS = {
  'RECEIVED': ['VALIDATING'],
  'VALIDATING': ['INVALID', 'DEDUPLICATING'],
  'DEDUPLICATING': ['DUPLICATE', 'PREQUALIFYING'],
  'PREQUALIFYING': ['DECIDING', 'ANALYZING'],
  'ANALYZING': ['DECIDING', 'AWAITING_HUMAN_REVIEW', 'RETRY_PENDING', 'FAILED'],
  'DECIDING': ['ROUTING', 'AWAITING_HUMAN_REVIEW'],
  'AWAITING_HUMAN_REVIEW': ['ROUTING'],
  'ROUTING': ['COMPLETED', 'RETRY_PENDING', 'FAILED'],
  'RETRY_PENDING': [], // entry point for retry
  'INVALID': [], // terminal
  'DUPLICATE': [], // terminal
  'COMPLETED': [], // terminal
  'FAILED': [], // terminal
};

// Mandatory happy path (must be covered)
const MANDATORY_PATH = [
  { from: 'RECEIVED', to: 'VALIDATING' },
  { from: 'VALIDATING', to: 'DEDUPLICATING' },
  { from: 'DEDUPLICATING', to: 'PREQUALIFYING' },
  { from: 'PREQUALIFYING', to: 'ANALYZING' },
  { from: 'ANALYZING', to: 'DECIDING' },
  { from: 'DECIDING', to: 'ROUTING' },
  { from: 'ROUTING', to: 'COMPLETED' },
];

// Branch paths that must be covered
const BRANCH_PATHS = [
  { from: 'VALIDATING', to: 'INVALID', label: 'INVALID branch' },
  { from: 'DEDUPLICATING', to: 'DUPLICATE', label: 'DUPLICATE branch' },
  { from: 'DECIDING', to: 'AWAITING_HUMAN_REVIEW', label: 'HUMAN_REVIEW branch' },
  { from: 'ANALYZING', to: 'FAILED', label: 'AI FAILED branch' },
  { from: 'DECIDING', to: 'ROUTING', label: 'DECIDING→ROUTING (no review)' },
];

// All valid processing states
const ALL_STATES = [
  'RECEIVED', 'VALIDATING', 'INVALID', 'DEDUPLICATING', 'DUPLICATE',
  'PREQUALIFYING', 'ANALYZING', 'DECIDING', 'AWAITING_HUMAN_REVIEW',
  'ROUTING', 'COMPLETED', 'RETRY_PENDING', 'FAILED',
];

// ---------------------------------------------------------------------------
// Transition extraction
// ---------------------------------------------------------------------------

function extractTransitions(wf) {
  const transitions = [];

  for (const node of wf.nodes) {
    if (node.type !== 'n8n-nodes-base.postgres') continue;

    const query = (node.parameters || {}).query || '';
    if (!query.includes('processing_events')) continue;

    // Extract previous_state and new_state from INSERT statements
    // Pattern: INSERT INTO processing_events (... previous_state, new_state ...) VALUES (... 'PREVIOUS', 'NEW' ...)
    // The values are in n8n template format: '{{ $json.previous_state }}', 'STATE_NAME'
    // or hardcoded: 'RECEIVED', 'VALIDATING'

    // Try to extract hardcoded previous_state and new_state from the VALUES clause
    const valuesMatch = query.match(/VALUES\s*\(([\s\S]*?)\)(?:\s*(?:RETURNING|ON\s+CONFLICT|;|$))/i);
    if (!valuesMatch) continue;

    const valuesStr = valuesMatch[1];

    // Find the positions of previous_state and new_state by looking at the column list
    const colMatch = query.match(/INSERT\s+INTO\s+processing_events\s*\(([^)]+)\)/i);
    if (!colMatch) continue;

    const columns = colMatch[1].split(',').map(c => c.trim().toLowerCase());
    const prevIdx = columns.indexOf('previous_state');
    const newIdx = columns.indexOf('new_state');

    if (prevIdx === -1 || newIdx === -1) continue;

    // Extract values, handling nested parens and quotes
    const values = splitValues(valuesStr);

    const prevState = extractStateValue(values[prevIdx]);
    const newState = extractStateValue(values[newIdx]);

    if (prevState && newState) {
      // Skip n8n template expressions — we can't resolve them statically
      if (prevState.includes('{{') || newState.includes('{{')) {
        // Still try to extract if the template has a static fallback
        // e.g., '{{ $json.reason_codes[0] || "V-001" }}' → we can't resolve
        const staticPrev = extractStaticFromTemplate(prevState);
        const staticNew = extractStaticFromTemplate(newState);

        if (staticPrev && staticNew) {
          transitions.push({
            from: staticPrev,
            to: staticNew,
            nodeName: node.name,
            query: query.substring(0, 120) + '...',
          });
        }
        continue;
      }

      transitions.push({
        from: prevState,
        to: newState,
        nodeName: node.name,
        query: query.substring(0, 120) + '...',
      });
    }
  }

  return transitions;
}

// Split VALUES clause by commas, respecting nested parens and quotes
function splitValues(str) {
  const parts = [];
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      current += ch;
      if (ch === quoteChar && i > 0 && str[i - 1] !== '\\') {
        inQuote = false;
      }
    } else if (ch === "'" || ch === '"') {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Extract a state value from a value string
function extractStateValue(val) {
  val = val.trim();
  // Remove surrounding quotes
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  // Check if it looks like a valid state name
  const upper = val.toUpperCase().replace(/[^A-Z_]/g, '');
  if (ALL_STATES.includes(upper)) {
    return upper;
  }
  return null;
}

// Try to extract a static value from an n8n template expression
// e.g., '{{ $json.reason_codes[0] || "V-001" }}' → null (can't resolve)
// e.g., 'RECEIVED' → 'RECEIVED'
function extractStaticFromTemplate(val) {
  val = val.trim();
  if (!val.includes('{{')) return val.replace(/^['"]|['"]$/g, '');

  // Check for || fallback pattern: '{{ expr || "STATIC" }}'
  const fallbackMatch = val.match(/\|\|\s*['"](\w+)['"]/);
  if (fallbackMatch) {
    const fallback = fallbackMatch[1].toUpperCase();
    if (ALL_STATES.includes(fallback)) return fallback;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function buildTransitionGraph(transitions) {
  const graph = {};
  for (const t of transitions) {
    if (!graph[t.from]) graph[t.from] = new Set();
    graph[t.from].add(t.to);
  }
  return graph;
}

function validateTransitions(transitions) {
  const errors = [];
  const warnings = [];
  const graph = buildTransitionGraph(transitions);

  // Check each observed transition against valid transitions
  for (const t of transitions) {
    const validTargets = VALID_TRANSITIONS[t.from];
    if (!validTargets) {
      errors.push(`Unknown source state "${t.from}" in transition (node: ${t.nodeName})`);
      continue;
    }
    if (!validTargets.includes(t.to)) {
      errors.push(
        `Invalid transition: ${t.from} → ${t.to} (node: ${t.nodeName}). ` +
        `Valid targets from ${t.from}: ${validTargets.join(', ') || '(terminal)'}`
      );
    }
  }

  // Check mandatory happy path
  const missingMandatory = [];
  for (const step of MANDATORY_PATH) {
    const targets = graph[step.from];
    if (!targets || !targets.has(step.to)) {
      missingMandatory.push(`${step.from} → ${step.to}`);
    }
  }

  if (missingMandatory.length > 0) {
    errors.push(`Missing mandatory happy-path transitions: ${missingMandatory.join(', ')}`);
  }

  // Check branch paths
  const missingBranches = [];
  for (const branch of BRANCH_PATHS) {
    const targets = graph[branch.from];
    if (!targets || !targets.has(branch.to)) {
      missingBranches.push(`${branch.from} → ${branch.to} (${branch.label})`);
    }
  }

  if (missingBranches.length > 0) {
    warnings.push(`Missing branch paths: ${missingBranches.join(', ')}`);
  }

  return { errors, warnings, graph };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function printTransitionDiagram(transitions, graph) {
  console.log('');
  console.log('OBSERVED TRANSITION DIAGRAM');
  console.log('===========================');

  const sortedSources = Object.keys(graph).sort((a, b) => {
    const idxA = ALL_STATES.indexOf(a);
    const idxB = ALL_STATES.indexOf(b);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  for (const src of sortedSources) {
    const targets = [...graph[src]].sort();
    for (const tgt of targets) {
      const isValid = (VALID_TRANSITIONS[src] || []).includes(tgt);
      const marker = isValid ? '✓' : '✗';
      console.log(`  ${src.padEnd(24)} ${marker} → ${tgt}`);
    }
  }
}

function printMandatoryPathResults(graph) {
  console.log('');
  console.log('MANDATORY HAPPY PATH');
  console.log('====================');

  for (const step of MANDATORY_PATH) {
    const targets = graph[step.from];
    const covered = targets && targets.has(step.to);
    const marker = covered ? '✓ PASS' : '✗ MISSING';
    console.log(`  ${step.from.padEnd(24)} → ${step.to.padEnd(24)} ${marker}`);
  }
}

function printBranchPathResults(graph) {
  console.log('');
  console.log('BRANCH PATHS');
  console.log('============');

  for (const branch of BRANCH_PATHS) {
    const targets = graph[branch.from];
    const covered = targets && targets.has(branch.to);
    const marker = covered ? '✓ PASS' : '✗ MISSING';
    console.log(`  ${branch.from.padEnd(24)} → ${branch.to.padEnd(24)} ${marker}  (${branch.label})`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const allTransitions = [];

  // Load WF-03
  let wf;
  try {
    wf = JSON.parse(fs.readFileSync(WF03_PATH, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: Cannot read WF-03 file: ${WF03_PATH}`);
    console.error(e.message);
    process.exit(1);
  }

  console.log(`Loaded: ${wf.name}`);
  console.log(`Nodes: ${wf.nodes.length}`);

  const wf03Transitions = extractTransitions(wf);
  allTransitions.push(...wf03Transitions);
  console.log(`\nWF-03 transitions: ${wf03Transitions.length}`);

  // Scan sub-workflows for transitions
  for (const subFile of SUB_WORKFLOWS) {
    const subPath = path.join(WORKFLOWS_DIR, subFile);
    if (!fs.existsSync(subPath)) {
      console.log(`  Sub-workflow not found: ${subFile}`);
      continue;
    }
    const subWf = JSON.parse(fs.readFileSync(subPath, 'utf-8'));
    const subTransitions = extractTransitions(subWf);
    if (subTransitions.length > 0) {
      allTransitions.push(...subTransitions);
      console.log(`  ${subFile}: ${subTransitions.length} transitions`);
    }
  }

  console.log(`\nTotal transitions extracted: ${allTransitions.length}:\n`);

  for (const t of allTransitions) {
    console.log(`  ${t.from.padEnd(24)} → ${t.to.padEnd(24)}  [${t.nodeName}]`);
  }

  // Validate
  const { errors, warnings, graph } = validateTransitions(allTransitions);

  // Print diagram
  printTransitionDiagram(allTransitions, graph);
  printMandatoryPathResults(graph);
  printBranchPathResults(graph);

  // Print errors and warnings
  if (errors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION ERRORS');
    console.log('='.repeat(80));
    for (const err of errors) {
      console.log(`  ✗ ${err}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION WARNINGS');
    console.log('='.repeat(80));
    for (const warn of warnings) {
      console.log(`  ⚠ ${warn}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('STATE MACHINE VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Transitions extracted: ${allTransitions.length}`);
  console.log(`Unique transitions: ${new Set(allTransitions.map(t => `${t.from}→${t.to}`)).size}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  // Check mandatory path
  const mandatoryPassed = MANDATORY_PATH.every(step => {
    const targets = graph[step.from];
    return targets && targets.has(step.to);
  });

  const branchPassed = BRANCH_PATHS.every(branch => {
    const targets = graph[branch.from];
    return targets && targets.has(branch.to);
  });

  console.log(`Mandatory happy path: ${mandatoryPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Branch paths: ${branchPassed ? '✓ PASS' : '✗ FAIL'}`);

  const allPassed = errors.length === 0;

  console.log(`\nOverall: ${allPassed ? '✓ ALL CHECKS PASSED' : '✗ VALIDATION FAILED'}`);
  console.log('='.repeat(80));

  process.exit(allPassed ? 0 : 1);
}

main();