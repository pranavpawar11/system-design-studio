# HLD Studio state architecture

## Principles

- Use Zustand for interactive client-side domain state.
- Keep domain stores separate; do not create a single application-wide mega-store.
- Keep business rules in pure TypeScript services.
- Keep persistence behind repository/storage interfaces.
- Treat server-owned data and execution as API concerns, not permanent Zustand state.
- Do not claim code execution is available until a trusted execution provider is configured.

## Domains

| Domain | Owns | Persistence |
|---|---|---|
| Preferences | Global language and UI preferences | Versioned device storage today; account sync can replace the adapter later |
| HLD architecture | Canvas document, selection, undo/redo, interview session | Existing API/session persistence |
| HLD learning | Roadmap and learning events | Existing API |
| LLD learning | Lesson and quiz completion | Existing LLD progress adapter; migration is a separate compatibility task |
| Practice | Selected exercise, exercise-local language override, code files, drafts, attempts | Versioned practice repository |
| Editor | Active file, cursor and focus state | Ephemeral only; code content belongs to Practice |
| Execution | Run status/result/error | Ephemeral; provider performs actual execution |

## Language precedence

`exercise override -> supported global preference -> supported exercise default -> first supported language -> platform default`

An exercise override is stored with that exercise's draft/progress record. It never mutates the global preference.

Exercise metadata is authoritative for language availability. Legacy catalogue records with `language: "Java"` remain Java-only until C++/Python starter code and solution variants are authored. The platform must not advertise a language merely because the global preference supports it.

## Execution boundary

`ExecutionProvider` is the only integration point for running code. A trusted server-backed provider must be registered at bootstrap. The current project source does not contain a compiler/runtime service or execution API, so the default state is explicitly unavailable. The UI/application must not fabricate stdout, test results, or success.

A provider must enforce execution time, memory, network and filesystem limits server-side. Never execute untrusted learner code directly in the browser application server or expose provider secrets to the client.

## Compatibility

- `features/learning/programming-language.ts` remains a backwards-compatible facade over Preferences.
- Existing `architecture.store.ts`, `learn.store.ts`, and LLD progress behavior are not merged or reset.
- Practice state uses a separate versioned key: `hld-studio:practice-state:v1`.
- Global preference migration continues to read the previous language-only key.
