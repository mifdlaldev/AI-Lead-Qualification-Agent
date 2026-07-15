#!/bin/bash
# I-07: AI Semantic Analysis Test Suite
# Runs: I-04 + I-05 + I-06 regression + I-07 tests
set -e

PASS=0
FAIL=0

run_test() {
  local label="$1"
  local cmd="$2"
  echo "--- $label ---"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  ✅ $label: PASS"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label: FAIL"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

echo "========================================"
echo " I-07: AI Semantic Analysis"
echo "========================================"
echo ""

# I-04/I-05/I-06 Regression (must still pass)
echo "=== Regression (I-04 + I-05 + I-06) ==="
run_test "I-04: validate-workflow-structure" "node tests/validate-workflow-structure.js"
run_test "I-04: contract-compliance" "node tests/contract-compliance-check.js"
run_test "I-05: validate-wf05-idempotency" "node tests/validate-wf05-idempotency.js"
run_test "I-05: test-idempotency-logic" "node tests/test-idempotency-logic.js"
run_test "I-06: validate-wf06-prequalification" "node tests/validate-wf06-prequalification.js"
run_test "I-06: test-prequalification-logic" "node tests/test-prequalification-logic.js"

# I-07 Core Tests
echo "=== I-07 AI Semantic Analysis ==="
run_test "I-07: WF-07 Structure Validation" "node tests/validate-wf07-ai-analysis.js"
run_test "I-07: AI Analysis Logic" "node tests/test-ai-analysis-logic.js"
run_test "I-07: AI Failure Mode Analysis" "node tests/analyze-ai-failure-modes.js"

echo "========================================"
echo " Summary"
echo "========================================"
echo "  Passed: $PASS/9"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ $FAIL test(s) FAILED"
  exit 1
else
  echo "  ✅ All $PASS tests PASSED"
  exit 0
fi