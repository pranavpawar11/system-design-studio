# Writing an evaluator

An evaluator turns a learner's diagram into a report. It is one TypeScript function per question.
Start from `templates/evaluator.template.ts`. For a real, small example read
`src/features/evaluation/rateLimiterEvaluator.ts`.

```ts
(spec: QuestionSpec, doc: ArchitectureDocument, peakRps?: number) => EvaluationReport
```

## The report

| Part | Meaning |
|---|---|
| `requirements[]` | One entry per requirement id in your question file: `{ requirementId, status, findingIds, evidenceNodeIds }` |
| `status` | `pass` (Met) · `fail` (Not met) · `not-evaluated` (Unverified) |
| `findings[]` | The explanations: `{ id, ruleId, severity, requirementId?, title, explanation, suggestion?, nodeIds, edgeIds }` |
| `severity` | `error` (broken or missing), `warning` (works but risky), `info` (a remark), `not-evaluated` (cannot be checked) |
| `evidenceNodeIds` | The components that prove a pass. Clicking the requirement highlights them on the canvas. |
| `limitations[]` | Plain sentences about what these checks cannot know. Always include them. |

**Every requirement id in the question file must appear exactly once in `requirements`.**
(The template test shows how to assert this.)

## Three rules that keep feedback trustworthy

1. **Pass only what the diagram proves.** A component being present is not proof. Check the connection and the capability.
2. **Fail only what the diagram disproves**, and always say what to do next: `suggestion: 'Connect X to Y with a Database Write edge.'`
3. **Never guess about behaviour.** If a requirement is about application logic ("returns 404", "retries three times"),
   make the learner declare it in a component setting (`OPERATIONS-AND-CONFIG.md`, "Declaration settings") and
   return `not-evaluated` until they do. A learner who sees "Unverified" and a next step learns more than one who sees a false green.

Write findings like a coach: a short title that states the problem ("Requests can bypass the limiter"),
one sentence of explanation, one concrete next step.

## Five patterns that cover most requirements

| Pattern | Example requirement | How to check | In the template |
|---|---|---|---|
| **Path** | "Every request is checked first" | Search the graph from the clients over *valid* edges. To prove "cannot be bypassed", search again with that component removed. | FR-01 |
| **Capability** | "Data is stored durably" | Find an edge of the right type from the right component to a target whose `config.durable` is true. | FR-02 |
| **Declaration** | "Unknown codes return 404" | Read a setting; `undeclared` means `not-evaluated`. | FR-03 |
| **Capacity** | "Handle 10,000 req/s" | Compare `instances × capacityPerInstanceRps` (or a store's capacity) with the load. Say the figure is modeled. | NFR-01 |
| **Consistency** | "Counts agree across servers" | Several instances **and** no shared store ⇒ fail; a shared store, or a single instance ⇒ pass. | see Rate Limiter |

Helpers you will use in nearly every evaluator are already in the template: a structural check (duplicate ids, unsupported
components, invalid connections), `valid` edges only, `has(node, operation)`, `reachableFromClients()`, `targetsOf(node, edgeType)`.

## Register it

In `src/features/evaluation/evaluator.ts`:

```ts
const EVALUATORS: Record<string, EvaluatorFn> = {
  'hld-url-shortener-001': evaluateUrlShortener,
  'hld-rate-limiter-001': (spec, doc, w) => evaluateRateLimiter(spec, doc, w.peakRedirectRps),
  'hld-your-topic-001': (spec, doc, w) => evaluateYourTopic(spec, doc, w.peakRedirectRps),   // ← your line
};
```

The key is `question.id` from your JSON. Until you add it, Validate reports every requirement as **Unverified** with the note
"No automatic checks for this question yet", and the linter warns (an error in `--publish` mode).

## Test it (required)

Create `src/tests/<slug>.test.ts`. The shape that works:

```ts
import solved from './fixtures/<slug>-solved.json';           // your reference design, saved as a fixture
const status = (doc, id) => evaluate(spec, doc).requirements.find((r) => r.requirementId === id)?.status;

it('the reference design meets every requirement', () => {
  expect(evaluate(spec, solved).requirements.every((r) => r.status === 'pass')).toBe(true);
});
it('FR-02 fails when the write edge is removed', () => {
  const d = structuredClone(solved); d.edges = d.edges.filter((e) => e.connectionTypeId !== 'EDGE-DB-WRITE');
  expect(status(d, 'FR-02')).toBe('fail');
});
it('FR-03 stays unverified until declared', () => { /* undeclared → 'not-evaluated' */ });
```

Cover, for each requirement: the passing case, the failing case, and the "not enough information" case.
The `evaluatorTestCases` section of the URL shortener file is a good list of cases to start from.
The reference designs in your learning file are also checked by the linter.

## Optional extras (not data-driven yet)

| Feature | If you skip it | If you want it |
|---|---|---|
| **What-if capacity model** (Metrics tab) | The tab says "No capacity model yet" and Validate still works. | Write an `analyze…` function like `rlCapacity.ts` and add one branch in `MetricsPanel.tsx`. |
| **Tailored "next step" guidance** (Inspector) | A generic, accurate prompt is shown. | Add a branch in `nextAction()` in `RightInspector.tsx`. |
| **Worked-out capacity figures** (Question tab) | Inputs are listed without derived numbers. | Add a small block in `Capacity()` in `LeftSidebar.tsx`. |

None of these blocks a release. Moving them into the question file is on the roadmap (a declarative rule format), which would
remove most evaluator code for simple questions.

## Common mistakes

- Counting an **invalid** edge as evidence. Always filter with `checkConnection`.
- Passing "a database exists" without checking the app can reach it.
- Treating a **cycle** as an error. Distributed designs legitimately contain them.
- Failing a learner for a **different valid design**. Test with a second, unlike design before releasing.
- Forgetting a requirement id, so it never appears in the report.
- Showing a capacity number without saying it is modeled.
