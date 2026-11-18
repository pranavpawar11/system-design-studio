# Patch C — HLD Architecture Playground

## Included
- Adds an interactive architecture playground to the existing HLD learning home, directly below the progress hero and before the roadmap.
- Select Client, API Gateway, Load Balancer, Rate Limiter, Redis, or Database to inspect its role and responsibilities.
- Toggle load balancing and Redis cache; the conceptual request capacity and estimated path latency update with the controls.
- Adjust incoming traffic or simulate/reset a traffic spike; accepted and rejected traffic update immediately.
- Responsive layout, keyboard-operable controls, live metric announcements, and reduced-motion support.

## Preserved
- Existing HLD roadmap, lesson links, search, expansion controls, progress state, and lesson content are unchanged.
- No changes to the Studio canvas, architecture document, persistence, or backend.

## Validation
- Source archive structure and patch wiring checked.
- Full build/browser test could not be run because this upload contains `src/` only and does not include package.json, lockfile, or project build configuration.

Apply this patch on top of the latest uploaded source archive. It contains only changed/new files.
