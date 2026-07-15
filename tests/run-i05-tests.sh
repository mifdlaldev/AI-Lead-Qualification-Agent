#!/usr/bin/env bash
# I-05: Idempotency Integration Tests
# Runs all I-05 tests and reports results.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PASSED=0
FAILED=0
TOTAL=0

run_test() {
  local name="$1"
  local cmd="$2"
  local expected_exit="$3"
  TOTAL=$((TOTAL + 1))
  echo "  [$name] Running..."
  if eval "$cmd" > /tmp/i05_test_output.txt 2>&1; then
    local actual_exit=0
  else
    local actual_exit=$?
  fi
  if [ "$actual_exit" -eq "$expected_exit" ]; then
    PASSED=$((PASSED + 1))
    echo "  [$name] PASS"
  else
    FAILED=$((FAILED + 1))
    echo "  [$name] FAIL (exit: $actual_exit, expected: $expected_exit)"
    if [ "$actual_exit" -ne 0 ]; then
      echo "  ── Output ──"
      cat /tmp/i05_test_output.txt
      echo "  ────────────"
    fi
  fi
}
echo "=== I-05: Idempotency Integration Tests ==="
echo ""

# 1. I-04 baseline — all existing tests still pass
run_test "I-04 Baseline" "bash \"$SCRIPT_DIR/run-i04-tests.sh\"" 0

# 2. WF-05 Structure & SQL Validation
run_test "WF-05 Structure" "node \"$SCRIPT_DIR/validate-wf05-idempotency.js\"" 0

# 3. Idempotency Logic Unit Tests
run_test "Idempotency Logic" "node \"$SCRIPT_DIR/test-idempotency-logic.js\"" 0

# 4. Race Condition Analysis
run_test "Race Condition Analysis" "node \"$SCRIPT_DIR/analyze-race-conditions.js\"" 0

# 5. Contract compliance (WF-05)
run_test "Contract: WF-05" "node \"$SCRIPT_DIR/contract-compliance-check.js\" 2>&1 | grep -q '\[WF-05\] PASS'" 0

# 6. State machine — WF-05 state transitions
run_test "State Machine: WF-05" "node \"$SCRIPT_DIR/validate-state-machine.js\" 2>&1 | grep -q 'DEDUPLICATING.*DUPLICATE.*PASS'" 0

# 7. SQL queries — WF-05 SQL validation
run_test "SQL: WF-05" "node \"$SCRIPT_DIR/validate-sql-queries.js\" 2>&1 | grep -q 'WF-05.*PASS'" 0

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $TOTAL"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "I-05: FAILED — $FAILED test(s) failed"
  exit 1
else
  echo ""
  echo "I-05: ALL TESTS PASSED"
  exit 0
fi