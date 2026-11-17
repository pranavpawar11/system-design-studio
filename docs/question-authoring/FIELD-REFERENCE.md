# Field reference

Legend: **Req** = required for the app to run · **Rec** = required by `--publish` · **Opt** = optional.
"Shown" says where a learner sees it. "Not shown yet" means the app stores or ignores it today. Authors should still write it,
because it is the record the evaluator and the learning file are built from.

## Question file: `<slug>.json`

### `question` (Req)

| Field | Type | Req | Where it is used |
|---|---|---|---|
| `id` | string `hld-<slug>-<nnn>` | Req | Storage keys, share links, API paths, evaluator registration. Never change it. |
| `version` | integer ≥ 1 | Req | Stamped into saved designs; reference designs should match. |
| `slug` | string | Req | File name. |
| `title` | string, 5 to 80 chars | Req | Question picker, Question tab, summaries. |
| `difficulty` | `easy` \| `medium` \| `hard` | Req | Pill in the top bar and Question tab; picker is sorted easy → hard. The older `beginner` / `intermediate` / `advanced` still load and are converted. |
| `estimatedMinutes` | integer 15 to 120 | Rec | Question tab ("~45 min"). Default interview length when it is 20, 30, 45 or 60; otherwise 45. |
| `learningObjectives` | string[] (3 to 8) | Rec | Question tab → The problem → What you will practise. |
| `subtitle`, `category`, `tags`, `prerequisites`, `relatedQuestions`, `status` | | Opt | Not shown yet. Fill them in; a catalogue page will use them. |

### `presentation` (Rec)

| Field | Type | Where |
|---|---|---|
| `problemStatement.full` | string | Shown. Falls back to `short` if missing. Write it as the interviewer would say it. Do not reveal the solution. |
| `problemStatement.short` | string | Shown only if `full` is empty. |
| `scope.inScope` / `scope.outOfScope` | string[] (3+ / 2+) | Shown as "In scope" and "Out of scope". |
| `scope.optionalExtensions`, `problemStatement.learnerTask` | string[] | Not shown yet. |

### `requirements` (Req): `functional[]` and `nonFunctional[]`, at least one of each

| Field | Type | Where |
|---|---|---|
| `id` | `FR-01` / `NFR-01` (optional prefix) | Links the requirement to evaluator output, summary and revision advice. Unique across both lists. |
| `title` | string, 4 to 90 chars | **Shown to learners** in plain language: "Create a short URL", not "FR-01". Grouped as *What the system must do* and *How well it must do it*. |
| `priority` | `must` \| `should` \| `could` | Not shown yet. |
| `target` | object | Read **only where your evaluator reads it**. Today: `target.value` for the latency goals. Shape is yours. |
| `description`, `acceptanceCriteria`, `requiredCapabilities`, `evaluationRuleIds`, `measurementMethod`, `limitations`, `category`, `relatedApiIds`, `relatedMetricIds` | | Not shown yet. They document how to evaluate. |

### `assumptions` (Rec)

`[{ id, description, defaultValue?, configurable?, affects? }]`. `description` is shown under Assumptions. The rest is not shown yet.

### `capacityEstimation` (Req)

| Field | Where |
|---|---|
| `defaultInputs[]`: `{ id, name, value:number, unit, configurable }` | Shown **read-only** in Question → Capacity estimates. Learners cannot edit it. Worked-out figures appear only for questions whose code computes them (URL shortener, Rate Limiter); for any other question you will see the inputs only. |
| `calculations[]`, `formulaAssumptions[]` | Documentation. **Formulas in JSON are not executed.** Implement the arithmetic in code if you want results displayed. |

### `componentCatalogue` (Req)

| Field | Type | Notes |
|---|---|---|
| `allowedComponentIds` | string[] | Exactly the ids defined in `components`. |
| `components[].id` | `COMP-UPPER-CASE` | |
| `components[].type` | `lower-case-with-dashes` | Reuse existing types where possible. |
| `components[].category` | one of the 8 categories | **Set it.** Controls library group, node colour, default icon. |
| `components[].displayName` | string ≤ 40 | Library and canvas. |
| `components[].responsibilities` | string[] (1+) | First line is the library description; all are shown in the inspector. |
| `components[].supportedOperations` | string[] (1+) | What it can do. Connection rules match on these: `OPERATIONS-AND-CONFIG.md`. |
| `components[].defaultConfig` | object of number / string / true-false | Starting settings, editable in the inspector, saved with the design. |
| `components[].configSchema` | object | Optional validation per key: `type`, `minimum`, `maximum`, `exclusiveMinimum`, `enum`. |

### `connectionTypes` (Req, 1+)

`{ id, name, semantics, compatibleSourceOperations[], compatibleTargetOperations[] }`.
`name` is the edge label on the canvas; `semantics` is the sentence shown in the inspector.
Rule: a line is allowed only if the source supports one source operation and the target supports one target operation.

### `hints` (Req; 5 recommended)

`{ id, level (1, 2, 3 … strictly increasing), text }`. Revealed one at a time and counted in the learning summary.
Level 1 asks a question. Level 5 almost describes the shape of the answer. `type` and `relatedConcepts` are not shown yet.

### Authoring-record sections (Opt, not read by the app)

`evaluation` (rules, scoring) · `metrics` · `failureScenarios` · `apiDesign` · `dataModel` · `solutionExplanation` ·
`evaluatorTestCases` · `progression` · `referenceSolutions` · `followUpQuestions`.
Keep them: they are how you decide what the evaluator must do and what the tests must cover.
The last two are superseded by the learning file for what learners see.

## Learning file: `<slug>.learning.json`

### `followUpQuestions[]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `FU-01`, unique. |
| `difficulty` | `easy` \| `medium` \| `hard` | Shown beside the question. |
| `category` | string | Free text. |
| `prompt` | string | Ask "why" more than "what". |
| `expectedAnswerPoints` | string[] (2+) | The learner **ticks these themselves** after answering. Write each as one honest, checkable idea. |

### `referenceSolutions[]`

| Field | Notes |
|---|---|
| `id`, `name`, `difficulty` | `REF-01`; difficulty is easy / medium / hard. |
| `architecture` | A real diagram in the Export format: `{ schemaVersion: 1, questionId, questionVersion, nodes[], edges[] }`. Must obey the question's own connection rules. The linter checks. |
| `flows[]` | `{ name, steps[] }`: the story of one request, in words. |
| `strengths`, `limitations`, `tradeoffs` | Be honest. A reference may fail a requirement if `limitations` says so (the URL shortener's minimal design does). |

Reference designs are hidden until the learner asks, compared with their design by component type, and can be loaded onto the canvas.

### `revisionRecommendations[]`

`{ requirementIds[], text }`. Shown in the learning summary under "Worth revising" when **any** listed requirement is not met.
Every id must exist in the question file.

## A node and an edge in a design

```json
{ "id": "app", "componentId": "COMP-APP-SERVER", "componentType": "application-server", "name": "Application Server",
  "position": { "x": 660, "y": 160 }, "config": { "instances": 4, "capacityPerInstanceRps": 3000 } }
{ "id": "e3", "source": "app", "target": "db", "connectionTypeId": "EDGE-DB-WRITE" }
```
`componentType` must equal the component's `type`; `config` should include every key you want the evaluator to see.
