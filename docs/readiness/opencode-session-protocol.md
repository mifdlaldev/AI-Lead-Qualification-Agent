# opencode Session Protocol

Use this protocol at the start and end of every implementation session.

## Session start
1. Read root `AGENTS.md`.
2. Read `README.md` status and current phase/gate.
3. Read the specific source-of-truth files for the task.
4. Identify requirement IDs, acceptance criteria, workflow IDs, and security constraints affected.
5. Inspect current repository state before editing.
6. State the intended change boundary internally; do not expand scope opportunistically.
7. Check for contradictions or missing prerequisites. If found, stop the affected work.

## During implementation
- Make the smallest coherent change that advances the current gate.
- Do not modify unrelated accepted behavior.
- Do not invent provider responses, test results, schema fields, reason codes, or environment values.
- Verify assumptions against repository docs and actual tool/runtime behavior.
- Keep generated artifacts sanitized.
- Record failures instead of hiding them.

## Before declaring completion
1. Re-read the relevant requirement/acceptance criteria.
2. Run the applicable validation/tests.
3. Check source-of-truth consistency.
4. Check Git diff for secrets, accidental files, and unrelated changes.
5. Update traceability/docs when required.
6. Report what was actually verified versus what remains unverified.

## Required completion report format
- **Task/gate:**
- **Files changed:**
- **Requirements addressed:**
- **Tests/verification actually run:**
- **Observed result:**
- **Known limitations/unverified items:**
- **Source-of-truth changes:** none / list
- **Next authorized task:**

## Prohibited completion language
Do not claim `production-ready`, `secure`, `bug-free`, `fully tested`, or `100% accurate` unless a defined evidence standard in this repository explicitly supports that exact claim. Prefer precise statements about tests actually executed.
