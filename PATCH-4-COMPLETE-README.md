# HLD Studio — Patch 4 complete client-side integration

This patch is based on the latest uploaded `src(3).zip`. It adds the practice/editor/execution domain boundaries while preserving existing HLD architecture, HLD learning, LLD lesson UI, and progress implementations.

## Included

- Existing global preference store retained as the single global preference source.
- Backwards-compatible language facade retained for existing lesson components.
- Exercise language resolver and metadata capability helper.
- Practice domain store and versioned repository for selected exercise, local override, code drafts, and attempts.
- Editor UI-session store (ephemeral; source files remain owned by Practice).
- Language-specific starter-file templates.
- Execution provider contract, capability discovery, and execution state store.
- Explicit unavailable behavior when no execution provider is registered.
- Tests for practice persistence, language capabilities, starter templates, and execution-provider boundaries.
- State architecture documentation.

## Important current-project constraints

The uploaded source has no package manifest, lockfile, editor dependency, code-execution API, compiler/runtime service, or submission backend. The 87 entries in `practice-catalogue.json` are all marked `planned` and currently identify Java as their language. Therefore this patch does not invent problem statements, claim C++/Python variants exist, simulate code execution, or fabricate test results.

A real code execution provider must be supplied by a trusted backend and registered with `registerExecutionProvider`. Do not run arbitrary learner code in the browser application process.

## Apply

Merge the included `src/` and `docs/` paths into the project root. No existing files are deleted. Existing HLD/LLD UI and progress data are intentionally preserved.

## Validation

ZIP structure and changed-file presence were checked. This source archive does not include `package.json`, lockfile, tsconfig or Vitest config, so the complete project build/test suite cannot be run against this upload. Run the project's existing `tsc` and Vitest commands after merging.
