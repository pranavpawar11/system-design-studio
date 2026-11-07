# HLD Studio

Practice high-level system design on an interactive canvas with deterministic, explainable feedback.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 130+ tests (logic, API contract, UI, accessibility)
npm run build
```

## Talking to a back end

The app depends on one interface, `ApiClient` (`src/api/contracts.ts`). Two implementations ship:

- `LocalApi`: browser storage and bundled questions. Default. No server needed.
- `HttpApi`: REST. Set `VITE_API_MODE=http` and `VITE_API_BASE_URL` (see `.env.example`).

The endpoint contract is in `docs/API.md` and `docs/openapi.yaml`. `src/tests/api.test.ts` runs the same scenarios
against both implementations, and `src/tests/architecture.test.ts` guarantees nothing outside `src/api/`
touches storage, bundled data or `fetch`.

## Layout

```
src/api/            contracts, LocalApi, HttpApi, mock REST server, session loader
src/features/       pure domain logic: architecture, evaluation, learning, snapshots
src/components/     UI (canvas, layout, question, evaluation, ui primitives)
src/data/           bundled question content, read only by src/api/local
docs/               API guide and OpenAPI spec
```
