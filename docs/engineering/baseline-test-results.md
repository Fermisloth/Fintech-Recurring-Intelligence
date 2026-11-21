# Baseline verification — 12 November 2026

| Check | Command or procedure | Result |
| --- | --- | --- |
| Frontend build | From frontend, `npm run build -- --outDir <temp> --emptyOutDir` | Exit 0. Vite 8.3.5, 1,963 modules. Existing lazy WebGL chunk 923.54 kB minified / 244.35 kB gzip and size warning |
| Frontend lint | From frontend, `npm run lint` | Exit 0 |
| Frontend tests | `node --localstorage-file=<temp> --test frontend/tests/*.test.mjs frontend/revocation-guide.test.mjs` | 10 passed, 0 failed |
| Python benchmark tests | `python -m unittest discover -s tests -p test_benchmark_holdout.py` | 2 passed |
| Full Python suite | With declared requirements installed into isolated temp target and PYTHONPATH set, `python -m pytest -q -p no:cacheprovider` | 16 passed, 1 warning in 0.95 s. Starlette TestClient/httpx deprecation; pytest-asyncio also emitted an unset fixture scope notice |
| Original demo regression | V3 detector and evaluator with CSV output paths redirected to temporary files | 56 debits, 10 groups, TP 45, FP 0, TN 11, FN 0; precision, recall, F1 all 1.000 |
| Challenge replay | `src.benchmark_holdout.evaluate()` in memory; compare to bundled JSON | Exact artifact match. 32 debits, 8 cases, 10 merchant keys, TP 16, FP 4, TN 5, FN 7. Precision 80.0%, recall 69.6%, F1 74.4% |
| npm advisory check | `npm audit --json`; `npm audit --omit=dev --json` | Full audit exited 1 with 10 moderate dependency entries attributable to one dev-toolchain advisory. Production-only exited 0 with 0 findings |

Node 26.13.0, npm 11.20.0, and bundled Python 3.12.14 were used. The working-copy virtual environment points at a missing Python 3.14 executable. Tests used an isolated Python dependency directory instead. Detector outputs and Vite builds used temporary directories. This audit did not repeat browser interaction testing. Earlier feature verification is recorded in the implementation reports.

## Exploratory detector checks

A temporary CSV carried 17 synthetic debits in four groups. V3 classified four observations with one skipped monthly cycle as monthly, classified a same-day duplicate as recurring without a review flag, rejected four weekly charges as non-recurring, and split a monthly price drop into tiers that missed the first two charges. These probes do not contribute to either published benchmark.

Registry advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Python advisory scanning was outside this run.

## Release verification

This file records the pre-release audit baseline. The final local release passed 25 Python tests, 10 frontend tests, lint, the clean-checkout build, and synthetic and real-data Chromium workflows. See the [final release verification](implementation-log.md#final-release-verification).

## Current audit

### Assigned-task verification — 15 November 2026

Developer-supplied starting baseline at `50541da`: 46 Python passed with hosted module skipped for missing Alembic; 24 frontend passed; build/lint passed. Initial implementation verification: **70 Python passed, one hosted module skipped; 25 frontend passed; lint and disposable TypeScript/production build passed**. Browser execution was initially blocked by missing Playwright; see the successful targeted closure below. Synthetic calendar F1 remains74.42%; merchant F1 remains73.97%, exact recoveries5/11, mixed merchants0. Fixtures/labels/alias map/bundled benchmark artifact are unchanged. See the [implementation log](implementation-log.md#assigned-tasks--15-november-2026) for commands, actual red/green outputs and warnings. These full-suite results do not establish fresh hosted acceptance or replace historical results.

### Targeted closure — 15 November 2026

The initial Playwright blocker above was resolved under explicit authorization: Playwright1.65.0 and Chromium were installed only in temporary external tooling storage. Private-statement and calendar-export browser scripts passed against loopback FastAPI with disposable synthetic SQLite. Added coverage verifies invalid input, nested drag feedback, keyboard picker, replacement/removal, cancellation and stale responses. Final focused Python selection: `18 passed in 1.57s`, including an additional trusted-alias/private-consent invariant. No production code changed during closure, so the prior complete Python70/frontend25/build/lint results were reused; the new focused test is not presented as a new full-suite run. Hosted Alembic limitation remains. The frozen artifact's historical source fingerprint is now pinned as well as separately checking the current fingerprint; deliberate mutation checks rejected all tested metric/count/hash/prediction/evidence/provenance changes.

The 12 November 2026 rerun is recorded in the [current test report](../engineering-evaluation/test-report.md), including fresh build, lint, Python, frontend, Chromium and holdout results. The earlier entries on this page are historical baselines.
