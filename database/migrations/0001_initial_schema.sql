-- ============================================
-- Migration 0001: Initial Domain Schema
-- ============================================
-- Creates canonical domain tables for the
-- AI Lead Qualification Agent.
-- PostgreSQL is the system-of-record.
-- ============================================

BEGIN;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

-- ============================================
-- Core entities
-- ============================================

-- Canonical lead record
CREATE TABLE leads (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system           TEXT NOT NULL,
    source_submission_id    TEXT,
    -- Contact fields
    full_name               TEXT NOT NULL,
    email                   TEXT NOT NULL,
    company_name            TEXT,
    company_website         TEXT,
    job_title               TEXT,
    phone                   TEXT,
    country                 TEXT,
    -- Business fields
    project_description     TEXT NOT NULL,
    budget_range            TEXT,
    desired_timeline        TEXT,
    service_interest        TEXT,
    lead_source             TEXT,
    -- Consent
    consent_to_contact      BOOLEAN NOT NULL DEFAULT FALSE,
    -- Deduplication
    payload_fingerprint     TEXT NOT NULL,
    -- State
    current_processing_state TEXT NOT NULL DEFAULT 'RECEIVED',
    current_disposition     TEXT NOT NULL DEFAULT 'NONE',
    policy_version          INTEGER,
    -- Metadata
    schema_version          INTEGER NOT NULL DEFAULT 1,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- UTM attribution
    utm_source              TEXT,
    utm_medium              TEXT,
    utm_campaign            TEXT,
    utm_term                TEXT,
    utm_content             TEXT
);

-- Unique constraint: prevent duplicate source submissions
CREATE UNIQUE INDEX idx_leads_source_identity
    ON leads (source_system, source_submission_id)
    WHERE source_submission_id IS NOT NULL;

-- Fingerprint lookup for dedup
CREATE INDEX idx_leads_fingerprint ON leads (payload_fingerprint);

-- Processing state lookup
CREATE INDEX idx_leads_processing_state ON leads (current_processing_state);

-- ============================================
-- Processing runs
-- ============================================
CREATE TABLE processing_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES leads(id),
    correlation_id      TEXT NOT NULL UNIQUE,
    attempt_number      INTEGER NOT NULL DEFAULT 1,
    workflow_version    TEXT,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    final_status        TEXT, -- COMPLETED, FAILED, RETRY_PENDING
    failure_classification TEXT
);

CREATE INDEX idx_processing_runs_lead ON processing_runs (lead_id);
CREATE INDEX idx_processing_runs_correlation ON processing_runs (correlation_id);

-- ============================================
-- Semantic analyses
-- ============================================
CREATE TABLE semantic_analyses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_run_id       UUID NOT NULL REFERENCES processing_runs(id),
    analysis_schema_version INTEGER NOT NULL,
    model_provider          TEXT,
    model_identifier        TEXT,
    validated_result        JSONB,
    validation_status       TEXT NOT NULL, -- VALID, MALFORMED, FAILED
    prompt_version          INTEGER,
    usage_metadata          JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_semantic_analyses_run ON semantic_analyses (processing_run_id);

-- ============================================
-- Decisions
-- ============================================
CREATE TABLE decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES leads(id),
    processing_run_id   UUID NOT NULL REFERENCES processing_runs(id),
    policy_version      INTEGER NOT NULL,
    automated_disposition TEXT NOT NULL,
    reason_codes        JSONB NOT NULL DEFAULT '[]',
    evidence_references JSONB,
    requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_lead ON decisions (lead_id);

-- ============================================
-- Human review items
-- ============================================
CREATE TABLE review_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id                 UUID NOT NULL REFERENCES leads(id),
    decision_id             UUID REFERENCES decisions(id),
    automated_recommendation TEXT,
    review_reason_codes     JSONB NOT NULL DEFAULT '[]',
    status                  TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED, CANCELLED
    review_token_hash       TEXT, -- hashed opaque token
    review_token_expires_at TIMESTAMPTZ,
    reviewer_identifier     TEXT,
    final_disposition       TEXT,
    resolution_note         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);

CREATE INDEX idx_review_items_lead ON review_items (lead_id);
CREATE INDEX idx_review_items_status ON review_items (status);
CREATE UNIQUE INDEX idx_review_items_token_hash
    ON review_items (review_token_hash)
    WHERE review_token_hash IS NOT NULL;

-- ============================================
-- Side effects (action ledger)
-- ============================================
CREATE TABLE side_effects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES leads(id),
    processing_run_id   UUID NOT NULL REFERENCES processing_runs(id),
    action_key          TEXT NOT NULL UNIQUE,
    action_type         TEXT NOT NULL,   -- TELEGRAM_ALERT, PROSPECT_EMAIL, etc.
    destination_class   TEXT NOT NULL,   -- INTERNAL, PROSPECT, SYSTEM
    status              TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, SUCCEEDED, RETRY_PENDING, FAILED, SKIPPED
    provider_reference  TEXT,
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    error_classification TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_side_effects_lead ON side_effects (lead_id);
CREATE INDEX idx_side_effects_action_key ON side_effects (action_key);

-- ============================================
-- Processing events (append-only audit)
-- ============================================
CREATE TABLE processing_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id  TEXT NOT NULL,
    lead_id         UUID REFERENCES leads(id),
    previous_state  TEXT,
    new_state       TEXT,
    event_type      TEXT NOT NULL,
    actor_type      TEXT NOT NULL,  -- SYSTEM, AI_COMPONENT, HUMAN
    reason_code     TEXT,
    safe_metadata   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_events_correlation ON processing_events (correlation_id);
CREATE INDEX idx_processing_events_lead ON processing_events (lead_id);
CREATE INDEX idx_processing_events_created ON processing_events (created_at);

-- ============================================
-- Policy configuration
-- ============================================
CREATE TABLE policy_config (
    id              SERIAL PRIMARY KEY,
    policy_version  INTEGER NOT NULL,
    policy_key      TEXT NOT NULL,
    policy_value    JSONB NOT NULL,
    description     TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (policy_version, policy_key)
);

-- Record migration
INSERT INTO schema_version (version, description)
VALUES (1, 'Initial domain schema: leads, processing_runs, semantic_analyses, decisions, review_items, side_effects, processing_events, policy_config');

COMMIT;