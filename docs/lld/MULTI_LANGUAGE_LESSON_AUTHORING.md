# LLD lesson authoring: shared concepts, language-specific implementation

## Goal

Maintain one canonical lesson per concept. The concept, design reasoning, trade-offs, diagrams, and conceptual assessment are shared. Add language variants only where syntax, runtime behavior, APIs, memory/lifecycle rules, or idiomatic implementation materially differ.

Supported language keys are exactly `java`, `cpp`, and `python`.

## Lesson structure

- `id`, `title`, `summary`, `minutes`, and `blocks` are the shared lesson.
- `quiz` is shared by default. Keep conceptual questions language-neutral.
- `languageVariants` is optional. It is a map keyed by supported language.
- A language variant may contain `summary`, sparse `blockOverrides`, a complete `blocks` replacement, and `implementationNotes`.
- `blockOverrides` is an object whose keys are zero-based indexes into the shared `blocks` array. Only replace blocks whose content genuinely depends on the selected language.
- `blocks` inside a variant replaces the entire shared block list for that language. Prefer `blockOverrides` to avoid duplicating shared content.
- `implementationNotes` uses the same supported lesson block shapes as the lesson renderer (for example a `callout`).

## Authoring sequence

1. Write the learning outcome and concept in language-neutral terms.
2. Explain the problem, mechanics, design consequences, trade-offs, and common mistakes.
3. Add one exercise that tests design reasoning rather than memorization of syntax.
4. Add a shared quiz with stable question and option IDs. Do not change IDs merely because a learner switches languages.
5. Review each supported language and identify only the places where its actual semantics or idioms change the explanation or example.
6. Add a variant for those blocks. If a language needs a distinct lifecycle, ownership, type-system, concurrency, or error-handling explanation, explain that accurately rather than translating syntax mechanically.
7. Add implementation notes for important language-specific caveats that do not fit naturally into a shared block.
8. Run the validator and inspect the lesson in all three language settings.

## Language accuracy rules

- **Java:** describe Java's actual object/reference model, access controls, garbage collection, interfaces, exceptions, and concurrency APIs where relevant.
- **C++:** account for value semantics, pointers/references, RAII, deterministic destruction, move/copy behavior, const-correctness, virtual dispatch, and standard-library idioms where relevant.
- **Python:** account for dynamic typing, object references, conventions rather than Java-style enforced access modifiers, protocols/duck typing, context managers, and Python runtime behavior where relevant.
- Never imply that a feature exists identically in all three languages. Explain the design concept first, then the language-specific realization.
- Code examples must be coherent, idiomatic, and internally consistent. Include required imports/includes and state any relevant language version when it affects correctness.
- Avoid comparing languages in a variant unless the comparison helps explain a real design choice.

## Quiz and progress stability

- Keep conceptual quiz questions shared whenever possible.
- If an exercise requires language syntax or compilation, provide a language-specific exercise variant rather than changing the shared conceptual quiz.
- Preserve lesson IDs, quiz question IDs, and option IDs. The learner's progress must remain attached to the lesson/question identity, not the selected programming language.

## Coverage policy

A lesson may legitimately be shared-only when no language-specific implementation is needed. Do not add empty variants just to claim coverage. A language variant is considered authored only when it contains meaningful content (a summary, a full block list, at least one block override, or at least one implementation note). Mark a lesson fully multilingual only after its language-sensitive content has been reviewed for all three languages.

## Backward compatibility

Legacy lessons without `languageVariants` remain valid and render their shared content. Do not mass-convert placeholder files or mechanically translate Java examples. Migrate a lesson when it is authored or revised; retain its existing ID and progress references.
