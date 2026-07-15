#!/usr/bin/env bash
# ============================================
# Migration Verification
# ============================================
# Verifies that the initial domain schema migration
# has been applied correctly to the target database.
#
# Usage:
#   ./database/verify-migration.sh
#
# Requires: psql, .env file with PG_APP_* variables
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Build connection string
PG_HOST="${PG_APP_HOST:-db.xxxxx.supabase.co}"
PG_PORT="${PG_APP_PORT:-5432}"
PG_DATABASE="${PG_APP_DATABASE:-postgres}"
PG_USER="${PG_APP_USER:-postgres}"
PG_PASSWORD="${PG_APP_PASSWORD:-change-me}"
PG_SSL_MODE="${PG_APP_SSL_MODE:-require}"

CONN="postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}?sslmode=${PG_SSL_MODE}"

PASS=0
FAIL=0

check() {
    local label="$1"
    local query="$2"
    local expected="$3"
    
    result=$(psql "$CONN" -t -A -c "$query" 2>/dev/null || echo "ERROR")
    if [ "$result" = "$expected" ]; then
        echo "  PASS: $label"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $label (expected: $expected, got: $result)"
        FAIL=$((FAIL + 1))
    fi
}

echo "============================================"
echo " Migration Verification — I-01 Database"
echo " Target: ${PG_HOST}:${PG_PORT}/${PG_DATABASE}"
echo "============================================"

# --- Schema Version ---
echo ""
echo "[1] Schema Version"
check "schema_version table exists" \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_version';" \
    "1"

check "migration 0001 recorded" \
    "SELECT version FROM schema_version WHERE version=1;" \
    "1"

# --- Expected Tables (9 total) ---
echo ""
echo "[2] Expected Tables"

TABLES=(
    "schema_version"
    "leads"
    "processing_runs"
    "semantic_analyses"
    "decisions"
    "review_items"
    "side_effects"
    "processing_events"
    "policy_config"
)

for table in "${TABLES[@]}"; do
    check "table $table exists" \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" \
        "1"
done

# --- Race-Sensitive Uniqueness Constraints ---
echo ""
echo "[3] Race-Sensitive Unique Constraints"

check "unique source identity (leads)" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='leads' AND indexname='idx_leads_source_identity';" \
    "1"

check "unique correlation_id (processing_runs)" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='processing_runs' AND indexname='processing_runs_correlation_id_key';" \
    "1"

check "unique action_key (side_effects)" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='side_effects' AND indexname='side_effects_action_key_key';" \
    "1"

check "unique review_token_hash (review_items)" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='review_items' AND indexname='idx_review_items_token_hash';" \
    "1"

# --- Indexes ---
echo ""
echo "[4] Performance Indexes"

check "leads fingerprint index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='leads' AND indexname='idx_leads_fingerprint';" \
    "1"

check "leads processing_state index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='leads' AND indexname='idx_leads_processing_state';" \
    "1"

check "processing_runs lead_id index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='processing_runs' AND indexname='idx_processing_runs_lead';" \
    "1"

check "semantic_analyses run index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='semantic_analyses' AND indexname='idx_semantic_analyses_run';" \
    "1"

check "decisions lead index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='decisions' AND indexname='idx_decisions_lead';" \
    "1"

check "review_items lead index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='review_items' AND indexname='idx_review_items_lead';" \
    "1"

check "review_items status index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='review_items' AND indexname='idx_review_items_status';" \
    "1"

check "side_effects lead index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='side_effects' AND indexname='idx_side_effects_lead';" \
    "1"

check "processing_events correlation index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='processing_events' AND indexname='idx_processing_events_correlation';" \
    "1"

check "processing_events lead index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='processing_events' AND indexname='idx_processing_events_lead';" \
    "1"

check "processing_events created index" \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='processing_events' AND indexname='idx_processing_events_created';" \
    "1"

# --- Foreign Key Constraints ---
echo ""
echo "[5] Foreign Key Constraints"

check "processing_runs → leads FK" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_name='processing_runs' AND constraint_name LIKE '%lead_id%';" \
    "1"

check "semantic_analyses → processing_runs FK" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_name='semantic_analyses';" \
    "1"

check "decisions → leads FK" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_name='decisions' AND constraint_name LIKE '%lead_id%';" \
    "1"

check "review_items → leads FK" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_name='review_items' AND constraint_name LIKE '%lead_id%';" \
    "1"

check "side_effects → leads FK" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_name='side_effects' AND constraint_name LIKE '%lead_id%';" \
    "1"

# --- Summary ---
echo ""
echo "============================================"
echo " Results: $PASS passed, $FAIL failed"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
    echo "MIGRATION VERIFICATION FAILED"
    exit 1
else
    echo "MIGRATION VERIFICATION PASSED"
    exit 0
fi