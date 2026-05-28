## Context

The auto8 API and web app have been built through two feature iterations (MVP1 email intake, then Slack intake). The codebase works correctly but has accumulated duplication and inconsistencies: copy-pasted transaction blocks in the service layer, a mixed-concern controller, inconsistent HTTP semantics in the web API client, and a duplicated utility function across two Next.js pages.

This design covers purely internal refactoring. No external API shape changes, no DB migrations with data movement, and no new user-facing behavior.

## Goals / Non-Goals

**Goals:**
- Eliminate copy-pasted `rfq.update workflowState` and `quoteStatusEvent.create` blocks in `rfqs.service.ts`
- Split the mixed `RfqsController` into `RfqsController` and `QuotesController` with proper route prefixes
- Fix HTTP semantics in `apps/web/lib/api.ts` (Content-Type on GET, empty body on action POSTs)
- Deduplicate `formatState`/`formatWorkflowState` into a shared web utility
- Remove dead code: unused `rfq: true` include, redundant `?? null` coercions
- Collapse verbose one-liner helpers to appropriate brevity
- Tighten `rawPayload` nullability in schema to match code invariant

**Non-Goals:**
- Merging `RfqIntake` and `Rfq` models into one (too disruptive, schema migration required)
- Eliminating the `workflowState` denormalization on `Rfq` (requires deeper rethink of query patterns)
- Re-exporting Prisma enums from shared (requires coordinated change across both apps)
- Adding stable `id`-based React keys to draft line items (requires state shape change)
- Fixing the `rfq.count()` race condition for reference generation (requires DB sequence or lock)

## Decisions

**D1: Extract two private service helpers, not a generic state-machine helper**

Options considered:
- A: Generic `transitionState(tx, rfqId, state, quoteId, status, actorId?)` helper
- B: Two focused helpers — `updateWorkflowState(tx, rfqId, state)` and `recordStatusEvent(tx, quoteId, status, actorId?)`

Chose B. Option A creates a helper with optional parameters and mixed concerns. The two operations are logically separate (one touches `Rfq`, the other touches `Quote`) and are sometimes called independently. Two focused helpers are more readable at each call site.

**D2: Split controller by resource, not by file-per-endpoint**

Options considered:
- A: One file per endpoint
- B: One controller per resource (`RfqsController`, `QuotesController`)
- C: Keep single file, just add route prefix

Chose B. NestJS convention is one controller per resource. `QuotesController` will live in `apps/api/src/quotes/` as a new module to match NestJS module organization. The `rfqs.module.ts` will import it, or a new `quotes.module.ts` will be created and registered in `app.module.ts`.

**D3: New `apps/web/lib/format.ts` utility, not a component**

A single exported function `formatState(value: string)` is enough. No class, no namespace. Both pages import it directly.

**D4: Schema `rawPayload` nullability change requires no migration**

SQLite stores the value as a nullable column. Removing `?` from the Prisma schema tightens the TypeScript type (`String` instead of `String?`) and adds an application-layer non-null assertion in generated Prisma client types. The actual column stays the same; no `ALTER TABLE` is needed. The change is type-safety only.

## Risks / Trade-offs

- [Risk: Splitting controller changes import paths for `QuotesController`] → Mitigation: `app.module.ts` is updated in the same PR; tests hit the same HTTP endpoints which don't change
- [Risk: `formatState` shared utility adds a web `lib/` import that didn't exist before] → Low risk: same logic, just a different import path in two components
- [Risk: Removing `rfq: true` from `submitForApproval` include silently breaks if a future change uses `quote.rfq`] → Mitigation: Leave a comment on the include noting only `lineItems` and `rfqId` scalar are used

## Migration Plan

No DB migration required. Changes are applied in a single commit:
1. Service helpers extracted
2. Controller split
3. `api.ts` fixed
4. `format.ts` created, pages updated
5. Schema `rawPayload` nullability updated
6. Prisma client regenerated (`npm run db:generate`)

Rollback: revert the commit. No data impact.

## Open Questions

None — all decisions above are resolved.
