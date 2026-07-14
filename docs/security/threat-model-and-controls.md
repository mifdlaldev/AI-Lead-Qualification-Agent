# Threat Model & Security Controls

## Trust boundaries
Untrusted:
- public webhook/form input;
- project description/free text;
- URLs supplied by prospects;
- AI model output;
- external API responses until validated.

Trusted only after authentication/validation:
- operator/reviewer actions;
- configuration;
- internal workflow calls;
- database operations.

Secrets are never treated as ordinary workflow data.

## Primary threats
### T1 Prompt injection / instruction smuggling
A prospect embeds instructions intended to override the system or exfiltrate secrets.

Controls:
- free text is data, not instructions;
- AI component has no direct privileged side-effect credentials;
- system policy is deterministic outside the model;
- structured output validation;
- risk flag/review path;
- minimum necessary context supplied to model.

### T2 Credential leakage
Secrets appear in exports, prompts, errors, screenshots, Git history, or public portfolio artifacts.

Controls:
- n8n credential store/environment/external secret mechanism appropriate to deployment;
- `.env`/secret files excluded from Git;
- redaction before logs/alerts;
- synthetic data for public evidence;
- secret rotation procedure after suspected exposure.

### T3 Unauthorized ingress
Attackers submit arbitrary traffic or abuse the webhook.

Controls:
- authenticate source where possible (signed request/API key/OAuth depending source);
- TLS at public edge;
- request/body size limits;
- rate limiting at reverse proxy/API gateway when public;
- reject unsupported methods/content types;
- replay/idempotency protection.

### T4 Broken access control in human review
Unauthorized person resolves leads.

Controls:
- authenticated reviewer identity;
- least privilege;
- authorization check before resolution;
- immutable audit record of resolution.

### T5 SSRF / unsafe URL fetching
Prospect-provided URL causes internal-network access.

Controls:
- do not fetch arbitrary prospect URLs in MVP unless required;
- if later enabled, validate scheme/host and apply network egress restrictions/SSRF protections supported by deployment.

### T6 Injection into downstream systems
Untrusted content breaks SQL, templates, HTML, or messages.

Controls:
- parameterized database operations;
- escaping/encoding appropriate to sink;
- no dynamic SQL from lead text;
- sanitize public rendering.

### T7 Excessive data exposure
Too much PII is sent to AI/logs/notifications.

Controls:
- data minimization;
- send only fields required for semantic task;
- avoid full raw payload in alerts;
- define retention before real data use.

### T8 Dependency compromise or malicious node/package
Controls:
- prefer official/built-in nodes for MVP;
- minimize community nodes;
- pin/document versions where deployment allows;
- review any custom/community node before installation;
- restrict execution environment and credentials.

## AI security invariant
The model is a **semantic evidence producer**, not a security principal or authorization engine.

## Public repository hygiene
Must never commit:
- production workflow exports containing credential references that expose sensitive configuration;
- API keys/tokens;
- real lead PII;
- database dumps;
- raw sensitive execution logs.

## Security verification before public release
- secret scan repository/history;
- inspect screenshots and demo video for tokens/PII;
- run adversarial synthetic cases;
- verify no-consent path;
- verify reviewer authorization design;
- verify duplicate replay behavior;
- verify malformed AI output fails safely.

## Evidence basis
Recent 2026 research on agentic workflow hijacking demonstrated that attacker-controlled contextual inputs can manipulate LLM-enabled automation. This project therefore treats external text and model output as untrusted across explicit trust boundaries. This evidence motivates the controls; it does not imply the finished implementation is automatically secure without verification.
