# Deployment & Environments

## Environment model
Minimum logical environments:
- **local/dev:** workflow construction and fixture testing;
- **test/demo:** reproducible portfolio demonstration with synthetic data;
- **production:** only if/when real client or real personal data is processed.

For the July portfolio objective, dev + isolated demo are required. A production environment is not required to claim a working demo and must not be simulated through misleading language.

## Recommended deployment baseline
- containerized n8n deployment;
- PostgreSQL-backed durable state;
- TLS-terminated public ingress;
- reverse proxy/API gateway controls for public webhook exposure;
- persistent storage/backup strategy appropriate to selected hosting;
- separate credentials per environment.

## n8n execution topology
Start with a simple single-instance deployment for the portfolio MVP unless measured workload requires queue-mode scaling. Do not add Redis/workers merely to appear enterprise-grade.

Queue mode becomes justified when concurrency, isolation, or scaling requirements are demonstrated. Architecture contracts are designed so this can evolve without changing business semantics.

## Configuration
Environment-specific values include:
- base URLs;
- database connection;
- credentials/secret references;
- model/provider selection;
- integration destinations;
- retry parameters;
- retention settings;
- feature flags/policy activation.

Configuration must not be hard-coded throughout nodes.

## Version control and release
Repository source of truth should include sanitized/versionable artifacts:
- workflow exports safe for Git;
- schemas;
- policy/config templates without secrets;
- synthetic fixtures;
- documentation;
- release notes/change log when implementation starts.

A release must identify:
- workflow version;
- policy version;
- schema versions;
- prompt/template version;
- required migrations/config changes.

## Change methodology
1. Change requirement/decision first when behavior changes.
2. Update contract/schema if needed.
3. Implement on non-production environment.
4. Run regression + failure/adversarial fixtures.
5. Review evidence.
6. Promote version.
7. Preserve rollback path.

## Database migrations
Schema changes must use explicit, versioned migrations once implementation begins. Never manually mutate production schema as an undocumented fix.

## Backup and recovery
Before real-data use, define and test:
- database backup schedule;
- restore procedure;
- credential recovery/rotation;
- workflow export/version recovery.

No recovery-time or recovery-point objective is claimed until a real deployment requirement exists.

## Rollback
Rollback must consider workflow, policy, prompt/schema, and database compatibility together. A workflow-only rollback is unsafe if the data contract has changed incompatibly.
