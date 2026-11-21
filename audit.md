# Finale Build Plan

**Product:** FinSight — Recurring Payment Intelligence  
**Team:** CTRL+SLOTH  
**Deadline:** 12 PM on November 22, 2026

## 1. Where We Are

### Working today

- React/TypeScript frontend with a FastAPI backend.
- Synthetic demo mode and private CSV statement analysis.
- Recurring-payment detection using calendar and interval heuristics.
- Merchant alias resolution and cryptic descriptor handling.
- Detection of recurring, irregular, trial, price-change, duplicate, and review patterns.
- Overview, recurring payments, transactions, forecasts, review signals, Ask FinSight, merchant review, cancellation guidance, revocation tracking, saved statements, hosted snapshots, and evaluation views.
- CSV preview, column mapping, overlap review, refund reconciliation, and mapped-only analysis.
- Supporting transaction evidence, confidence indicators, anomaly explanations, and benchmark reporting.
- Responsive interface with keyboard navigation and reduced-motion support.

### Mocked, hardcoded, or limited

- Synthetic transactions and preprocessed detector outputs are repository fixtures, not live bank feeds.
- Forecasts and annual estimates are calculated from historical medians and detected cadences; they are projections, not confirmed future charges.
- Cancellation guidance is static provider guidance. It does not execute cancellation or confirm issuer or mandate status.
- Revocation tracking is local or tab-scoped. “Marked as revoked” means user-reported, not bank-confirmed.
- Benchmark results use synthetic labelled data and are not evidence of real-world accuracy.
- Hosted storage and authentication are pilot capabilities, not a verified public production deployment.

### Missing

- Live bank, issuer, UPI, NPCI, or account-aggregator connectivity.
- Issuer-confirmed mandate cancellation or payment execution.
- A consented, independently labelled real-world recurrence dataset.
- Fully coverage-aware forecasts that guard against stale or sparse history.
- Verified public hosted infrastructure, DNS/TLS, production database isolation, and operational recovery.

## 2. Where We Will Be

By **12 PM on November 22, 2026**, the finale build will provide a stable, locally runnable, end-to-end demo:

1. Open the FinSight workspace and see recurring commitments, estimated costs, transaction evidence, and review flags.
2. Import a valid CSV, preview and map its columns, review overlaps or refunds, and analyze the statement.
3. Resolve cryptic descriptors and surface supported recurring, irregular, trial-to-paid, and price-change patterns.
4. Search and open a commitment to trace it to its supporting transactions and detector evidence.
5. Review anomalies and follow provider-specific cancellation guidance through an interactive, clearly labelled user-reported checklist.
6. Explore forecasts, conditional savings, cash-buffer scenarios, calendar export, and commitment activity.
7. Open Evaluation & Audit to show synthetic precision, recall, F1 score, false positives, and false negatives with limitations clearly stated.
8. Show a Neo4j-backed relationship insight connecting accounts, transactions, descriptors, merchants, commitments, and evidence.
9. Display recency or statement-coverage assumptions for forecasts and never present stale estimates as confirmed renewals.

The local demo is the primary release path. Hosted functionality will be used only if verified immediately before the presentation.

## 3. User Segments

- **Primary:** Individual Indian consumers who need to discover hidden recurring debits and decode cryptic bank descriptors.
- **Additional:** Small-business owners and freelancers managing software, utility, card, and UPI commitments.
- **Additional:** Household budget planners comparing recurring obligations and upcoming cash pressure.
- **Additional:** Financial coaches, accountants, and operations teams reviewing statement evidence with clients or stakeholders.

## 4. Partner Tech Choice

### Neo4j

Neo4j will model and traverse relationships among:

- Accounts
- Transactions
- Raw bank descriptors
- Normalized merchants
- Recurring commitments
- Billing periods
- Trial charges
- Price changes
- Review alerts
- User-reported revocation activity

This enables insights such as:

- Which cryptic descriptors belong to the same merchant.
- Which transactions support a recurring commitment.
- How a trial charge connects to a later paid plan.
- Where price changes or duplicate merchant relationships require review.

Neo4j will supplement the existing FastAPI and CSV detector. It will not be presented as live bank or issuer connectivity.

## 5. Definition of Done

**FinSight is complete when a judge can run or observe one reliable journey from statement selection or import through recurring-pattern detection, traceable evidence, Neo4j relationship insight, and a clearly labelled cancellation checklist, supported by fresh verification and honest limitations.**