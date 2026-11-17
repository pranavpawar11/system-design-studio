# HLD Studio — First Five LLD Lessons

This is an incremental content-and-navigation patch for the existing LLD track.

## Published lessons

The first five lessons in Level 01 — Object-Oriented Programming Fundamentals — are now available:

1. `what-is-an-object`
2. `what-is-a-class`
3. `state-behavior-and-identity`
4. `object-lifecycle`
5. `objects-and-classes-constructors-and-initialization` (Constructors and initialization)

Each lesson contains beginner-friendly explanations, Java-first examples, LLD design guidance, common mistakes, a self-directed exercise, and a three-question interactive knowledge check with explanations.

## Integration changes

- Moved the HLD / LLD track selector into the main Learn application header, removing the separate track-navigation row. The selector stays compact and responsive on mobile.
- Added a dedicated route: `#/learn/lld/lesson/<lesson-id>`.
- Added `LLDLessonPage.tsx`, which loads only the five published LLD lesson JSON files and reuses the existing lesson block and quiz components.
- Updated the LLD roadmap statuses for these five lesson nodes to `ready`.
- Updated LLD roadmap rows to link to available lessons and show available/planned counts.
- Fixed the LLD roadmap's stale reference to an undefined progress object by keeping untracked LLD levels in the planned state.
- HLD lesson routing, HLD lesson data, HLD progress, Studio, question engine, and the HLD roadmap are not modified by this patch.

## Progress behavior

The LLD track does not yet have a separate persistent progress store. The lesson page therefore provides a session-level “Mark as read” indicator and quiz pass feedback only. It does not write to or alter HLD progress.

## Apply

Extract the ZIP into the root of the HLD Studio project (the directory containing `src/`) and allow the listed files to merge/overwrite.

## Validation

All five lesson JSON files were validated against the project's `lesson.schema.json` with zero schema errors. The full TypeScript/Vite production build could not be completed in the supplied environment because the available `node_modules` directory is incomplete (missing `@types/node` and `vite/client`). Run `npm install` and `npm run build` locally after applying.
