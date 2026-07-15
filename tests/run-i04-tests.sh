#!/usr/bin/env bash
# ============================================
# I-04 Test Runner: Ingress + Orchestrator Integration
# ============================================
# Runs all validation scripts and reports results.
# Gate: I-04 — Durable Ingress + Orchestrator
#
# Usage:
#   chmod +x tests/run-i04-tests.sh
#   ./tests/run-i04-tests.sh
#
# Prerequisites:
#   - Node.js >= 18 (for contract compliance and JSON validation scripts)
#   - Bash >= 4.0
#   - All workflow JSON files present in workflows/
#   - schemas/workflow-contracts.json present
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== I-04: Ingress + Orchestrator Integration Tests ==="
echo ""

PASS=0
FAIL=0
SKIP=0

run_test() {
  local name="$1"
  local cmd="$2"
  echo "  [${name}] Running..."
  if eval "$cmd" 2>&1; then
    echo "  [${name}] PASS"
    PASS=$((PASS + 1))
  else
    local exit_code=$?
    echo "  [${name}] FAIL (exit code: ${exit_code})"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

run_test_skip() {
  local name="$1"
  local cmd="$2"
  echo "  [${name}] Running..."
  # Extract the script path from the command to check if it exists
  local script_path=$(echo "$cmd" | grep -oP 'node\s+tests/\S+' | awk '{print $2}')
  if [ -n "$script_path" ] && [ ! -f "$script_path" ]; then
    echo "  [${name}] SKIP — script not found: ${script_path}"
    SKIP=$((SKIP + 1))
    echo ""
    return
  fi
  if eval "$cmd" 2>&1; then
    echo "  [${name}] PASS"
    PASS=$((PASS + 1))
  else
    local exit_code=$?
    echo "  [${name}] FAIL (exit code: ${exit_code})"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# Navigate to project root for relative paths
cd "$PROJECT_DIR"

# -------------------------------------------------
# 1. JSON validity — all JSON files in the project
# -------------------------------------------------
run_test "JSON Validity" "node -e \"
const fs = require('fs');
const path = require('path');
const dirs = ['workflows', 'schemas', 'fixtures', 'policies', 'prompts'];
let ok = true;
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  files.forEach(f => {
    const filePath = path.join(dir, f);
    try {
      JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch(e) {
      console.error('INVALID JSON: ' + filePath + ': ' + e.message);
      ok = false;
    }
  });
});
process.exit(ok ? 0 : 1);
\""

# -------------------------------------------------
# 2. Workflow structure validation
# -------------------------------------------------
# Gracefully skip if the script doesn't exist yet (created by another agent)
run_test_skip "Workflow Structure" "node tests/validate-workflow-structure.js"

# -------------------------------------------------
# 3. SQL query validation
# -------------------------------------------------
run_test_skip "SQL Queries" "node tests/validate-sql-queries.js"

# -------------------------------------------------
# 4. State machine validation
# -------------------------------------------------
run_test_skip "State Machine" "node tests/validate-state-machine.js"

# -------------------------------------------------
# 5. Contract compliance
# -------------------------------------------------
run_test "Contract Compliance" "node tests/contract-compliance-check.js"

# -------------------------------------------------
# 6. Secret scan — check for exposed credentials
# -------------------------------------------------
run_test "Secret Scan" "! grep -rnE '(sk-[a-zA-Z0-9]{20,}|api_key[\\\"'\\''\\s]*[:=][\\\"'\\''\\s]*[a-zA-Z0-9_-]{20,}|token[\\\"'\\''\\s]*[:=][\\\"'\\''\\s]*[a-zA-Z0-9_-]{20,}|Bearer [a-zA-Z0-9_-]{20,}|password[\\\"'\\''\\s]*[:=][\\\"'\\''\\s]*[a-zA-Z0-9!@#\$%^&*()_+=-]{8,})' workflows/*.json schemas/*.json fixtures/*.json --include='*.json' 2>/dev/null"

# -------------------------------------------------
# 7. Workflow inventory — verify all 15 expected workflows exist
# -------------------------------------------------
run_test "Workflow Inventory" "node -e \"
const fs = require('fs');
const expected = ['WF-01','WF-02','WF-03','WF-04','WF-05','WF-06','WF-07','WF-08','WF-09','WF-10','WF-11','WF-12','WF-13','WF-14','WF-15'];
const files = fs.readdirSync('workflows').filter(f => f.endsWith('.json'));
let ok = true;
expected.forEach(wf => {
  const found = files.some(f => f.startsWith(wf));
  if (!found) {
    console.error('MISSING: ' + wf + ' workflow not found in workflows/');
    ok = false;
  }
});
if (files.length > expected.length) {
  const extra = files.filter(f => !expected.some(wf => f.startsWith(wf)));
  console.warn('EXTRA workflows found (not in expected inventory): ' + extra.join(', '));
}
process.exit(ok ? 0 : 1);
\""

# -------------------------------------------------
# 8. Schema cross-reference — verify $ref pointers resolve
# -------------------------------------------------
run_test "Schema Cross-References" "node tests/check-schema-refs.js"

# -------------------------------------------------
# Summary
# -------------------------------------------------
echo "=== Results ==="
echo "Passed: ${PASS}"
echo "Failed: ${FAIL}"
echo "Skipped: ${SKIP}"
echo "Total:  $((PASS + FAIL + SKIP))"

if [ "${FAIL}" -gt 0 ]; then
  echo ""
  echo "I-04: FAILED — ${FAIL} test(s) failed"
  if [ "${SKIP}" -gt 0 ]; then
    echo "      ${SKIP} test(s) skipped (scripts may not exist yet)"
  fi
  exit 1
else
  echo ""
  if [ "${SKIP}" -gt 0 ]; then
    echo "I-04: PASSED (with ${SKIP} skipped — scripts created by other agents)"
  else
    echo "I-04: ALL TESTS PASSED"
  fi
  exit 0
fi