-- ============================================
-- Runtime Role Guidance
-- ============================================
-- Defines the intended database role separation
-- for the AI Lead Qualification Agent.
--
-- FOR DEMO (Supabase managed PostgreSQL):
--   The `postgres` role is used for both migration
--   and runtime operations. Full role separation
--   requires CREATE ROLE privileges not available
--   in managed Supabase.
--
-- FOR PRODUCTION (self-managed PostgreSQL):
--   Apply this script to create separate roles with
--   least-privilege access patterns.
-- ============================================

-- ============================================
-- Role definitions (production reference)
-- ============================================

-- Migration role: owns schema, applies DDL changes
-- DO $$ BEGIN
--     CREATE ROLE app_migration WITH LOGIN PASSWORD 'change-me';
-- EXCEPTION WHEN duplicate_object THEN NULL;
-- END $$;

-- Runtime role: CRUD operations, no DDL
-- DO $$ BEGIN
--     CREATE ROLE app_runtime WITH LOGIN PASSWORD 'change-me';
-- EXCEPTION WHEN duplicate_object THEN NULL;
-- END $$;

-- Read-only role: for dashboards, evidence extraction
-- DO $$ BEGIN
--     CREATE ROLE app_readonly WITH LOGIN PASSWORD 'change-me';
-- EXCEPTION WHEN duplicate_object THEN NULL;
-- END $$;

-- ============================================
-- Privilege grants (production reference)
-- ============================================

-- Migration role owns all tables and sequences
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_migration;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_migration;

-- Runtime role: SELECT, INSERT, UPDATE on all tables
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_runtime;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- Read-only role: SELECT only
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;

-- Future grants for new objects
-- ALTER DEFAULT PRIVILEGES FOR ROLE app_migration IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE ON TABLES TO app_runtime;
-- ALTER DEFAULT PRIVILEGES FOR ROLE app_migration IN SCHEMA public
--     GRANT SELECT ON TABLES TO app_readonly;

-- ============================================
-- DEMO configuration (Supabase managed)
-- ============================================
-- Using `postgres` role for all operations.
-- The n8n PostgreSQL node connects as `postgres`
-- via the Supabase connection pooler.
--
-- Environment variables:
--   PG_APP_USER=postgres  (runtime)
--   PG_N8N_USER=postgres  (n8n internal)
--
-- In production, replace with app_runtime and
-- use a separate migration user for schema changes.

-- ============================================
-- Verification queries
-- ============================================

-- Check current role
-- SELECT current_user, session_user;

-- List all roles (requires superuser)
-- SELECT rolname, rolsuper, rolcreatedb, rolcanlogin
-- FROM pg_roles
-- WHERE rolname LIKE 'app_%';

-- List table privileges
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
-- ORDER BY grantee, table_name;