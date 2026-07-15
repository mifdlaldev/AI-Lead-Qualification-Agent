# Evidence Directory

This directory stores **generated benchmark outputs** from the synthetic evaluation harness (WF-15).

## Rules
- All evidence is generated from synthetic, sanitized test fixtures.
- Never commit raw sensitive execution data or real PII.
- Each benchmark run writes to a versioned subdirectory.
- Previous evidence is not overwritten without an explicit new run/version.

## Structure
```
evidence/
├── v1.0.0/
│   ├── run-summary.json
│   ├── per-fixture-results/
│   └── metrics.json
└── .gitkeep
```