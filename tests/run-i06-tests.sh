#!/bin/bash
# I-06: Deterministic Prequalification Test Suite
# Runs: I-04 baseline + I-05 idempotency + I-06 prequalification
set -e

PASS=0
FAIL=0
TOTAL=0

echo "========================================"
echo " I-06: Deterministic Prequalification"
echo "========================================"
echo ""

run_test() {
  local label="$1"
  local cmd="$2"
  echo "--- $label ---"
  if eval "$cmd"; then
    echo "  ✅ $label: PASS"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label: FAIL"
    FAIL=$((FAIL + 1))
  fi
  TOTAL=$((TOTAL + 1))
  echo ""
}

# I-04 Baseline (regression check — must still pass)
echo "=== I-04 Baseline (Regression) ==="
for test in tests/validate-contract.js tests/test-contract-logic.js tests/test-state-machine.js tests/test-sql-logic.js tests/analyze-edge-cases.js tests/validate-wf04-parsing.js tests/test-wf04-parsing.js; do
  if [ -f "$test" ]; then
    run_test "I-04: $(basename $test)" "node $test"
  fi
done

# I-05 Idempotency (regression check)
echo "=== I-05 Idempotency (Regression) ==="
for test in tests/validate-wf05-idempotency.js tests/test-idempotency-logic.js tests/analyze-race-conditions.js; do
  if [ -f "$test" ]; then
    run_test "I-05: $(basename $test)" "node $test"
  fi
done

# I-06 Prequalification
echo "=== I-06 Prequalification ==="
run_test "I-06: WF-06 Structure Validation" "node tests/validate-wf06-prequalification.js"
run_test "I-06: Prequalification Logic" "node tests/test-prequalification-logic.js"
run_test "I-06: Policy Gap Analysis" "node tests/analyze-policy-gaps.js"

# Contract + State + SQL compliance
echo "=== Contract, State, SQL Compliance ==="
run_test "I-06: Contract Compliance" "node tests/contract-compliance-check.js 2>&1 | grep -q '\[WF-06\] PASS'"
run_test "I-06: State Machine Validation" "node tests/validate-state-machine.js 2>&1 | grep -q 'PREQUALIFYING.*ANALYZING.*PASS'"
run_test "I-06: SQL Query Validation" "node tests/validate-sql-queries.js 2>&1 | grep -q 'WF-06.*PASS'"

echo "========================================"
echo " Summary"
echo "========================================"
echo "  Passed: $PASS/$TOTAL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ $FAIL test(s) FAILED"
  exit 1
else
  echo "  ✅ All $PASS tests PASSED"
  exit 0
fi