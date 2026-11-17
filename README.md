# HLD Studio — Multi-language LLD Patch 3 (integrated)

This patch is adapted to the uploaded `src(2).zip` project.

Merge the `scripts/` and `docs/` folders into the project root. The project's existing multilingual lesson template already matches the Patch 3 canonical template, so it is intentionally not duplicated here. Existing UI, language resolver, progress behavior, and all lesson JSON files are untouched.

Run from the project root:

```bash
node scripts/validate-lld-lesson.mjs src/data/learning/lld/lessons/what-is-an-object.json
node scripts/audit-lld-lessons.mjs
```

The audit script scans `src/data/learning/lld/lessons` by default and refreshes `docs/lld/LLD_DATASET_AUDIT.md`.
