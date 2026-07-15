-- ============================================
-- Demo Policy Seed Data
-- ============================================
-- Seeds the policy_config table with v1 qualification
-- policy values for the demonstration environment.
-- ============================================

INSERT INTO policy_config (policy_version, policy_key, policy_value, description) VALUES

-- Excluded services (hard-rule rejection)
(1, 'excluded_services', '[
    "social media management only",
    "influencer marketing",
    "video production without automation",
    "pure graphic design",
    "SEO content writing without automation",
    "manual data entry services"
]', 'Service categories that are deterministically out of scope'),

-- Service fit taxonomy
(1, 'service_categories', '{
    "IN_SCOPE": ["workflow automation", "AI-assisted workflow", "API integration", "system integration", "process automation"],
    "PARTIAL": "mixed project containing in-scope automation plus unrelated work",
    "OUT_OF_SCOPE": "request clearly unrelated to offered services",
    "UNKNOWN": "insufficient or contradictory information"
}', 'Reference service-fit taxonomy for demo agency'),

-- Disposition rules
(1, 'disposition_rules', '{
    "QUALIFIED": {
        "requires": ["contract_valid", "not_duplicate", "no_hard_exclusion", "service_fit_established", "no_high_risk_ambiguity", "evidence_sufficient"],
        "description": "Lead is ready for direct sales action"
    },
    "NURTURE": {
        "requires": ["not_disqualified", "insufficient_for_qualified"],
        "description": "Lead may be relevant but not ready for direct sales; missing info can be requested"
    },
    "DISQUALIFIED": {
        "requires": ["hard_exclusion_applies", "or out_of_scope_evidence_sufficient"],
        "description": "Deterministic exclusion or strong out-of-scope evidence"
    },
    "HUMAN_REVIEW": {
        "triggers": ["malformed_ai_output", "critical_evidence_conflict", "confidence_policy_not_met", "prompt_injection_flagged", "valuable_but_ambiguous"],
        "description": "Requires human review before final disposition"
    }
}', 'Disposition rules and conditions'),

-- Confidence thresholds
(1, 'confidence_thresholds', '{
    "min_confidence_qualified": "medium",
    "min_confidence_disqualified": "medium",
    "default_if_below": "HUMAN_REVIEW"
}', 'Confidence thresholds for automated decisions'),

-- Risk flags requiring human review
(1, 'risk_flag_rules', '{
    "prompt_injection": "HUMAN_REVIEW",
    "adversarial_content": "HUMAN_REVIEW",
    "contradictory_signals": "HUMAN_REVIEW",
    "missing_critical_info": "NURTURE or HUMAN_REVIEW"
}', 'Risk flags and their required actions'),

-- Consent policy
(1, 'consent_policy', '{
    "require_consent_for_email": true,
    "require_consent_for_followup": true,
    "allow_internal_alert_without_consent": true
}', 'Consent requirements for external communications'),

-- Budget range mapping
(1, 'budget_ranges', '{
    "UNDER_1K": "Small project",
    "1K_5K": "Standard project",
    "5K_15K": "Mid-range project",
    "15K_50K": "Large project",
    "OVER_50K": "Enterprise project",
    "NOT_PROVIDED": "Budget not disclosed"
}', 'Budget range normalization map');