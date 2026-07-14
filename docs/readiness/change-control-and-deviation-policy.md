# Change Control & Deviation Policy

## Purpose
Implementation evidence can reveal a false assumption. The response must be controlled correction, not silent drift.

## Change classes
### C1 — Implementation detail
No product/architecture behavior changes. Example: equivalent node arrangement. Update implementation docs only if operationally relevant.

### C2 — Defect correction
Implementation violated existing source of truth. Fix implementation; do not rewrite requirements to excuse the defect.

### C3 — Specification clarification
Existing docs are ambiguous but intended behavior is consistent with accepted decisions. Clarify docs and dependent contracts before/with implementation.

### C4 — Architecture change
Changes component boundary, data ownership, trust boundary, technology baseline, reliability model, or deployment topology. Requires a new/superseding decision record and impact review.

### C5 — Product/business scope change
Changes actors, dispositions, business policy semantics, MVP scope, or acceptance behavior. Requires explicit approval and updates across affected product/business/traceability artifacts.

## Mandatory deviation record
Before implementing C4/C5, record:
- discovered problem/evidence;
- affected requirements/files/workflows;
- alternatives considered;
- selected change and rationale;
- migration/backward-compatibility impact;
- testing impact;
- evidence/portfolio impact.

## Stop conditions
Stop the affected task when:
- two authoritative docs contradict each other;
- a required provider capability is unavailable;
- a security invariant cannot be satisfied;
- a data migration would be destructive without an approved plan;
- a requirement cannot be implemented as written;
- implementation would require fabricating a result or bypassing a test.

## No documentation laundering
Do not change documentation after a failing test merely to make the implementation appear compliant unless the underlying requirement was explicitly changed through this policy.
