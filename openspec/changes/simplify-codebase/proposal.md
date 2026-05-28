## Why

The codebase has grown through two feature iterations and accumulated duplicated logic, inconsistent patterns, and over-verbose code that makes future changes harder to reason about. Simplifying now — before adding more features — reduces maintenance cost and reduces the surface area for bugs.

## What Changes

- **Extract private helpers** in `rfqs.service.ts` to eliminate copy-pasted `rfq.update workflowState` and `quoteStatusEvent.create` blocks repeated across 3–4 methods
- **Remove dead code** from `rfqs.service.ts`: unused `rfq: true` include in `submitForApproval`, redundant `?? null` coercions on Slack intake fields
- **Split the controller** into `RfqsController` and `QuotesController` with proper route prefix decorators, removing prefix repetition in every handler
- **Extract a shared web utility** `apps/web/lib/format.ts` to deduplicate the identical `formatState`/`formatWorkflowState` functions across two Next.js pages
- **Fix `api.ts`** to only set `Content-Type: application/json` when a body is present, and remove pointless `body: JSON.stringify({})` from `submitQuote` and `approveQuote`
- **Consolidate private helpers** `optionalString` and `normalizeOptionalEmail` to single-expression one-liners
- **Mark `rawPayload` as required** in the Prisma schema (remove `?`) to match the actual code invariant

## Capabilities

### New Capabilities
- `quote-controller`: Separate NestJS controller for quote endpoints (`/api/quotes/:quoteId/submit`, `/api/quotes/:quoteId/approve`) with `@Controller("quotes")` prefix

### Modified Capabilities
- `rfq-intake`: Internal refactor only — same external API, no requirement changes

## Impact

- `apps/api/src/rfqs/rfqs.service.ts`: private helper extraction, dead code removal, one-liner helpers
- `apps/api/src/rfqs/rfqs.controller.ts`: split into two controller files
- `apps/api/src/rfqs/rfqs.module.ts`: register new `QuotesController`
- `apps/web/lib/api.ts`: conditional `Content-Type`, remove empty body
- `apps/web/lib/format.ts`: new shared utility file
- `apps/web/app/page.tsx`: use shared `formatState`
- `apps/web/app/rfqs/[rfqId]/page.tsx`: use shared `formatState`
- `apps/api/prisma/schema.prisma`: `rawPayload String?` → `rawPayload String`
- No external API changes; no migration required (no schema data-type change, only nullability tightening which SQLite enforces at the application layer already)
