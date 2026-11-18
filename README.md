# HLD Studio

**Learn system design. Design architectures. Practice object-oriented design.**

HLD Studio is an interactive learning and design workspace for engineers preparing to understand and practice **High-Level Design (HLD)** and **Low-Level Design (LLD)**. It brings a visual architecture canvas, structured learning paths, and hands-on design exercises into one application.

The project is being developed as a learning platform: the goal is to help learners move from understanding concepts to making and explaining design decisions.

> **Project status:** Active development. The HLD and LLD learning tracks, browser-based architecture studio, question catalogue, and local persistence are implemented. Curriculum content is being authored progressively. See [Current status](#current-status) for what is available today and what remains planned.

---

## Contents

- [What you can do](#what-you-can-do)
- [Learning tracks](#learning-tracks)
- [HLD Studio workspace](#hld-studio-workspace)
- [Technology stack](#technology-stack)
- [Architecture overview](#architecture-overview)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Data and content authoring](#data-and-content-authoring)
- [Current status](#current-status)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## What you can do

### Learn system design (HLD)

- Follow a structured system-design roadmap, from foundations and requirements to scalable and distributed architectures.
- Study published lessons with reading material, examples, labs, and quizzes where provided.
- Track lesson progress.
- Search the roadmap and expand or collapse learning stages.
- Open the HLD Studio from the learning experience to apply concepts.

### Learn object-oriented and low-level design (LLD)

- Follow a dedicated LLD curriculum, from programming and OOP foundations to object modeling, design principles, patterns, concurrency, testing, and machine-coding case studies.
- Choose Java, C++, or Python for the supported language examples and learning preference.
- Study published lessons and track LLD progress separately from HLD progress.
- Explore a categorized catalogue of 87 LLD practice problems across eight categories.

### Design architectures in the HLD Studio

- Build architecture diagrams on a node-based canvas.
- Add and connect system components.
- Inspect component properties and connection details.
- Work with question-specific requirements and constraints.
- Evaluate supported designs and review requirement-level feedback.
- Save work locally, revisit drafts, and compare saved snapshots.
- Share a design through a generated share link.
- Use keyboard shortcuts for common editing actions.

### Explore the public landing page

The landing page introduces the HLD and LLD learning tracks and includes a conceptual Rate Limiter demonstration connecting architecture-level behavior with code-level logic.

The demonstration is an educational illustration. Its traffic states and capacity values are not production benchmarks.

---

## Learning tracks

### High-Level Design

The HLD roadmap contains **12 top-level stages**, including optional foundational material. The core path is presented as nine focused stages, with foundations available when needed.

Current roadmap data contains:

- 499 lesson topics
- 5 published/available lessons
- 494 planned lesson topics

Planned topics are visible to communicate the intended learning path, but they are not presented as published lessons.

### Low-Level Design

The LLD roadmap contains **12 levels**:

- Level 00: optional programming and computer-science foundations
- Levels 01–11: the core LLD path

Current curriculum data contains:

- 422 lesson topics
- 5 published/available lessons
- 87 practice problems
- 8 practice categories

Java is the primary language of the LLD curriculum design. The application language preference also supports C++ and Python examples where authored and available. A language selector does not imply that every lesson or exercise has equivalent content in every language.

---

## HLD Studio workspace

The architecture workspace is designed around a visual canvas and supporting panels.

Core capabilities include:

- **Canvas:** create, move, select, connect, duplicate, and remove architecture components.
- **Component catalogue:** choose components relevant to the selected design question.
- **Inspector:** view and edit selected component and connection details.
- **Question context:** work against a question brief, functional requirements, non-functional requirements, and constraints.
- **Evaluation:** run the available deterministic evaluators and inspect requirement-level results.
- **Drafts and persistence:** save and restore work using the configured API implementation.
- **Snapshots:** save named versions and compare design changes.
- **Sharing:** create and resolve share links for architecture documents.
- **Interview support:** use the timed interview/session functionality available in the workspace.

Evaluation is question-specific. A question without a registered evaluator can still be explored, but it cannot receive fabricated evaluation results.

---

## Technology stack

| Area | Technology |
|---|---|
| UI | React 19 |
| Language | TypeScript |
| Build tool and dev server | Vite |
| Architecture canvas | `@xyflow/react` |
| Client-side state | Zustand |
| Icons | Lucide React |
| Image export | `html-to-image` |
| Data and content | JSON catalogues and lesson files |
| Validation | AJV, TypeScript, Oxlint |
| Tests | Vitest, Testing Library, jsdom |

---

## Architecture overview

The frontend is organized around feature domains and an API boundary.

### API boundary

The UI and stores depend on the `ApiClient` contract in `src/api/contracts.ts`.

Two implementations are available:

| Mode | Implementation | Data source |
|---|---|---|
| `local` (default) | `LocalApi` | Bundled JSON and browser storage |
| `http` | `HttpApi` | REST API configured through environment variables |

This keeps UI features independent of the underlying persistence and transport implementation.

### Client-side state

Zustand stores are separated by domain rather than combined into one global store. The main domains include:

- Architecture canvas and interview/session state
- HLD learning and progress
- LLD learning progress
- Global preferences and programming-language preference
- Practice drafts and attempts
- Editor session state
- Execution-provider status

### Code execution boundary

The project defines an execution-provider boundary, but the current source does **not** include a configured compiler/runtime service. Code execution should therefore be treated as unavailable until a trusted provider is integrated. The application must not claim that learner code ran or tests passed when no execution provider is configured.

For more detail, see [`docs/STATE-ARCHITECTURE.md`](docs/STATE-ARCHITECTURE.md) and [`docs/API.md`](docs/API.md).

---

## Project structure

```text
.
├── docs/
│   ├── learning-authoring/       # HLD and LLD lesson authoring guides and schemas
│   ├── question-authoring/       # Question/evaluator authoring guides and schemas
│   ├── lld/                      # LLD curriculum and language authoring notes
│   ├── API.md                    # API contract and backend integration
│   ├── openapi.yaml              # REST API specification
│   └── STATE-ARCHITECTURE.md     # Client-side state boundaries
│
├── src/
│   ├── api/                      # ApiClient, local and HTTP implementations
│   ├── app/                      # App shell, route parsing and Studio shell
│   ├── components/
│   │   ├── canvas/               # Architecture canvas
│   │   ├── evaluation/           # Evaluation and metrics UI
│   │   ├── home/                 # Public landing page
│   │   ├── layout/               # Studio panels and workspace layout
│   │   ├── learn/                # HLD/LLD dashboards, lessons and learning UI
│   │   ├── question/             # Question learning panels
│   │   └── ui/                   # Shared UI primitives
│   ├── data/
│   │   ├── questions/            # HLD question specifications and learning data
│   │   └── learning/
│   │       ├── lessons/          # HLD lesson content
│   │       ├── lld/               # LLD roadmap, lessons and practice catalogue
│   │       └── roadmap.json      # HLD roadmap
│   ├── features/
│   │   ├── architecture/         # Architecture document and canvas state
│   │   ├── evaluation/           # Design evaluation rules and metrics
│   │   ├── learning/             # Roadmaps, lessons and progress
│   │   ├── practice/              # Practice drafts and language resolution
│   │   ├── execution/             # Execution provider boundary
│   │   ├── preferences/          # Global preferences
│   │   ├── questions/            # Question loading and registration
│   │   ├── snapshots/            # Snapshot comparison
│   │   └── persistence/          # Local persistence and sharing
│   ├── platform/                 # Platform-level utilities
│   └── tests/                    # Unit, integration and architecture tests
│
├── package.json
├── package-lock.json
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js compatible with the installed Vite/tooling versions (use **Node.js 22.22+** or a current compatible Node 24 release).
- npm.

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Vite prints the local development URL in the terminal (normally `http://localhost:5173`).

### Create a production build

```bash
npm run build
```

### Preview a production build

```bash
npm run preview
```

---

## Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript project builds and create the production bundle |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the production build locally |
| `npm run validate:question -- <file>` | Validate a question specification |
| `npm run validate:lesson -- <file>` | Validate a lesson file |

Vitest and Testing Library are included in the development dependencies, and test files are present under `src/tests/`. The current `package.json` does not define an `npm test` or `npm run test` script. Run tests with the project's configured Vitest command or add a repository test script before documenting `npm test` as available.

---

## Data and content authoring

Most learning and question content is data-driven.

### HLD lessons

- Roadmap: `src/data/learning/roadmap.json`
- Lesson files: `src/data/learning/lessons/<lesson-id>.json`
- Authoring guide: [`docs/learning-authoring/README.md`](docs/learning-authoring/README.md)
- Lesson schema: `docs/learning-authoring/schemas/lesson.schema.json`

### LLD lessons and practice

- Roadmap: `src/data/learning/lld/roadmap.json`
- Lesson files: `src/data/learning/lld/lessons/`
- Practice catalogue: `src/data/learning/lld/practice-catalogue.json`
- Authoring guide: [`docs/learning-authoring/lld/README.md`](docs/learning-authoring/lld/README.md)
- Multi-language authoring: [`docs/lld/MULTI_LANGUAGE_LESSON_AUTHORING.md`](docs/lld/MULTI_LANGUAGE_LESSON_AUTHORING.md)

### HLD questions

- Question specifications: `src/data/questions/<slug>.json`
- Learning extensions: `src/data/questions/<slug>.learning.json`
- Question authoring guide: [`docs/question-authoring/README.md`](docs/question-authoring/README.md)
- Evaluator guide: [`docs/question-authoring/EVALUATOR-GUIDE.md`](docs/question-authoring/EVALUATOR-GUIDE.md)

Use the provided schemas, templates, and validation scripts when adding or changing content. Keep planned curriculum entries separate from published lesson content.

---

## Current status

The following reflects the uploaded project source and package manifest, not a promise that every planned capability is complete.

| Area | Current state |
|---|---|
| Public landing page | Implemented, including conceptual HLD/LLD Rate Limiter demonstration and macro-to-micro journey |
| HLD architecture workspace | Implemented |
| HLD learning roadmap | Implemented; 5 lessons currently marked available in the roadmap |
| LLD learning roadmap | Implemented; 5 lessons currently marked available in the roadmap |
| LLD language preference | Java, C++, and Python options are present; per-exercise language support depends on authored metadata |
| LLD practice catalogue | 87 problems across 8 categories are catalogued |
| Local persistence | Implemented through the local API/browser storage path |
| HTTP API adapter | Implemented against the documented API contract; requires a compatible backend to be deployed and configured |
| Design evaluation | Deterministic, question-specific evaluators are present for supported questions |
| Code execution | Provider interface exists; no configured runtime/compiler service is included in this source |
| Authentication/account sync | Not represented as a completed end-user feature in the current frontend source |
| Automated test command | Test files and Vitest dependencies exist; no test script is currently declared in `package.json` |

### HLD question catalogue

The current bundled question specifications include:

- URL Shortener
- Rate Limiter
- Voting / Poll System

Each question's learning material and evaluator support should be checked in its corresponding data and feature files.

---

## Roadmap

The project is under active development. The broad direction is to:

- Expand and review the HLD and LLD lesson content.
- Add more complete examples, labs, quizzes, and practice solutions.
- Expand the system-design question and evaluator catalogue.
- Improve the practice/editor workflow and language-specific exercise coverage.
- Integrate a trusted execution provider before enabling real code execution.
- Connect the HTTP API adapter to a deployed backend when account-backed persistence is introduced.
- Continue improving accessibility, responsive behavior, and the learning experience.

Only features that are implemented and verified should be moved from planned to available in the product.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/API.md`](docs/API.md) | API contract and backend integration |
| [`docs/openapi.yaml`](docs/openapi.yaml) | OpenAPI specification |
| [`docs/STATE-ARCHITECTURE.md`](docs/STATE-ARCHITECTURE.md) | State domains, language resolution, and execution boundary |
| [`docs/learning-authoring/README.md`](docs/learning-authoring/README.md) | HLD lesson authoring |
| [`docs/learning-authoring/lld/README.md`](docs/learning-authoring/lld/README.md) | LLD lesson authoring |
| [`docs/question-authoring/README.md`](docs/question-authoring/README.md) | HLD question authoring |
| [`docs/question-authoring/EVALUATOR-GUIDE.md`](docs/question-authoring/EVALUATOR-GUIDE.md) | Design evaluator development |
| [`docs/lld/MULTI_LANGUAGE_LESSON_AUTHORING.md`](docs/lld/MULTI_LANGUAGE_LESSON_AUTHORING.md) | Multi-language lesson content conventions |

---

## Contributing

Contributions and feedback are welcome.

Before opening a pull request:

1. Keep changes focused and preserve existing HLD/LLD progress and saved-work compatibility.
2. Validate changed question and lesson JSON files with the provided validation scripts.
3. Run linting and a production build.
4. Add or update tests for behavior changes.
5. Update the relevant authoring or architecture documentation when changing data contracts or feature boundaries.

For substantial changes, describe the user problem, the intended behavior, and any migration or compatibility impact.

---

## License

No license is specified in the current project files. Add a `LICENSE` file before describing the repository as open source or granting reuse rights.
