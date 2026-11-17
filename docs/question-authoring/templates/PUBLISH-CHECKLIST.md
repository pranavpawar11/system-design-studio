# Publish checklist

Run `npm run validate:question -- <file> --publish`, then tick the things a machine cannot check.

## The machine checks
- [ ] Question and learning files pass the schema
- [ ] No duplicate ids; every allowed component is defined; every connection can be drawn by some pair of components
- [ ] Hint levels increase; 5 hints
- [ ] ≥ 3 functional and ≥ 2 non-functional requirements; ≥ 3 follow-ups; ≥ 1 reference design
- [ ] Every reference design obeys the connection rules, and fails a requirement only if its `limitations` say so
- [ ] An evaluator is registered; no `TODO` remains; `estimatedMinutes` fits the difficulty
- [ ] `npm test` passes

## The human checks
- [ ] **Brief**: reads like an interviewer's question; does not leak the solution
- [ ] **Requirements**: each title makes sense to someone who has never heard "FR/NFR"
- [ ] **Numbers**: capacity inputs are realistic and the arithmetic is right (check by hand once)
- [ ] **Components**: nothing in the library hands the answer away; nothing needed is missing
- [ ] **Hints**: each is more specific than the last; none gives the answer outright before level 5
- [ ] **Evaluator**: a second, *different* valid design also passes (you are not grading similarity)
- [ ] **Evaluator**: anything a diagram cannot prove is a declaration setting, not a guess
- [ ] **Reference designs**: strengths, limitations and trade-offs are honest
- [ ] **Follow-ups**: expected points are ideas a learner can honestly tick
- [ ] **Difficulty**: matches `DIFFICULTY-AND-CATALOG.md`; two people piloted it
- [ ] **Version**: `question.version` bumped if saved designs would now be wrong
