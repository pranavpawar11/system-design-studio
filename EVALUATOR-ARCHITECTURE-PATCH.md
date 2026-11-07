# Evaluator architecture patch

## Changes

- Replaced implicit URL Shortener fallback with explicit question-ID dispatch.
- Extracted the existing URL Shortener evaluator without changing its checks.
- Kept the existing Rate Limiter evaluator behind its own explicit registry entry.
- Added a Voting / Poll evaluator using the Poll question's component catalogue, connection types, FR/NFR IDs, and configured capacity targets.
- Added the Voting / Poll question, learning path, and extension data to the local question catalogue.
- Added an explicit unsupported-evaluator report. Unknown questions now return `not-evaluated` and never execute URL Shortener checks.
- Added registry regression tests, including a test that a Poll solution cannot produce URL Shortener diagnostics.
- Added `npm test` (`vitest run`) to package scripts.

## Evaluator coverage in this patch

- `hld-url-shortener-001`
- `hld-rate-limiter-001`
- `hld-polls-001`

Other question IDs intentionally report that no evaluator is registered. They do not fall back to another question's rules.

## Validation performed

- Targeted TypeScript compilation of the evaluator modules and local question catalogue passed using the available global TypeScript compiler.
- Full `npm ci` could not complete in this environment (dependency installation timed out); therefore the Vitest suite and full application build were not run here.
- New tests are included for execution in the user's project with `npm test`.
