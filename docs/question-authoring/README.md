# Adding a question to HLD Studio

Start here. A question is **two data files, one small piece of code, and zero registration lines.**

| # | File | Where | Required? | What it holds | Template | Schema |
|---|---|---|---|---|---|---|
| 1 | **Question file** | `src/data/questions/<slug>.json` | **Yes** | The brief, requirements, capacity numbers, the components learners can drag, the connection rules, hints | `templates/question.template.json` (commented: `.jsonc`) | `schemas/question.schema.json` |
| 2 | **Learning file** | `src/data/questions/<slug>.learning.json` | **Yes to publish** | Follow-up questions, worked reference designs, revision advice | `templates/learning.template.json` (commented: `.jsonc`) | `schemas/learning.schema.json` |
| 3 | **Evaluator** | `src/features/evaluation/<name>Evaluator.ts` + one line in `evaluator.ts` | **Yes to be judged** | The rules that decide Met / Not met / Unverified | `templates/evaluator.template.ts` | n/a (TypeScript) |
| 4 | **Tests** | `src/tests/<slug>.test.ts` | **Yes** | A solved design that passes; a broken design per requirement | pattern in `EVALUATOR-GUIDE.md` | n/a |
| 5 | Extensions file | `src/data/questions/<slug>.extensions.json` | **No, legacy** | Extra components added after a question shipped | none | n/a |

Question files are found automatically. Nothing else needs editing to make a question appear in the picker.
Without an evaluator the question still loads, but **Validate marks every requirement "not evaluated"**
(it never borrows another question's rules).

The extensions file exists only because the URL shortener's component list was widened after its first release.
**New questions put everything in the question file.**

## What is data and what is code

| Data (JSON, no programming) | Code (TypeScript, once per question) |
|---|---|
| Brief, scope, objectives, assumptions | The rules that check a design against each requirement |
| Requirements and their wording | Optional: a "what-if" capacity model for the Metrics tab |
| Components, their settings and limits | Optional: tailored "next step" guidance |
| Which connections are allowed | |
| Hints, follow-ups, reference designs | |

Everything a learner **reads** is data. Everything that **judges** their diagram is code, because deciding whether a path
through a diagram satisfies a requirement is logic, not a field. If you only fill in the JSON, learners can still
build and share designs, but they will not get automatic feedback. See `EVALUATOR-GUIDE.md`.

## Quick start

```bash
# 1. Copy the templates into the drafts folder (the app ignores this folder)
cp docs/question-authoring/templates/question.template.json question-drafts/my-topic.json
cp docs/question-authoring/templates/learning.template.json question-drafts/my-topic.learning.json

# 2. Fill them in. Search for TODO. Check as you go; it explains each problem in plain language.
npm run validate:question -- question-drafts/my-topic.json

# 3. Write the evaluator from templates/evaluator.template.ts, register it, write tests.

# 4. Strict check before release (needs no TODO, 5 hints, 3 follow-ups, an evaluator ...)
npm run validate:question -- question-drafts/my-topic.json --publish

# 5. Release: move both files into src/data/questions/ and run the full suite.
mv question-drafts/my-topic*.json src/data/questions/ && npm test
```

`npm test` also lints **every** question in `src/data/questions`, so a broken file fails the build.

## Naming rules

| Thing | Pattern | Example | Notes |
|---|---|---|---|
| Question id | `hld-<slug>-<3 digits>` | `hld-pastebin-001` | **Permanent.** It keys saved work, share links and the evaluator. |
| Slug and file name | `lower-case-with-dashes` | `pastebin` | `pastebin.json`, `pastebin.learning.json` |
| Requirement id | `FR-01`, `NFR-01` | `FR-03` | Add a prefix only if ids could clash: `RL-FR-01` |
| Component id | `COMP-UPPER-CASE` | `COMP-OBJECT-STORAGE` | Reuse an existing id for the same idea. |
| Component type | `lower-case-with-dashes` | `object-storage` | Reuse existing types so icons and colours carry over. |
| Connection id | `EDGE-UPPER-CASE` | `EDGE-BLOB-WRITE` | |
| Hint, follow-up, reference | `HINT-01`, `FU-01`, `REF-01` | | Unique within the question. |

## When to change `version`

Increase `question.version` when a change would make a learner's saved design wrong: a component removed, an operation
renamed, a requirement added or removed. Fixing a typo or adding a hint does not need it. Reference designs carry the same
version number (the linter warns if they drift).

## Can the original `url-shortener.json` be the example?

**Yes. It is the best example there is, and it works in the app exactly as written.** (Verified: dropping it in unchanged,
the app loads and every test passes; the linter reports no errors.)

How to read it as a model:

| Section of the original | Does the app read it? | Use it as an example of |
|---|---|---|
| `question`, `requirements`, `capacityEstimation`, `componentCatalogue`, `connectionTypes`, `hints` | **Yes, all of it** | The required core. Copy the structure. |
| `presentation`, `assumptions`, `question.learningObjectives` | **Yes** (Question tab → The problem) | Good brief-writing: realistic, no solution leaked. |
| `evaluation`, `metrics`, `failureScenarios`, `apiDesign`, `dataModel`, `solutionExplanation`, `evaluatorTestCases`, `progression` | **No, authoring record** | How to think before coding: write the rules and the test cases first, then implement them. |
| `referenceSolutions`, `followUpQuestions` | **No.** They are descriptions. | The app reads the *learning file* instead, where reference designs are real diagrams. |

Three differences to know about when copying from it:

1. **Its reference solutions list component names; the learning file needs full diagrams** (nodes and edges). See `learning.template.jsonc`.
2. **Some URL-shortener operations are question-specific** (`url-validation`, `short-code-generation`, `mapping-lookup`). Do not copy them into an unrelated question. Use `templates/catalogue-library.json` for generic ones.
3. **Its component list was extended later** by `url-shortener.extensions.json` (WAF, read replica, analytics store, behaviour settings). That is why the extensions file exists. Do not copy that pattern.

The second worked example is `rate-limiter.json` (+ `.learning.json`): a smaller, cleaner file that follows the current conventions
(components carry `category`, behaviour settings live in the main file, no extensions). **For new questions, copy the Rate Limiter's
shape and the URL shortener's depth.**

## Where to read next

| Document | Read it when |
|---|---|
| `FIELD-REFERENCE.md` | You want to know what every field is, its type, whether it is required, and where it appears |
| `OPERATIONS-AND-CONFIG.md` | You are defining components and connections (the words that must match) |
| `EVALUATOR-GUIDE.md` | You are writing the rules |
| `DIFFICULTY-AND-CATALOG.md` | You are choosing easy / medium / hard, or picking the next question |
| `templates/PUBLISH-CHECKLIST.md` | You are about to release |
