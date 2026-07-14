# Market Evidence Matrix

**Cut-off:** 2026-07-14

This matrix separates observed evidence from project inference. It is not a statistical census of the freelance market.

| ID | Evidence type | Observed signal | Evidence strength | Project inference | What it does NOT prove |
|---|---|---|---|---|---|
| E1 | Recent empirical research | Study of 6,000+ public n8n workflows: LLMs commonly sit inside broader automation using control logic, tools, communications, storage, and human review | High | Portfolio should show an end-to-end business workflow, not only prompt-response | Does not prove buyer demand for this exact project |
| E2 | Recent empirical research | Explicit fallback paths, repair loops, failure-specific alerts, and human approval gates were relatively uncommon in the studied n8n workflows | High | Reliability-aware design can be a credible technical differentiator | Does not prove every client will pay extra for reliability controls |
| E3 | Current freelance-market signal | Public freelance listings observed in June 2026 requested combinations around lead qualification, AI/GPT scoring, CRM sync, routing, Slack alerts, and n8n automation | Medium | Lead qualification + integration is a commercially recognizable service bundle | Public search results are not a complete or representative job census |
| E4 | Current marketplace/service signal | Fiverr has active service-market positioning around AI lead generation/qualification and n8n automation | Medium | Buyers are exposed to outcome-oriented lead automation offers; generic “I use n8n” positioning is less distinctive | Does not prove Fiverr demand volume or conversion rate |
| E5 | n8n ecosystem signal | n8n maintains a lead-generation workflow category and public templates around lead processing/qualification patterns | Medium | The use case is native to the n8n ecosystem and demonstrable with common integrations | Template availability does not prove paid client demand |
| E6 | Current CRM ecosystem signal | Current small-business CRM products emphasize automation, AI, integrations, lead/deal management, and communication workflows | Medium | CRM/data synchronization is commercially familiar and useful in the demo | Does not determine which CRM should be selected for MVP |
| E7 | Recent security research | Agentic workflows can be influenced by crafted untrusted context/input | High for risk context | Treat lead-submitted text as untrusted; constrain AI authority and validate outputs | Does not mean this portfolio workflow will necessarily be attacked |
| E8 | July delivery constraint | Only the remainder of July is available for the stated first-client objective | High | Prefer a focused, publishable vertical slice over a broad enterprise platform | Does not guarantee a client if the project ships quickly |

## Demand pattern synthesized from the evidence
The most defensible recurring pattern is:

`capture inbound data → qualify/score → update system of record → route/notify → follow up`

The portfolio opportunity is to add disciplined controls around that pattern:

`validation + deduplication + deterministic boundaries + AI semantic analysis + confidence handling + human review + observability`

## Decision confidence
- **High confidence:** an end-to-end workflow is a stronger technical proof than a prompt-only demo.
- **High confidence:** reliability and constrained AI authority are defensible engineering choices.
- **Medium confidence:** lead qualification is the best first portfolio use case for the July objective.
- **Medium confidence:** small agencies/consultancies/B2B service teams are the best initial ICP.
- **Low confidence / unresolved:** exact CRM, notification channel, lead source, scoring rubric, and follow-up channel. These require Phase 2 product decisions.

## Anti-hallucination rule
If a future document cites “market demand,” it must specify whether the claim comes from:
1. a direct observed listing,
2. an ecosystem signal,
3. research evidence,
4. or an internal project inference.

These categories must not be collapsed into a single unsupported statement such as “most clients want X.”
