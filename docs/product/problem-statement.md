# Problem Statement

## Core problem
Inbound lead handling often contains repetitive manual steps between **lead arrival** and **sales action**. A team may need to validate data, interpret free text, check fit, assign priority, detect duplicates, update systems, notify someone, and decide whether a human should review the lead.

When this process is manual or fragmented, the likely operational risks include:
- inconsistent qualification,
- delayed routing,
- duplicate work,
- incomplete records,
- weak handoff visibility,
- and time spent on repetitive triage.

These are problem hypotheses the portfolio is designed to address. The project will not claim quantified business impact until implementation tests produce evidence.

## Design challenge
Create a workflow that automates repeatable processing without treating an LLM as an unrestricted decision-maker.

The system should distinguish among:
- **deterministic decisions** — schema checks, required fields, duplicate rules, hard business constraints;
- **semantic decisions** — interpreting free-text needs or extracting structured meaning;
- **uncertain decisions** — cases that should be escalated for human review.

## Desired future state
For each inbound lead, the system should be able to produce a traceable processing outcome such as:
- accepted for automated qualification,
- rejected/held because validation failed,
- identified as duplicate,
- classified/routed according to defined business rules,
- or escalated for human review.

The exact states and thresholds will be specified in Phase 2.

## Why AI is included
AI is justified only where unstructured language or semantic interpretation makes deterministic rules insufficient or brittle.

AI is **not** required for:
- every branch,
- basic validation,
- duplicate checks,
- hard eligibility constraints,
- or simple routing conditions.

## Why human review is included
AI output can be uncertain and externally submitted text is untrusted input. A review path provides a controlled outcome for ambiguous cases instead of forcing a false binary decision.

## Problem boundary
This project solves **qualification and routing workflow orchestration**. It does not attempt to solve:
- full sales forecasting,
- autonomous contract negotiation,
- a complete CRM replacement,
- universal lead scoring for every industry,
- or guaranteed conversion improvement.

## Evidence requirement
Any future claim such as “faster,” “more accurate,” “reduced manual work,” or “processed X leads” must be tied to a documented test method and measured result from this project.
