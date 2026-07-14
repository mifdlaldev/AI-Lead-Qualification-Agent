# Workflow Inventory & Responsibilities

Workflow IDs are stable implementation identifiers.

## WF-01 — `lead-ingress-api`
Trigger: Webhook.  
Purpose: machine/API test ingress.

Steps: validate transport/auth → limit accepted method/content type → map source payload → generate correlation ID if absent → call WF-03 → return receipt/result contract.

No AI, email, Telegram, or business decision logic.

## WF-02 — `lead-ingress-demo-form`
Trigger: n8n Form Trigger.  
Purpose: human-friendly portfolio demo.

Maps form fields to the exact same canonical inbound contract, then calls WF-03. No separate qualification logic.

## WF-03 — `lead-orchestrator`
Trigger: Execute Sub-workflow Trigger.  
Purpose: coordinate one lead processing run.

Sequence:
1. durable receipt/run creation;
2. WF-04 validation;
3. invalid terminal/reviewable handling;
4. WF-05 idempotency/duplicate claim;
5. WF-06 deterministic prequalification;
6. call WF-07 only if semantic analysis required;
7. WF-08 decision policy;
8. create review item or call WF-10 routing;
9. persist final technical status.

## WF-04 — `validate-normalize-lead`
Pure/deterministic sub-workflow.  
Input: inbound schema v1.  
Output: normalized lead + `VALID | INVALID_REVIEWABLE | INVALID_TERMINAL` + reason codes.

## WF-05 — `claim-lead-idempotency`
Database-backed sub-workflow.  
Atomically resolves source identity/fingerprint policy and returns `NEW | DUPLICATE | REPLAY_CONFLICT` plus canonical lead reference.

## WF-06 — `deterministic-prequalification`
Evaluates consent flags, explicit excluded-service rules, required evidence, and whether AI analysis is needed. Business policy values come from versioned configuration/tables, not prompt prose.

## WF-07 — `ai-semantic-analysis`
Calls OpenAI Responses API using strict Structured Outputs.  
Input: minimum normalized semantic fields + schema/prompt version.  
Output: validated semantic-analysis contract or typed failure.

No side-effect credentials/actions.

## WF-08 — `qualification-decision`
Pure/deterministic policy mapping.  
Output: disposition, reason codes, evidence references, policy version, `requires_human_review`.

## WF-09 — `human-review`
Two entry paths:
- create review item + issue one-time opaque review token;
- authenticated/authorized demo resolution endpoint/form consumes token and records human decision.

For a real client, replace demo review authentication with the client's identity/access mechanism.

## WF-10 — `route-final-disposition`
Creates/claims required side-effect ledger entries and invokes adapters based on disposition:
- qualified internal alert;
- nurture/follow-up email when allowed;
- disqualified response when configured and allowed;
- no final disposition actions before review resolution.

## WF-11 — `send-telegram-alert`
Adapter. Input contains sanitized internal notification contract. Output is typed success/failure with provider reference if available.

## WF-12 — `send-prospect-email`
Adapter using Resend API. Requires consent authorization from caller plus stable action key. Adapter does not decide whether email is permitted.

## WF-13 — `resolve-human-review`
Validates one-time review token/status, prevents double resolution, records reviewer action, then calls WF-10 with final human disposition.

## WF-14 — `global-error-handler`
Trigger: Error Trigger. Records sanitized unexpected failure metadata and sends an operator alert when actionable.

## WF-15 — `synthetic-evaluation-runner`
Trigger: Manual or controlled test trigger. Loads frozen fixtures, invokes WF-03, captures expected vs observed outcomes, and writes evidence records. Must use demo destinations/credentials.

## Dependency rule
Sub-workflows communicate through documented JSON contracts. A child workflow must not reach backward into arbitrary parent-node data.

## Naming convention
Nodes: `<stage-number> | <verb> <object>`  
Examples: `10 | Validate Contract`, `40 | Call Semantic Analysis`, `70 | Persist Decision`.

Workflow names and IDs remain stable; display labels may evolve only with documentation updates.
