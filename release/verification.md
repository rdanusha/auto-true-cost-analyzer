# Local release verification

## Executed checks

- `npm run check`: passed JavaScript syntax checks for `calculator.js` and `app.js`.
- `npm test`: 12 tests passed, 0 failed. Includes tiny-positive-APR regression cases and independent high-precision payment/balance references for 72- and 84-month loans.
- `npm run test:e2e`: 10 Chromium browser tests passed, 0 failed.
- Layout checks: 320, 390, 768, and 1440 CSS pixels, including all comparison views.
- Additional deterministic calculation verification: 2,000 scenarios reconciled net cash-flow cost with depreciation plus interest and operating costs. Largest observed floating-point difference was approximately 0.000000011 USD.
- Additional ad-hoc WebKit smoke test at 390px: comparison rendering, year-by-year tab, 84-month loan selection, zero-mileage cost-per-mile handling, and no horizontal document overflow passed. No page errors observed. This is not a full Safari/iOS device test.
- `npm audit`: 0 known vulnerabilities in installed dependencies.
- `git diff --cached --check`: passed.
- Static scan: no matches for credential assignments, known access-token patterns, private keys, unsafe eval/shell execution, local user paths, or work email in added source.
- Local HTTP preview returned 200 and a browser loaded two example vehicles with the comparison visible.
- Additional keyboard smoke checks passed: skip link, adding a vehicle, focus after adding/removing, and a 100-character name at 320px without document overflow.
- Opening `index.html` directly using `file://` worked in Chromium and WebKit, including example rendering and switching comparison views, with no JavaScript errors.
- GitHub Actions references are pinned to verified immutable commit SHAs. The workflow YAML, deployment gating, permissions, and six-file publication allowlist passed local assertions.
- Independent pre-commit re-review: passed with no blocking security or logic findings after the tiny-APR fix. The reviewer independently confirmed the positive-APR references with high-precision Decimal calculations.
- Desktop, mobile, and social-preview images were captured from the running app and visually inspected.

## Publication gates still outstanding

- Authenticated GitHub access for the approved personal account.
- Public repository creation and source push.
- GitHub Pages configuration and successful workflow run.
- Live app, relative asset paths, social image, and signed-out desktop/mobile checks.
- Facebook link-preview verification and separate authorization to publish to Facebook.

Passing local checks is not evidence that the app has been published. The Facebook post remains a draft until the public URLs are verified.
