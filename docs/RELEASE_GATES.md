# Release Gates

Run this sequence before every commit, PR merge, or deployment. All gates must pass.

## Gate Sequence

```bash
npm run typecheck        # TypeScript strict-mode across all three workspaces
npm run build            # Full monorepo production build
npm run verify:contracts # 40 cross-layer contract drift checks
```

Tests require a live database; skip on CI without one, or run against a test schema:

```bash
npm run test             # Unit tests (src/**/*.spec.ts) — no DB required
                         # E2E tests (test/**/*.spec.ts) — require DATABASE_URL
```

## What Each Gate Covers

| Gate | What it catches |
|---|---|
| `typecheck` | TypeScript errors, missing imports, wrong return types across all workspaces |
| `build` | Next.js page compilation, NestJS build, shared package compilation |
| `verify:contracts` | Prisma enum drift, missing CONNECTOR_FIELD_DEFS, duplicate shared interfaces in app code, NestJS module structure violations |
| Unit tests | ConnectorRegistryService behavior, PortalService token lifecycle, workspace isolation, CONNECTOR_FIELD_DEFS completeness |

## Known Pre-Existing Failures

The E2E test suite (`test/api.e2e.spec.ts`, `test/mvp1-flow.e2e.spec.ts`) requires `DATABASE_URL` pointing to a clean schema and will fail in environments without one. These are pre-existing and unrelated to contract drift.

## Adding New Checks

- New Prisma enum → add value to `packages/shared/src/index.ts`, re-run `npm run db:generate`, then `verify:contracts` will catch drift automatically.
- New connector type → add to `CONNECTOR_TYPES`, `CONNECTOR_FIELD_DEFS`, backend registry routing, and frontend form. `verify:contracts` checks all four layers.
- New shared interface → declare in `packages/shared/src/index.ts`, add to banned-duplicates list in `tools/contract-checks/index.ts`.
