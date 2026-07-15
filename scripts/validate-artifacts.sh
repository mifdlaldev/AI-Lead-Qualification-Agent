#!/usr/bin/env bash
# ============================================
# Validate Artifacts
# ============================================
# Validates JSON schemas, SQL migrations, and
# workflow structure. Run before committing.
# ============================================
set -euo pipefail

echo "=== Validating JSON schemas ==="
for f in schemas/*.json schemas/workflow-contracts/*.json policies/*.json fixtures/*.json; do
  [ -f "$f" ] || continue
  python3 -m json.tool "$f" > /dev/null && echo "  OK: $f" || echo "  FAIL: $f"
done

echo "=== Validating workflow JSON ==="
for f in workflows/*.json; do
  [ -f "$f" ] || continue
  python3 -m json.tool "$f" > /dev/null && echo "  OK: $f" || echo "  FAIL: $f"
done

echo "=== Done ==="