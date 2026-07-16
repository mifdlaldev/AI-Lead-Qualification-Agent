#!/bin/bash
# I-10: Routing & Notifications (WF-10 + WF-11 + WF-12) Test Suite
# Runs: I-04 through I-09 regression + I-10 tests
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
echo " I-10: Routing & Notifications"
echo " (WF-10 + WF-11 + WF-12)"
echo "========================================"
echo ""

# I-04 → I-09 Regression
echo "=== Regression (I-04→I-09) ==="
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
run_test "I-09: WF-09/WF-13 Structure Validation" "node tests/validate-wf09-review.js"
run_test "I-09: Review Logic" "node tests/test-review-logic.js"
run_test "I-09: Review Gap Analysis" "node tests/analyze-review-gaps.js"

# I-10 Core Tests
echo "=== I-10 Routing & Notifications ==="
run_test "I-10: WF-10/11/12 Structure Validation" "node tests/validate-wf10-routing.js"
run_test "I-10: Routing & Notification Logic" "node tests/test-routing-logic.js"
run_test "I-10: Routing & Notification Gap Analysis" "node tests/analyze-routing-gaps.js"

echo "========================================"
echo " RESULTS"
echo "  Pass: $PASS / $((PASS + FAIL))"
echo "  Fail: $FAIL / $((PASS + FAIL))"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0