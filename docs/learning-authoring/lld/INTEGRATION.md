# LLD Track Integration

## What this integration adds
- A Learn-only HLD / LLD track switcher.
- The LLD roadmap at `#/learn/lld`.
- A dedicated LLD roadmap view backed by `src/data/learning/lld/roadmap.json`.
- A visible categorized practice-library overview backed by `practice-catalogue.json`.
- Responsive styles scoped to the Learn section.

## What it deliberately does not change
- The existing HLD roadmap, HLD lesson catalogue, HLD progress events or HLD lesson routes.
- Studio canvas, Studio routes, question engine, or shared Studio styles.
- The HLD `LearnHome` implementation.

## Apply
Extract the patch into the repository root, preserving the `src/` and `docs/` paths.

## Routes
- HLD: `#/learn`
- LLD: `#/learn/lld`
- Studio: `#/`

## Current LLD content state
The roadmap and practice catalogue are available. Lesson JSON files are authoring starters and remain `planned`, so they are intentionally not clickable/published yet. The LLD view does not read or write HLD progress. When the first LLD lessons are authored, add an LLD-specific lesson route and progress namespace rather than reusing HLD progress storage.

## Validation
The curriculum JSON and starter files should be parsed as JSON. A full app build requires the project's npm dependencies; if they are not installed, `npm run build` cannot complete until dependencies are installed.
