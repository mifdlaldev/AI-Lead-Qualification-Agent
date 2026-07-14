# Implementation Repository Structure

```text
AI-Lead-Qualification-Agent/
├── README.md
├── AGENTS.md
├── .gitignore
├── .env.example
├── compose.yaml
├── docs/
│   ├── research/
│   ├── product/
│   ├── business/
│   ├── architecture/
│   ├── security/
│   ├── implementation/
│   ├── testing/
│   └── decisions/
├── workflows/
│   ├── WF-01-lead-ingress-api.json
│   ├── WF-02-lead-ingress-demo-form.json
│   ├── WF-03-lead-orchestrator.json
│   ├── WF-04-validate-normalize-lead.json
│   ├── WF-05-claim-lead-idempotency.json
│   ├── WF-06-deterministic-prequalification.json
│   ├── WF-07-ai-semantic-analysis.json
│   ├── WF-08-qualification-decision.json
│   ├── WF-09-human-review.json
│   ├── WF-10-route-final-disposition.json
│   ├── WF-11-send-telegram-alert.json
│   ├── WF-12-send-prospect-email.json
│   ├── WF-13-resolve-human-review.json
│   ├── WF-14-global-error-handler.json
│   └── WF-15-synthetic-evaluation-runner.json
├── database/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   ├── seeds/
│   │   └── demo_policy.sql
│   └── queries/
│       └── README.md
├── schemas/
│   ├── inbound-lead-v1.schema.json
│   ├── semantic-analysis-v1.schema.json
│   ├── workflow-contracts/
│   └── reason-codes.json
├── policies/
│   └── qualification-policy-v1.json
├── prompts/
│   └── semantic-analysis-v1.md
├── fixtures/
│   ├── synthetic-leads/
│   ├── adversarial/
│   └── expected-outcomes.json
├── evidence/
│   ├── README.md
│   └── .gitkeep
└── scripts/
    ├── validate-artifacts.*
    ├── export-workflows.*
    └── run-evaluation.*
```

## Rules
- `workflows/`: sanitized, version-controlled n8n exports; no credential secrets.
- `database/migrations/`: only source of schema evolution.
- `schemas/`: machine-readable contracts shared by implementation and tests.
- `policies/`: versioned deterministic policy configuration.
- `prompts/`: versioned semantic instructions; business hard rules do not live only here.
- `fixtures/`: synthetic inputs and expected outcomes.
- `evidence/`: generated sanitized benchmark outputs; raw sensitive execution data excluded.
- `AGENTS.md`: implementation instructions for opencode, including read-order and prohibition against silently changing accepted requirements.

## Source-of-truth precedence
When artifacts conflict:
1. accepted decision records;
2. product/business requirements and acceptance criteria;
3. architecture/implementation specifications;
4. machine-readable schemas/policies;
5. workflow implementation.

A workflow export is not allowed to silently redefine higher-level accepted behavior.
