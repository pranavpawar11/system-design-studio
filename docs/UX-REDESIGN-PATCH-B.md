# UX Redesign — Patch B: Macro-to-Micro Journey

## Included

- Replaces the static four-card macro-to-micro teaser on the common landing page with an interactive, scroll-aware journey.
- Four stages: macro architecture, service responsibilities, class/object design, and implementation.
- Sticky visual panel on desktop.
- Active stage follows the most visible scroll step using IntersectionObserver.
- Numbered stage controls and explicit Explore stage buttons allow direct navigation.
- Stage visuals are purpose-built with SVG-friendly icon primitives and CSS, without adding a new animation dependency.
- Language preview supports Java, C++ and Python locally within the journey.
- Tablet/mobile layouts switch to a non-sticky, stacked presentation.
- Reduced-motion preferences disable stage transition motion.

## Scope boundaries

- Does not modify application routing or global navigation.
- Does not modify HLD/LLD learning dashboards, lesson data, progress stores, HLD canvas, practice state or execution.
- The Rate Limiter is an illustrative teaching example; no real backend or runtime is invoked.

## Apply

Merge the included `src/` files into the project root. This is an incremental patch intended to be applied after UX Patch A.

## Validation

The Patch A source used as the base was available, but the user's merged working project was not re-uploaded. ZIP integrity and source-level structural checks were performed. The uploaded source did not provide a full project manifest/test configuration for this patch, so a full build/test run is not claimed.
