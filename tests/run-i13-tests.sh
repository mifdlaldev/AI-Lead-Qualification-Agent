#!/bin/bash
# I-13: Security & Failure Verification — Test Runner
# Runs all I-13 tests and I-04 through I-12 regression

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/.."

echo "=========================================="
echo "  I-13: Security & Failure Verification"
echo "=========================================="
echo ""

# ── I-13 Tests ──────────────────────────────────────
echo "--- I-13: Security Invariants ---"
node tests/validate-security.js
echo ""

echo "--- I-13: Failure Modes ---"
node tests/test-failure-modes.js
echo ""

echo "--- I-13: Security Gaps ---"
node tests/analyze-security-gaps.js
echo ""

# ── Regression: I-04 through I-12 ────────────────────
echo "=========================================="
echo "  Regression: I-04 through I-12"
echo "=========================================="
echo ""

echo "--- I-04 (Data Contract) ---"
bash tests/run-i04-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-05 (Workflow Contracts) ---"
bash tests/run-i05-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-06 (SQL Schema) ---"
bash tests/run-i06-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-07 (WF-04/05/06/07 Integrity) ---"
bash tests/run-i07-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-08 (WF-08 Decision) ---"
bash tests/run-i08-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-09 (WF-09/13 Review) ---"
bash tests/run-i09-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-10 (WF-10/11/12 Routing) ---"
bash tests/run-i10-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-11 (Human Review E2E) ---"
bash tests/run-i11-tests.sh 2>&1 | tail -5
echo ""

echo "--- I-12 (Synthetic Eval & Fixtures) ---"
bash tests/run-i12-tests.sh 2>&1 | tail -5
echo ""

echo "=========================================="
echo "  I-13 Complete"
echo "=========================================="