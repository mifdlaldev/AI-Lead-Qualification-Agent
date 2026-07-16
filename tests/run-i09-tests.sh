#!/bin/bash
# I-09: Human Review Test Suite
# Runs: I-04 + I-05 + I-06 + I-07 + I-08 regression + I-09 tests
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
echo " I-09: Human Review (WF-09 + WF-13)"
echo "========================================"
echo ""

# I-04 → I-08 Regression
echo "=== Regression (I-04→I-08) ==="
run_test "I-04: validate-workflow-structure" "node tests/validate-workflow-structure.js"
run_test "I-04: contract-compliance" "node tests/contract-compliance-check.js"
run_test "I-05: validate-wf05-idempotency" "node tests/validate-wf05-idempotency.js"
run_test "I-05: test-idempotency-logic" "node tests/test-idempotency-logic.js"
run_test "I-06: validate-wf06-prequalification" "node tests/validate-wf06-prequalification.js"
run_test "I-06: test-prequalification-logic" "node tests/test-prequalification-logic.js"
run_test "I-07: validate-wf07-ai-analysis" "node tests/validate-wf07-ai-analysis.js"
run_test "I-07: test-ai-analysis-logic" "node tests/test-ai-analysis-logic.js"
run_test "I-07: analyze-ai-failure-modes" "node tests/analyze-ai-failure-modes.js"
run_test "I-08: WF-08 Structure Validation" "node tests/validate-wf08-decision.js"
run_test "I-08: Decision Logic" "node tests/test-decision-logic.js"
run_test "I-08: Decision Gap Analysis" "node tests/analyze-decision-gaps.js"

# I-09 Core Tests
echo "=== I-09 Human Review ==="
run_test "I-09: WF-09/WF-13 Structure Validation" "node tests/validate-wf09-review.js"
run_test "I-09: Review Logic" "node tests/test-review-logic.js"
run_test "I-09: Review Gap Analysis" "node tests/analyze-review-gaps.js"

echo "========================================"
echo " RESULTS"
echo "  Pass: $PASS / $((PASS + FAIL))"
echo "  Fail: $FAIL / $((PASS + FAIL))"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0