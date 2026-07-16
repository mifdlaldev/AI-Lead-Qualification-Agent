#!/bin/bash
# I-12: Synthetic Evaluation & Fixtures — Test Runner
# Runs all I-12 tests and I-04 through I-11 regression

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/.."

echo "=========================================="
echo "  I-12: Synthetic Evaluation & Fixtures"
echo "=========================================="
echo ""

# ── I-12 Tests ──────────────────────────────────────
echo "--- I-12: Structure & Contract Validation ---"
node tests/validate-synthetic-eval.js
echo ""

echo "--- I-12: Fixture Coverage Analysis ---"
node tests/test-fixture-coverage.js
echo ""

echo "--- I-12: Evidence Gaps Analysis ---"
node tests/analyze-evidence-gaps.js
echo ""

# ── Regression: I-04 through I-11 ────────────────────
echo "=========================================="
echo "  Regression: I-04 through I-11"
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

echo "=========================================="
echo "  I-12 Complete"
echo "=========================================="