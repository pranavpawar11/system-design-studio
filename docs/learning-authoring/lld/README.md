# LLD Learning Track — Authoring Guide

## Scope
This is an additive LLD curriculum package. It does not replace or modify the existing HLD roadmap, HLD lesson files, Learn UI, Studio, question engine, or routing.

## Structure
- `src/data/learning/lld/roadmap.json`: 12-level LLD topic tree.
- `src/data/learning/lld/lessons/<lesson-id>.json`: one schema-compatible starter file per lesson topic.
- `src/data/learning/lld/practice-catalogue.json`: separate categorized practice library.
- `docs/learning-authoring/lld/README.md`: this guide.

## Learning path
- Level 00 is optional Foundations and should be collapsed by default when the LLD track is presented.
- Levels 01–11 form the Core LLD path.
- All foundation topics remain available for search and self-assessment.
- Java is the primary implementation language. Keep underlying design concepts language-independent where possible.

## Lesson authoring rules
1. Fill one topic at a time; do not bulk-publish placeholder files.
2. Use simple explanations first, then technical detail, then Java examples.
3. Include UML only when it clarifies structure or interactions.
4. Explain trade-offs and common misuse, not only definitions.
5. Add a lab when a concept benefits from experimentation.
6. Add a quiz with plausible distractors and explanations.
7. Link relevant practice problems instead of duplicating full problem statements inside lessons.
8. Validate lesson files against the existing `docs/learning-authoring/schemas/lesson.schema.json`.

## Practice problem deliverables
Each problem should eventually include:
- Clarified functional requirements and assumptions
- Core entities, value objects and responsibilities
- Class diagram
- Sequence diagrams for important use cases
- Runnable Java implementation
- Unit tests and edge cases
- Design-pattern and SOLID rationale
- Trade-offs and at least one change-request extension

## Important integration note
This package is data-only. The current Learn UI and loader are HLD-oriented. A later integration step must add explicit LLD track selection/loading and preserve the HLD route and data unchanged. Do not simply replace `src/data/learning/roadmap.json`.
