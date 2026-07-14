# Concrete Integration Specification

## PostgreSQL / Supabase
Use direct PostgreSQL connectivity from n8n for transactional domain operations. Do not expose privileged database credentials to browser/form clients.

Connection requirements:
- TLS as required by provider;
- dedicated database role for workflow application operations;
- least privileges after migrations are applied;
- separate migration/admin credential from runtime credential where feasible;
- connection method selected according to provider guidance and deployment network characteristics.

All SQL values must be parameterized. Race-sensitive claims use database constraints/transactions, not workflow-only checks.

## OpenAI Responses API
Purpose: semantic extraction/classification only.

Request contract:
- versioned system/developer instruction;
- prospect text clearly delimited as untrusted data;
- strict JSON schema/Structured Outputs;
- no tools enabled;
- no web search;
- no external action capability;
- minimum necessary fields only.

Persist:
- configured/requested model ID;
- observed response model metadata when available;
- prompt version;
- analysis schema version;
- request/response timestamps;
- token/usage metadata when returned;
- validated structured business result.

Do not persist hidden reasoning/chain-of-thought.

Failure mapping:
- timeout/network/5xx/rate-limit → transient classification according to actual status/provider guidance;
- authentication/invalid request → permanent/configuration failure;
- schema/refusal/no valid semantic result → AI contract outcome, bounded recovery, then review/failure.

## Telegram Bot API
Purpose: internal demo/operator notification only.

Configuration:
- bot token in credential/secret store;
- allow-listed private `chat_id` in environment/config;
- message contains lead ID/correlation ID, disposition, safe summary, reason codes, and review link only when applicable;
- no API keys or unnecessary full raw lead payload.

Telegram delivery success does not change the business disposition; it changes the corresponding side-effect status.

## Resend API
Purpose: controlled prospect transactional email.

Preconditions before adapter call:
- `consent_to_contact = true`;
- disposition/action policy permits the template;
- stable action key claimed;
- recipient email validated.

Configuration:
- API key in secret store;
- verified sender/domain as required by provider;
- template/version identifier stored with action metadata;
- stable idempotency strategy: use provider-native idempotency capability if available at implementation time; always retain local action-key ledger regardless.

No AI-generated free-form email is sent directly in MVP. Use deterministic, versioned templates populated only with approved fields. This removes a large avoidable safety and quality variable.

## Human review form
Demo implementation:
- review item created in PostgreSQL;
- cryptographically random opaque token generated;
- store only token hash where practical;
- token is single-use and expires;
- review page/form receives only the minimum review context;
- resolution performs atomic `OPEN → RESOLVED` transition;
- second use fails safely.

This mechanism is sufficient for a synthetic portfolio demo, not a claim of enterprise IAM. Real-client deployment must integrate the client's authentication/authorization requirements.

## Public demo form
Use n8n Form Trigger only as a demonstration surface. It maps into the same schema as API ingress. The form is not the canonical data store and must not contain hidden business logic.
