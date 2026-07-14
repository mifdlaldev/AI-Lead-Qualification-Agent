# Implementation Readiness Checklist

**Purpose:** prevent implementation from starting with unresolved planning gaps.

## R0 — Source-of-truth readiness
- [ ] `AGENTS.md` has been read in the active opencode session.
- [ ] `README.md` and all accepted decision records have been read.
- [ ] No unresolved contradiction exists between decisions, requirements, architecture, security, and implementation specs.
- [ ] Any discovered ambiguity has an explicit blocker record; it is not guessed around.

## R1 — Repository readiness
- [ ] Required directories from `docs/implementation/repository-structure.md` exist.
- [ ] `.gitignore` excludes secrets, local state, sensitive exports, and generated private artifacts.
- [ ] `.env.example` contains names/placeholders only.
- [ ] `compose.yaml` pins the accepted n8n baseline.
- [ ] `AGENTS.md` remains present at repository root.

## R2 — Configuration readiness
- [ ] Required configuration names are defined.
- [ ] Required secrets are supplied outside Git.
- [ ] Demo/test destinations are separated from any future production destinations.
- [ ] Missing critical configuration fails closed.
- [ ] OpenAI model availability/Structured Outputs preflight is completed before model pinning.

## R3 — Database readiness
- [ ] Initial migration is versioned.
- [ ] Canonical entities match the architecture data model.
- [ ] Race-sensitive uniqueness constraints exist where required.
- [ ] Runtime and migration privileges are separated where feasible.
- [ ] Migration can be applied to a clean database.
- [ ] Schema version can be verified before workflows activate.

## R4 — Contract readiness
- [ ] Inbound schema v1 exists and matches the lead data contract.
- [ ] Semantic analysis schema v1 exists and matches the bounded AI contract.
- [ ] Workflow input/output contracts exist for WF-01 through WF-15 where applicable.
- [ ] Reason-code registry exists.
- [ ] Qualification policy v1 is machine-readable and consistent with docs.
- [ ] Prompt v1 does not contain hidden hard business rules that exist nowhere else.

## R5 — Security readiness
- [ ] No secret exists in tracked files/history intended for publication.
- [ ] Public ingress authentication/abuse controls are configured for the selected exposure model.
- [ ] AI receives minimum necessary data and no privileged tool credentials.
- [ ] Prospect text and AI output are treated as untrusted.
- [ ] Human review resolution is protected against token reuse/double resolution.
- [ ] Synthetic evaluation cannot accidentally send to production destinations.

## R6 — Observability readiness
- [ ] Correlation ID propagation is defined end to end.
- [ ] Workflow/release, policy, schema, and prompt versions are recordable.
- [ ] Unexpected failures reach the global error handler where technically applicable.
- [ ] Logs/alerts are sanitized.
- [ ] Failed/retry-pending work remains queryable.

## R7 — Test readiness
- [ ] Synthetic fixtures cover happy path, invalid input, duplicate, out-of-scope, ambiguity, AI contract failure, adversarial input, no-consent, human override, and dependency failure.
- [ ] Expected outcomes are frozen before benchmark execution.
- [ ] Evidence output format is defined.
- [ ] Benchmark cannot overwrite prior evidence without an explicit new run/version.

## Start authorization
Implementation may begin when R0 is satisfied and the current implementation gate's prerequisites are satisfied. Later readiness sections may be completed incrementally according to the gate order; they may not be silently skipped.
