# AGENTS.md — Implementation Instructions for opencode

This repository is a planning-first, evidence-based source of truth for the **AI Lead Qualification Agent** project.

## Non-negotiable operating rules
1. **Do not invent missing product behavior.** If a requirement, contract, policy, or architecture rule is absent or ambiguous, stop and report it rather than guessing.
2. **Do not ignore documentation.** The files under `docs/` are the authoritative source for product behavior, architecture, security, and implementation constraints.
3. **Do not silently change accepted decisions.** If implementation reveals that a decision is wrong or incomplete, update the relevant decision document first or alongside the code change, with rationale.
4. **Do not treat workflow convenience as product truth.** A node graph that is easier to build is not allowed to override the documented business contract.
5. **Do not fabricate metrics, clients, test results, or screenshots.** Any portfolio claim must be supported by generated evidence.
6. **Do not embed secrets in Git.** No keys, tokens, credentials, private URLs, or sensitive execution exports.
7. **Do not let AI output directly authorize privileged side effects.** AI is a bounded semantic evidence producer only.
8. **Do not alter the canonical data model without explicit documentation updates.**
9. **Do not continue when you find a contradiction.** Capture the conflict and stop the affected task until the source of truth is clarified.
10. **Do not collapse implementation failure into success.** If a step fails, the failure must remain visible, typed, and recoverable.

## Source-of-truth precedence
When documents conflict, obey this order:
1. `docs/decisions/*`
2. `docs/product/*`
3. `docs/business/*`
4. `docs/architecture/*`
5. `docs/security/*`
6. `docs/implementation/*`
7. `docs/testing/*`
8. workflow JSON / code

A workflow export is not allowed to redefine higher-level behavior.

## Required reading before implementation
Read in this order:
1. `README.md`
2. `docs/decisions/phase-1-market-decision.md`
3. `docs/decisions/phase-2-product-decision.md`
4. `docs/decisions/phase-3-architecture-decision.md`
5. `docs/decisions/phase-4-implementation-decision.md`
6. product requirements / acceptance criteria
7. business contracts and policy
8. architecture and security docs
9. implementation specs
10. testing docs and fixtures

## Implementation discipline
- Prefer small, traceable commits.
- Keep code, workflow exports, schemas, policies, and docs consistent.
- If you change a contract, update its schema/policy and any dependent docs.
- If a requirement is untestable, mark it and propose a testable equivalent.
- Preserve the ability to re-run the evaluation harness deterministically where the environment allows.
- Keep demo-specific mechanisms explicitly labeled as demo mechanisms.

## Hard safety constraints
- No fake data presented as real.
- No secret-bearing sample files.
- No unreviewed community nodes in the MVP unless explicitly justified in docs.
- No unrestricted LLM-to-tool bridge.
- No direct side effects from raw prospect text or raw model output.
- No workflow completion without durable state recording and explicit disposition semantics.

## Definition of done for any implementation task
An implementation task is complete only when:
- it matches the documented contract;
- it has a corresponding test/evidence path where applicable;
- it does not introduce secret leakage;
- it does not break source-of-truth precedence;
- it preserves or improves traceability;
- it is documented if behavior changed.

## When uncertain
Stop, record the uncertainty, and ask for clarification or update the relevant doc. Do not improvise.
