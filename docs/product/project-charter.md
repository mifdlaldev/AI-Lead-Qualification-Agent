# Project Charter — Initial

**Status:** Initial charter established from Phase 1; to be refined during product requirements planning.

## Project
**AI Lead Qualification Agent**

Functional description: **AI-Assisted Lead Qualification & Smart Routing System**.

## Business objective
Create a real, testable portfolio project that demonstrates the ability to design an end-to-end AI-enabled business automation workflow and produces credible proof-of-work for freelance client acquisition.

## July 2026 objective
Use the project as a core credibility asset in the effort to win Mifdlal's first freelance client before the end of July 2026.

This is a target, not a guarantee.

## Intended business problem
Small teams may receive inbound leads that require repetitive manual work before sales action:
- checking whether required information exists,
- interpreting free-text needs,
- deciding whether the lead is relevant,
- prioritizing urgency/fit,
- preventing duplicate processing,
- updating a CRM or system of record,
- notifying the appropriate person,
- and following up.

The project will demonstrate how selected parts of this process can be automated while retaining human control for uncertain cases.

## Project principles
1. **Outcome before tooling** — explain the business process before n8n or model details.
2. **Evidence before claims** — portfolio metrics must come from actual tests.
3. **Hybrid decisioning** — deterministic rules where consistency matters; AI where semantic interpretation adds value.
4. **Human control** — uncertain or high-impact decisions should be reviewable.
5. **Reliability-aware** — validation, duplicate control, failure paths, and logging are first-class concerns.
6. **Focused scope** — build a coherent vertical slice instead of an oversized enterprise platform.
7. **Reusable proof** — one implementation should generate assets usable across multiple freelance platforms.

## In scope at charter level
- inbound lead processing,
- qualification/scoring concept,
- routing concept,
- business-system synchronization concept,
- notification/follow-up concept,
- human-review concept,
- reliability and traceability requirements,
- evidence-generation plan.

## Not yet decided
- exact lead source,
- exact CRM/database,
- exact notification channel,
- exact LLM/model/provider,
- exact scoring formula,
- exact workflow topology,
- exact hosting/deployment,
- exact MVP feature boundary.

These must be decided in later phases rather than invented in Phase 1.

## Explicit non-goals
- pretending to serve a real client before one exists,
- claiming enterprise production readiness without evidence,
- building a complete CRM,
- replacing human sales judgment in every case,
- maximizing the number of integrations for visual complexity,
- reproducing another freelancer's case study or metrics.

## Success definition for the project
The project is successful as a portfolio asset when it can provide:
- a functioning end-to-end demo,
- reproducible test scenarios,
- documented business logic,
- verified execution evidence,
- honest measured results,
- clear architecture/workflow explanation,
- and reusable portfolio/demo material.

Quantitative thresholds will be defined before implementation in the testing/evidence phase.
