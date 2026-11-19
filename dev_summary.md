# System Design Studio — Frontend Project Handoff

**Status date:** 18 November 2026  
**Frontend repository:** `system-design-studio`  
**Backend repository:** `system-design-backend`  
**Current phase:** Frontend foundation established; preparing backend development and gradual migration.

---

## 1. Product vision

System Design Studio is an interactive learning and practice platform for software engineers and students.

The goal is to help users progress from system-design fundamentals to practical LLD and HLD problem solving.

The platform brings together:

1. **Learning:** Structured concepts, lessons, roadmaps and technical knowledge.
2. **Question catalogue:** Real-world system-design problems with structured requirements and learning material.
3. **Interactive design studio:** A visual workspace where users construct architecture designs.
4. **Evaluation:** Validate designs against requirements and provide meaningful findings and feedback.
5. **Progress:** Track learning and practice progress.
6. **Future AI assistance:** Use a curated knowledge base and hybrid AI/RAG approach to support explanations, learning and design feedback.

The product is not limited to HLD. Both LLD and HLD are part of its long-term scope.

## 2. Frontend technology stack

| Area | Technology |
|---|---|
| UI | React |
| Language | TypeScript |
| Build tool | Vite |
| State management | Zustand |
| Architecture canvas | React Flow (`@xyflow/react`) |
| Icons | Lucide |
| Data currently used | JSON question and learning catalogues |
| Routing | Hash-based application routing |

The frontend is independently maintained in the `system-design-studio` repository.

## 3. Application structure and navigation

The application has a public landing page and separate application experiences.

Important routes:

- `#/` — Public landing page
- `#/studio` — HLD Studio
- `#/learn` — Learning experience
- Additional learning and lesson routes

**Important implementation detail:** `src/main.tsx` dynamically loads `src/app/App`. The root-level `src/App.tsx` was identified as an old Vite starter file in an earlier source snapshot. Do not assume it is the real application entry point.

## 4. What has been built

### A. Public landing page and application shell

- Public landing experience.
- Application routing and main application structure.
- Entry points into the learning and studio experiences.

### B. HLD Studio

- Interactive architecture-design workspace.
- React Flow-based canvas.
- Component catalogue for adding architecture components.
- Connections between architecture components.
- Question-driven design practice.
- Evaluation-related foundations integrated with the studio workflow.

### C. Question catalogue

A JSON-based question catalogue has been developed with question-specific specifications and supporting sidecar files.

Examples of questions covered include:

- URL Shortener
- Rate Limiter
- Distributed Cache
- Video on Demand
- Ride Sharing
- Cloud File Storage and Sync
- Collaborative Document Editor
- Payment System
- Distributed Message Queue
- Live Streaming System
- Web Search Engine
- Snowflake ID
- Metrics and Monitoring System

The catalogue uses files such as:

- `question.json`
- `.extensions.json`
- `.learning.json`

The exact file organization varies by question package. Existing question data and validation rules must be preserved during backend migration.

### D. Learning experience

- Learning area and lesson flows.
- LLD home and lesson experiences.
- Roadmap and lesson catalogue.
- Structured learning content associated with questions.

An earlier source inspection found 499 roadmap lesson files, of which 5 were marked ready. This number must be rechecked against the latest source.

### E. Evaluation engine

Evaluation has been developed incrementally and includes foundations for:

- Declarative and custom evaluation rules.
- Evaluation package loading and validation.
- Runtime execution.
- Requirement evaluators.
- Findings and reports.
- Catalogue coverage.
- Metrics unification.
- Voting/poll metrics and capacity-related corrections.
- Regression tests and integration work.

These are substantial foundations, but the entire evaluation system should not be assumed production-complete.

### F. UI and theme direction

Dark mode, light mode and user-selectable color palettes have been discussed, including a VS Code-inspired palette.

Treat the final completeness of theme selection and consistency across screens as something to verify against the current source.

---

## 5. Important frontend architecture decision: API abstraction

The frontend has an API abstraction with:

- `ApiClient`
- `LocalApi`
- `HttpApi`

This boundary is important and must be preserved.

The intention is to allow the frontend to work with local data while gradually introducing the remote backend.

**Migration principle:** Feature components should consume the API abstraction rather than directly calling HTTP endpoints or importing backend-owned data.

We should not rewrite the entire frontend to use HTTP in one step.

---

## 6. Current data architecture

The application currently relies substantially on local JSON files for questions, learning content and related catalogue information.

This was useful for building the frontend independently, but it creates limitations:

- Catalogue data is bundled with the frontend.
- Updating content requires frontend changes and redeployment.
- Learning and question data are not centrally managed.
- Private evaluation rules and fixtures need stronger separation from learner-facing content.
- Content publishing and version management need a backend.

The production bundle previously contained a large JavaScript chunk of approximately 1.3 MB (around 249 KB gzip). Bundle optimization was deliberately deferred until the JSON catalogue is moved behind the database/API.

---

## 7. Known areas requiring investigation

These observations came from an earlier source snapshot. Verify them against the latest frontend before changing anything.

| Area | Previous observation | Required action |
|---|---|---|
| Question registry | An older duplicate registry imported JSON and localStorage | Check whether it is still used |
| LLD pages | Some pages imported LLD JSON directly | Move data access behind API abstraction |
| Progress persistence | Some code used localStorage directly | Check storage adapter usage |
| Catalogue coverage | Used `import.meta.glob` for question JSON | Decide how coverage works after migration |
| Roadmap | Many lesson files existed, few were marked ready | Reassess content readiness |
| Tests | Several tests had old route/content assumptions | Update expectations only when behavior has intentionally changed |

The platform storage adapter previously identified was `platform/storage/key-value-storage.ts`.

---

## 8. Build and test status

### Production build

A production build succeeded after TypeScript fixes.

Previously reported build details:

- Vite 8.3.5
- 2707 modules transformed
- Main application JavaScript chunk approximately 1.3 MB
- Build completed successfully

Bundle-size optimization is postponed until after data migration.

### Test status

A previous completed Vitest report showed:

- 105 test suites
- 67 passed
- 38 failed
- 315 tests
- 237 passed
- 78 failed

Some failures were caused by stale test expectations, while others required genuine code fixes.

On 17–18 November, another test run was redirected to `vitest-failures.txt`. The file exceeded 38,000 lines and the run was interrupted. It must not be treated as a completed test report.

**Next frontend quality task:** Inspect the latest test output in a controlled way and run focused test groups. Do not weaken tests just to achieve a green result.

---

## 9. Backend migration decisions already made

The backend will be developed in a separate repository:

**`system-design-backend`**

The proposed initial stack:

| Area | Technology / direction |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Fastify |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Supabase Auth |
| Database hosting | Managed PostgreSQL, with Supabase proposed |
| Backend hosting | Render proposed |
| Frontend hosting | Vercel proposed |
| API style | Versioned REST API |

Hosting choices remain proposals until explicitly finalized.

### Architecture

Start with a **modular monolith**, not microservices.

Suggested API prefix:

`/api/v1`

Keep modules separated by domain so the backend can evolve without introducing distributed-system complexity prematurely.

### Database strategy

Use PostgreSQL with relational metadata and JSONB for nested question content.

Relational data will cover:

- Questions and stable identities
- Question versions
- Categories and tags
- Publishing status
- Assets
- Private evaluation metadata

JSONB will store structured content such as:

- Question specifications
- Learning content
- Extensions
- Evaluation definitions
- Coverage information
- Fixtures

Published question versions should be immutable. Editing a published question creates a draft.

Publishing workflow:

**Draft → Review → Validation → Publish**

Public question and learning content must be separated from private evaluation rules and fixtures. Learner-facing APIs must not expose hidden fixtures or expected solutions.

The database should become the source of truth. Version-controlled JSON exports should be retained for review, backup and reproducibility.

---

## 10. Proposed migration sequence

The migration should happen incrementally.

1. Create the backend repository and establish its development foundation.
2. Set up configuration, health checks and PostgreSQL connectivity.
3. Define the initial database schema.
4. Build a validated importer for existing question JSON packages.
5. Implement question catalogue APIs.
6. Integrate the frontend `HttpApi` while preserving `LocalApi`.
7. Migrate learning content and lesson retrieval.
8. Introduce question versioning and publishing.
9. Move evaluation execution to the backend.
10. Migrate user authentication and progress persistence.
11. Revisit frontend bundle optimization after local JSON dependencies are removed.

---

## 11. Immediate next milestone

Do not start by implementing every backend module.

Start with a small, working backend foundation:

- Repository initialization.
- TypeScript and Fastify setup.
- Environment configuration.
- Health endpoint.
- PostgreSQL connection.
- Prisma initialization.
- Initial database schema foundation.
- Basic error handling and logging.

Then validate the foundation before implementing the question catalogue migration.

---

## 12. Working principles for future development

1. Preserve existing frontend functionality.
2. Inspect the latest source before creating code patches.
3. Keep API access behind the existing abstraction.
4. Migrate one feature/domain at a time.
5. Keep public content separate from private evaluation data.
6. Distinguish implemented features from proposed features.
7. Do not assume old source snapshots accurately represent current code.
8. Run focused tests after changes and report actual results.
9. Prefer incremental, reviewable patches over large rewrites.
10. Keep the overall product vision focused on both LLD and HLD.

**Current transition:** Frontend foundation established → separate backend foundation → gradual database/API migration.