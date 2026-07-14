# Non-Functional Requirements

These are product-level quality requirements. Numeric SLOs are not invented before the implementation environment is selected and benchmarked.

## Reliability
- **NFR-001:** No single malformed lead shall corrupt processing of unrelated leads.
- **NFR-002:** Duplicate/replayed events shall not create uncontrolled repeated side effects.
- **NFR-003:** Retry behavior shall be bounded and observable.
- **NFR-004:** Critical failures shall preserve enough context for diagnosis/reprocessing.

## Security
- **NFR-010:** Inbound free text shall be treated as untrusted input.
- **NFR-011:** Secrets shall not be embedded in workflow exports, prompts, test fixtures, screenshots, or repository content.
- **NFR-012:** AI output shall be validated before use by deterministic business logic.
- **NFR-013:** Least-privilege access should be used for integrations where supported.
- **NFR-014:** The workflow shall not allow prospect text to choose credentials, endpoints, recipients, or privileged tool actions.

## Privacy
- **NFR-020:** Synthetic data shall be the default for public tests and portfolio evidence.
- **NFR-021:** Logs and screenshots intended for public use shall not expose secrets or unnecessary personal data.
- **NFR-022:** Data retention behavior must be documented before any real personal data is processed.

## Auditability
- **NFR-030:** A lead's path shall be reconstructable using a correlation identifier and event records.
- **NFR-031:** Automated recommendation and human final decision shall remain distinguishable.
- **NFR-032:** Decision reason codes shall be machine-readable.

## Maintainability
- **NFR-040:** Business policy values should be configurable rather than scattered as undocumented constants.
- **NFR-041:** Workflow stages should have clear responsibilities and stable input/output contracts.
- **NFR-042:** Vendor-specific implementation details should not redefine business semantics.

## Portability
- **NFR-050:** The business specification shall remain valid if the CRM, notification channel, or model provider changes.

## Performance
- **NFR-060:** No unverified latency or throughput target is claimed in Phase 2.
- **NFR-061:** Implementation testing must measure end-to-end latency and component failures before portfolio claims are written.

## Cost
- **NFR-070:** AI calls should be avoided when deterministic logic has already produced a terminal outcome.
- **NFR-071:** Implementation testing should record enough usage information to estimate per-lead variable cost for the selected stack.
