# Configuration & Secrets Contract

## Non-secret configuration
- `APP_ENV=dev|demo|production`
- `APP_BASE_URL`
- `WORKFLOW_RELEASE`
- `INBOUND_SCHEMA_VERSION=1`
- `SEMANTIC_SCHEMA_VERSION=1`
- `POLICY_VERSION=1`
- `PROMPT_VERSION=1`
- `OPENAI_MODEL`
- `TELEGRAM_CHAT_ID`
- `EMAIL_FROM`
- `REVIEW_TOKEN_TTL_SECONDS`
- retry/backoff parameters per adapter
- execution/data retention settings

## Secrets
- `N8N_ENCRYPTION_KEY`
- PostgreSQL runtime credential/URL
- migration/admin DB credential if separate
- OpenAI API key
- Telegram bot token
- Resend API key
- ingress authentication secret if API ingress is protected by shared secret/signature
- review-token signing/hash secret if implementation uses keyed hashing

## Rules
1. Commit `.env.example` with names and safe placeholders only.
2. Never commit `.env` or generated credential exports.
3. Separate demo and future production credentials.
4. Rotate any secret accidentally exposed in logs, screenshots, Git history, or chat.
5. n8n credential objects should reference secrets/configuration appropriate to the deployment; workflow JSON committed to Git must be inspected before publication.
6. Configuration changes that alter behavior must be versioned or recorded; secret rotation alone does not change business policy version.

## Startup/preflight checks
Before activating public/demo workflows verify:
- required config present;
- DB connectivity and expected migration version;
- selected OpenAI model/API contract available;
- Telegram destination allow-listed;
- email sender configuration valid before enabling prospect delivery;
- error workflow configured;
- environment is not accidentally pointing synthetic tests at production destinations.

Fail closed on missing critical configuration.
