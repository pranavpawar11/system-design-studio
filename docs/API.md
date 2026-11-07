# HLD Studio: back-end API contract

The front end talks to a back end through one interface, `ApiClient` (`src/api/contracts.ts`).
Two implementations exist:

| Mode | Class | Data lives in | Use |
|---|---|---|---|
| `local` (default) | `LocalApi` | Browser storage + bundled JSON | Development, demos, offline |
| `http` | `HttpApi` | Your server | Production |

Nothing outside `src/api/` reads storage, bundled question data or calls `fetch`.
`src/tests/architecture.test.ts` enforces this, so swapping the back end cannot break the UI.

## Switching to a real back end

1. Build the endpoints below (see `openapi.yaml` for exact schemas).
2. Set `VITE_API_MODE=http` and `VITE_API_BASE_URL=https://your-host/api/v1` (see `.env.example`).
3. Have your server serve the app's `index.html` for `/s/*` so share links open the app.
4. Provide a token: `HttpApi` sends `Authorization: Bearer <token>` using the value in `localStorage["hld-studio:token"]`.
   Replace `getToken` in `src/api/index.ts` to integrate your auth library.
5. Run the contract tests against your server: `src/tests/api.test.ts` runs identical scenarios against
   `LocalApi` and `HttpApi`. Point `HttpApi` at a staging URL in that file to verify your implementation.

`src/api/testing/mockServer.ts` is a complete in-memory implementation of this contract and a worked example.

## Endpoints

Base path: `/api/v1`. JSON in and out. Timestamps are ISO 8601 UTC.

| Method and path | Purpose | Success | Failure |
|---|---|---|---|
| `GET /questions` | List questions (`QuestionSummary[]`) | 200 | |
| `GET /questions/{id}` | Full question spec (`QuestionSpec`) | 200 | 404 |
| `GET /questions/{id}/learning` | Follow-ups, reference designs, revision advice | 200 | 404 |
| `GET /questions/{id}/draft` | The signed-in learner's in-progress work | 200 `Draft` | 404 none saved, 422 saved draft is invalid |
| `PUT /questions/{id}/draft` | Save progress (called after every edit, debounced 700 ms) | 204 | 400/422 invalid design, 401 |
| `DELETE /questions/{id}/draft` | Discard the draft | 204 | |
| `GET /questions/{id}/snapshots` | List saved versions | 200 `Snapshot[]` | |
| `POST /questions/{id}/snapshots` | Body `{name, doc}`; returns the stored `Snapshot` | 201 | 409 limit of 20 reached, 422 invalid design |
| `DELETE /questions/{id}/snapshots/{snapshotId}` | Delete one version | 204 | |
| `GET /questions/{id}/interview` | Current or last timed session | 200 `Interview` | 404 none |
| `PUT /questions/{id}/interview` | Body `Interview` | 204 | |
| `DELETE /questions/{id}/interview` | Clear the session | 204 | |
| `POST /questions/{id}/evaluations` | Body `{doc, workload?}`; returns `EvaluationReport` | 200 | 422 design cannot be evaluated |
| `POST /questions/{id}/shares` | Body `{doc}`; returns `{id, path}` where path is `/s/{id}` | 201 | 413 too large, 422 invalid |
| `GET /shares/{id}` | Returns `{questionId, doc}` | 200 | 404 |

### Errors

Return `application/problem+json`: `{ "status": 422, "code": "VALIDATION_FAILED", "message": "…", "details": ["…"] }`.
`message` is shown to the learner, so write it as a sentence that says what to do next.

Codes the UI understands: `NOT_FOUND`, `VALIDATION_FAILED`, `UNAUTHORIZED`, `RATE_LIMITED`, `SERVER_ERROR`.
The client adds `NETWORK_ERROR` and `TIMEOUT` itself.

### Server-side validation (do not trust the client)

Re-run the rules in `validateDocument` (`src/features/architecture/architecture.utils.ts`) on every design received:
`schemaVersion` is 1; `questionId` matches; node and edge IDs are unique; every `componentId` is in the question's
`allowedComponentIds`; every edge endpoint exists and its connection type is supported and compatible with both
components' operations. Reject designs over a sensible size (the client already caps share links at about 60 KB).

### Evaluation

`POST /evaluations` must return the same `EvaluationReport` shape the UI renders
(`src/features/evaluation/evaluation.types.ts`): `findings`, `requirements` (each with `status` of `pass`, `fail` or
`not-evaluated`, plus `evidenceNodeIds`), and `limitations`. The rules are deterministic and documented in the
question spec's `evaluation` section. A server may port them as they are, or extend them.
Capacity, latency and learning-summary calculations still run in the browser; they are pure functions of the design
and can move behind the API later without changing the UI.

### Ownership and concurrency

Drafts, snapshots and interviews belong to the authenticated learner and the question. `PUT` is last-write-wins.
If you need conflict detection, add an `ETag` header; the client does not yet send `If-Match`.

## Data shapes

TypeScript is the source of truth: `src/api/contracts.ts` and the types it re-exports.
`docs/openapi.yaml` mirrors them for tooling.
