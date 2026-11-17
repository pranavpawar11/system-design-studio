# Writing a lesson

The Learn section is a **roadmap** of lessons. Each lesson is one JSON file. Progress, quizzes and labs are
handled for you; you write the teaching.

## What a lesson contains

| Part | Required | What the learner gets |
|---|---|---|
| Header (`id`, `title`, `summary`, `minutes`) | Yes | The lesson card, breadcrumb and time estimate |
| `blocks` | Yes (3+) | The reading: headings, paragraphs, lists, callouts, worked examples, formulas |
| `lab` | No | A live experiment: sliders and switches, instant results, a chart, a plain-words explanation, tasks |
| `quiz` | No (recommended) | A short check with an explanation for every answer |
| `practice` | No | Buttons that open Studio questions that practise this lesson |

## Files

| File | Location | Notes |
|---|---|---|
| Lesson | `src/data/learning/lessons/<id>.json` | Template: `templates/lesson.template.json` (commented: `.jsonc`). Editor schema: `schemas/lesson.schema.json` |
| Roadmap | `src/data/learning/roadmap.json` | One node per lesson. The map is already filled in with every planned topic. |
| Tests | none to write | `npm test` checks every lesson and the roadmap automatically |

## Add a lesson in five steps

```bash
# 1. Copy the template. The file name is the lesson id, and it must match a node already on the roadmap.
cp docs/learning-authoring/templates/lesson.template.json src/data/learning/lessons/cache-aside.json

# 2. Write it. Search for TODO. Check as you go (add --publish at the end).
npm run validate:lesson -- src/data/learning/lessons/cache-aside.json

# 3. Switch the roadmap node on. Find the node in roadmap.json and change it to:
#    { "id": "cache-aside", "title": "Cache-aside", "kind": "lesson", "status": "ready", "minutes": 12, "hasLab": true, "hasQuiz": true }
#    The group and topic above it switch to "ready" automatically in the app, but set them in the file too.

# 4. Strict check.
npm run validate:lesson -- src/data/learning/lessons/cache-aside.json --publish

# 5. Full suite. It re-checks every lesson, every lab and the roadmap.
npm test
```

The three flags on the roadmap node (`hasLab`, `hasQuiz`, `minutes`) must match the lesson. The linter tells you if they do not.

## The roadmap

Three levels: **topic** (the main spine) → **group** (2 to 3 sub-points) → **lesson** (2 to 3 leaves).
Ids are unique across the whole file. A node is `ready` once its lesson exists and `planned` before that.
Planned lessons appear on the map as "Coming soon" and **do not count** toward anyone's progress.

Nothing is locked. Learners can open any ready lesson in any order. The app suggests a next step but never forces one.

## Completion rules

A lesson is **complete** when the learner has done everything it asks:

| The lesson has | Complete when |
|---|---|
| a lab and a quiz | the lab tasks are all done **and** the quiz is passed |
| only a quiz | the quiz is passed |
| only a lab | the lab tasks are all done |
| neither | the learner presses "Mark as read" |

The "next up" suggestion continues a lesson the learner has started; otherwise it points to the unfinished lesson that **follows the one they touched last**, so finishing a lesson leads onward instead of back to the top of the map. It is a suggestion only.

Reading alone never completes a lesson that has a lab or quiz. A group or topic shows **Done** only when
nothing in it remains, including lessons still planned. If everything written so far is finished but more is coming, it says
**All available done**.

## Blocks

| Block | Fields | Use it for |
|---|---|---|
| `heading` | `text`, `level` 2 or 3 | Sections. Learners scan by headings. |
| `paragraph` | `text` | Explanation. Keep each under about 700 characters. |
| `list` | `items[]`, `ordered?` | Steps or parallel points. |
| `callout` | `tone` info/tip/warning, `title?`, `text` | One thing the learner must not miss. |
| `example` | `title`, `text` | A worked case **with numbers**. Aim for one in every lesson. |
| `formula` | `expression`, `caption?`, `variables[]?` | The core relationship, then name each variable. |

In any text, `**bold**` and `` `code` `` are supported. Nothing else is: HTML is shown as plain text, so a lesson cannot inject markup.

## Labs

A lab turns the lesson's idea into something the learner can move. Everything is data: you write formulas, not code.

```
inputs   what the learner controls     slider (min, max, step, default) or toggle (0 or 1)
derived  formulas, evaluated in order  may use inputs and EARLIER formulas; "output": true shows a result tile
narrative the headline in words        the FIRST message whose "when" is true; finish with "when": "true"
notes    extra insights                every note whose "when" is true is listed
sweep    a chart                       vary one slider across its range and plot one result
scenarios one-click situations         "Cache fails", "Traffic grows 5 times"
tasks    goals                         each has a "check" formula; ticked when achieved and stay ticked
```

### The formula language

Numbers, names, `+ - * /`, comparisons `< <= > >= == !=`, `&& || !`, parentheses, `true`/`false`,
and `min max abs round ceil floor pow sqrt log2`. Comparisons give 1 or 0. Division by zero shows "—". That is all:
there is no way to run other code.

Insert live values in narrative text with `{name}`; the value is formatted with that item's `format` and `unit`.

### Good labs

1. **One idea.** A lab that teaches three things teaches none of them.
2. **Show the number that matters** as a result tile, and say what it means in words in `narrative`.
3. **Make the bad case reachable.** Let the learner break it (traffic too high, component down) and read why. Failure teaches more than success.
4. **Round at boundaries.** If a task or message compares to a limit, round the value first: `round(x * 1000) / 1000`. Floating-point arithmetic would otherwise flip a message at exactly 100%.
5. **Every task must be possible.** The linter tries a grid of settings and fails the lesson if a task can never be completed.
6. **Start healthy.** The default settings should show a working system, then the learner pushes it.
7. **Insert each value once, with its unit.** `{lostRequests}` is shown as "25,500 requests", so write "about {lostRequests} fail", never "{lostRequests} requests fail". The linter warns when a unit is repeated.
8. **Plan for the extreme settings.** A slider can usually be dragged to a state where something is zero (all servers down). Give that state its own first narrative message, and expect the affected results to show "—". Results are never infinite.
9. **Match the text.** If the lesson says "90% hit ratio means 1,000 reads", the lab at those settings must show 1,000. The existing tests do this for the Caching lab; copy the pattern.

## Quizzes

- 3 questions; `passScore` 0.66 means 2 right. Learners can retry as often as they like.
- Test **understanding**, not recall of a definition. "What happens when…" beats "What is…".
- Every wrong option should be something a real person would believe.
- Keep the options **about the same length**. The linter warns when the right answer is conspicuously longer.
- Every question needs an `explanation` of at least a sentence: why it is right, and why the tempting answer is wrong.

## A shape that works

1. One sentence of definition in plain words.
2. **Why it exists**: the problem before the solution.
3. A worked example with numbers.
4. The formula or rule, with each variable named.
5. A callout for the common mistake or failure.
6. The lab (move the numbers, see the consequence).
7. The quiz.

Aim for 8 to 15 minutes. If it is longer, split it into two lessons on the roadmap.

## Progress and the back end

Progress is stored as a list of events (`lesson_viewed`, `lesson_read`, `lab_completed`, `quiz_passed`).
Completion is calculated from the list every time, never stored as a number, so it cannot drift out of step with the roadmap.
Content and progress go through the same swappable API layer as the Studio: see `docs/API.md`, section "Learning".
Locally they live in browser storage; with a real back end they are per learner.

## What the tests check for every lesson

Schema · every formula parses and every name exists · a formula never uses a value defined after it ·
narrative text only mentions real values · sliders have a valid range and default · every task is reachable ·
every quiz answer is one of its options · the roadmap node exists, is `ready`, and its flags and minutes match ·
Studio practice ids exist · no `TODO` in publish mode.
