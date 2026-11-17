# Question drafts

Work on a new question here. Files in this folder are **not** loaded by the app.

1. Copy `docs/question-authoring/templates/question.template.json` to `question-drafts/<slug>.json`
   and `learning.template.json` to `question-drafts/<slug>.learning.json`.
2. Check as you go: `npm run validate:question -- question-drafts/<slug>.json`
3. When it passes `--publish`, move both files to `src/data/questions/`. The app finds them automatically.

See `docs/question-authoring/README.md`.
