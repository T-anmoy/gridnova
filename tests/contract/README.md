# Contract snapshot

`openapi.json` is a copy of the backend's `docs/api/openapi.json`
(`grid-nova-ai-backend`). `tests/unit/contract-drift.test.ts` checks the shared
test fixtures — the request bodies the app sends and the replies its tests feed
it — against this file, and checks that every `/api/v1/...` path the app calls
exists in it. If the backend changes a shape, the fixture (or the app) is
updated until the test passes; if the backend changed on purpose, refresh the
snapshot first.

## Refresh

```bash
cp ../grid-nova-ai-backend/docs/api/openapi.json tests/contract/openapi.json
npx vitest run tests/unit/contract-drift.test.ts
```

Commit the new `openapi.json` together with any fixture/app change it forces.

Where the OpenAPI document has no response schema (FastAPI routes without a
`response_model` publish `{}`), the fixtures are validated against the app's own
zod schemas in `lib/dashboard/schemas.ts` instead — see the test for which.
