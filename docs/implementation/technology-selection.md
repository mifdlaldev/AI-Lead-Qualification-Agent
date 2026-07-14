# Technology Selection — Phase 4

**Decision date:** 2026-07-14

## Selection principles
Optimize for: implementation speed, demonstrability to freelance buyers, explicit reliability controls, low operational complexity, replaceable adapters, and evidence generation. Do not add infrastructure merely to appear enterprise-grade.

## Selected baseline
| Concern | Selection | Decision |
|---|---|---|
| Orchestration | n8n self-hosted | **2.30.4**, pinned for implementation baseline |
| Runtime packaging | Docker Compose | single n8n instance for MVP/demo |
| Canonical application DB | PostgreSQL | managed PostgreSQL via Supabase project for demo |
| n8n internal DB | PostgreSQL | separate database/schema boundary from application tables where practical |
| AI API (development/demo) | Omni OpenAI-compatible endpoint | `https://omni.thefreelancer.web.id/v1`; use OpenAI-compatible transport in dev/demo |
| AI API (production/client) | Provider-agnostic approved provider | OpenAI / Anthropic / other client-approved provider selected per engagement |
| Internal alert | Telegram Bot API | one private operator chat for demo |
| Prospect email | Resend API | transactional follow-up adapter |
| Human review | n8n-hosted review form + opaque one-time review token | synthetic/demo environment only |
| Public ingress | n8n Webhook for API tests + n8n Form Trigger for human demo | both feed one canonical ingress contract |
| Reverse proxy/TLS | deployment-specific HTTPS edge | exact host chosen at deployment, not business logic |
| Source control | GitHub repository | sanitized exports, SQL migrations, schemas, fixtures, docs |

## Verified version fact
The implementation baseline pins **n8n 2.30.4**, released 2026-07-13. Do not silently upgrade during the benchmark. Upgrades require regression testing and a release decision.

## AI provider policy
The semantic-analysis contract is **provider-agnostic**. The transport contract is OpenAI-compatible, and Omni is the development/demo baseline because it is budget-friendly and exposes OpenAI-like endpoints.

Do **not** hard-code a provider identity in workflow logic. Use configuration for environment selection:
- `AI_PROVIDER=omni` for development/demo
- `AI_PROVIDER=<approved-client-provider>` for client/prod deployments

Persist the actual provider and model identifier used for each analysis record.

At implementation start, perform an API availability preflight and select the lowest-cost currently available model on the configured provider that:
1. supports the required Structured Outputs contract;
2. passes the frozen semantic evaluation set;
3. meets acceptable latency/cost observed in testing.

This is intentionally a benchmark-driven model choice, not indecision. Model catalogs change faster than the product contract. The provider/API and output mechanism are fixed; the deploy-time model is a versioned configuration item.

## Why Omni for development/demo
Selected for the personal development/demo environment because it reduces cost pressure while preserving an OpenAI-compatible API surface for the implementation contract. This keeps the workflow and schema design aligned with the eventual production provider abstraction.

## Why Supabase-managed PostgreSQL
Selected for the demo because the project requires real PostgreSQL semantics—constraints, transactions, queryability, migrations—without adding database server administration to the July critical path. Supabase is used as managed PostgreSQL, not as a substitute for the domain model.

## Why Telegram for internal alerts
The demo needs one fast, visible internal notification path. Telegram has a simple bot API and creates clear demonstration evidence. It is an adapter, not a product invariant.

## Why Resend for follow-up
The demo needs one controlled transactional email path with an API-oriented integration surface. Email delivery remains behind the side-effect ledger and consent policy.

## Why no CRM in MVP
The canonical PostgreSQL record already proves state synchronization and auditability. Adding HubSpot/Pipedrive solely for logo value adds credentials, setup, and failure modes without improving the core proof. A CRM adapter can be added after the core benchmark or for a specific client proposal.

## Why no Redis/queue mode
No measured concurrency requirement currently justifies it. Single-instance orchestration is sufficient for the portfolio benchmark; contracts preserve a future migration path.

## Why no community nodes
Use built-in n8n nodes and generic HTTP Request/Postgres nodes for the MVP unless an official built-in integration is clearly safer. This reduces supply-chain and portability risk.
