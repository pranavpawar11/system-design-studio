# UX Redesign — Patch A

## Scope

Adds the common public landing page, the first interactive HLD/LLD Rate Limiter demonstration, and the first navigation restructuring.

## Routes

- `#/` — common landing page
- `#/studio` — HLD Studio workspace
- `#/learn` — existing HLD learning dashboard
- `#/learn/lld` — existing LLD dashboard
- Existing HLD and LLD lesson routes remain unchanged.
- Unknown non-route hashes continue to open Studio to preserve legacy `#share=...` links.

## Landing page

- Responsive hero and dual-track entry points.
- HLD architecture and LLD class/code perspectives.
- Adjustable split-view control on wider screens.
- Deterministic conceptual traffic model with a 180K RPS illustrative limiter capacity.
- Traffic slider and spike/reset interaction.
- Accepted/rejected request metrics.
- Java, C++ and Python code preview selector (local demo state only).
- Introductory macro-to-micro overview and HLD/LLD track cards.
- Reduced-motion CSS support.

The traffic numbers are a teaching illustration, not measured performance or a claim about real infrastructure capacity. The UI explicitly labels the simulation as conceptual.

## Navigation changes

- Brand links on learning and Studio pages return to the common landing page.
- HLD learning pages show an Open Studio action.
- LLD learning pages show the global programming-language selector without an HLD/LLD track switcher.
- Studio's reciprocal Learn/Studio mode switcher is removed; workspace controls remain.
- The previous Studio root link is now `#/studio`.

## Preserved

- Existing HLD learning dashboard and lesson routes.
- Existing LLD roadmap, lesson routes, language preference and progress.
- HLD Studio canvas, controls, state and share decoding.
- Existing data files and practice catalogue.

## Not included yet

- Scroll-driven macro-to-micro sticky zoom (Patch B).
- HLD and LLD homepage playgrounds (Patches C and D).
- Final responsive/navigation regression pass (Patch E).

## Validation

The source ZIP provided for this patch contains `src/` but not `package.json`, a lockfile, TypeScript configuration or test configuration. ZIP integrity and changed-file presence can be checked, but the project build and Vitest suite cannot be run against this upload. Run the repository's configured typecheck, build and tests after merging.
