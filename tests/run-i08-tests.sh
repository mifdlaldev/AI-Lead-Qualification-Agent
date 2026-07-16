#!/bin/bash
# I-08: Qualification Decision Test Suite
# Runs: I-04 + I-05 + I-06 + I-07 regression + I-08 tests
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
echo " I-08: Qualification Decision"
echo "========================================"
echo ""

# I-04/I-05/I-06/I-07 Regression
echo "=== Regression (I-04→I-07) ==="
run_test "I-04: validate-workflow-structure" "node tests/validate-workflow-structure.js"
run_test "I-04: contract-compliance" "node tests/contract-compliance-check.js"
run_test "I-05: validate-wf05-idempotency" "node tests/validate-wf05-idempotency.js"
run_test "I-05: test-idempotency-logic" "node tests/test-idempotency-logic.js"
run_test "I-06: validate-wf06-prequalification" "node tests/validate-wf06-prequalification.js"
run_test "I-06: test-prequalification-logic" "node tests/test-prequalification-logic.js"
run_test "I-07: validate-wf07-ai-analysis" "node tests/validate-wf07-ai-analysis.js"
run_test "I-07: test-ai-analysis-logic" "node tests/test-ai-analysis-logic.js"
run_test "I-07: analyze-ai-failure-modes" "node tests/analyze-ai-failure-modes.js"

# I-08 Core Tests
echo "=== I-08 Qualification Decision ==="
run_test "I-08: WF-08 Structure Validation" "node tests/validate-wf08-decision.js"
run_test "I-08: Decision Logic" "node tests/test-decision-logic.js"
run_test "I-08: Decision Gap Analysis" "node tests/analyze-decision-gaps.js"

echo "========================================"
echo " Summary"
echo "========================================"
echo "  Passed: $PASS/12"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ $FAIL test(s) FAILED"
  exit 1
else
  echo "  ✅ All $PASS tests PASSED"
  exit 0
fi