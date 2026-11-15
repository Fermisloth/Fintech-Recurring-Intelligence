# FinSight product requirements

## Current local release

- Support CSV drop/picker selection through the same bounded parser and mapped-only submission; show selected-file details, truthful phases and client cancellation.
- Use structured descriptor evidence for review suggestions without automatic unknown-merchant merging. Preserve numeric brands and raw descriptions.
- Fit short-month and adjacent-month anchors without lowering evidence thresholds. Flag weekly-looking irregular histories for review.

These extensions have backend/frontend checks and synthetic Chromium acceptance for drop/picker selection, validation, replacement/removal, cancellation, mapping, analysis and merchant review. Hosted verification still lacks Alembic; no hosted dependency/schema changes were made.

- Analyze the bundled synthetic statement and show recurring candidates with cadence, amount, and supporting evidence.
- Keep observed debits, inferred commitments, and projected payment dates distinguishable.
- Let users review guidance and record cancellation progress locally. A user report must stay distinct from issuer confirmation.
- Show the original regression and separate challenge-suite results with their provenance. The in-app benchmark presents the challenge suite.
- Keep interactive views keyboard accessible and respect reduced-motion preferences.

## Verified release capabilities

- Preview and validate a private CSV with field, date, amount, and currency mapping. Clear the imported session from the current tab.
- Link merchant descriptors explicitly and recalculate inferred commitments. Keep observed history visible alongside user-reported revocation.
- Reproduce the synthetic demo from a clean source snapshot and verify the private workflow on de-identified real data.
- Compare opt-in local workspaces by currency. Preserve separate account analysis and exclude unspecified currency from combined monetary totals.
- Let hosted pilot users preview, save with explicit retention, restore, export and delete owner-scoped snapshots. Local HTTPS browser verification used disposable SQLite.

## Future acceptance gates

- Verify live PostgreSQL isolation, deployment configuration, credential revocation, physical retention and recovery before hosting externally.
- Use an authorized, independently labeled real-data set before reporting real-world generalization. The blinded synthetic merchant holdout remains a regression benchmark.

See the [feature inventory](engineering/feature-inventory.md) for implementation status and the [roadmap](engineering/feature-roadmap.md) for approval candidates.
