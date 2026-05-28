## 1. Service Layer Cleanup

- [x] 1.- [x] 1.1 Extract `updateWorkflowState(tx, rfqId, state)` private helper in `rfqs.service.ts` and replace all 4 inline `tx.rfq.update workflowState` calls
- [x] 1.- [x] 1.2 Extract `recordStatusEvent(tx, quoteId, status, actorId?)` private helper in `rfqs.service.ts` and replace all 3 inline `quoteStatusEvent.create` calls
- [x] 1.- [x] 1.3 Remove unused `rfq: true` from the `include` in `submitForApproval`
- [x] 1.- [x] 1.4 Remove redundant `?? null` coercions on Slack intake fields in `createRfqFromIntake` (Prisma accepts `undefined` directly)
- [x] 1.- [x] 1.5 Collapse `optionalString` and `normalizeOptionalEmail` to single-expression one-liners

## 2. Controller Split

- [x] 2.1 Create `apps/api/src/quotes/quotes.controller.ts` with `@Controller("quotes")` containing `submitQuote` and `approveQuote` handlers (move from `rfqs.controller.ts`)
- [x] 2.2 Create `apps/api/src/quotes/quotes.module.ts` and register `QuotesController` and `RfqsService`
- [x] 2.3 Register `QuotesModule` in `apps/api/src/app.module.ts`
- [x] 2.4 Remove `submitQuote` and `approveQuote` handlers from `rfqs.controller.ts` and add `@Controller("rfqs")` prefix decorator

## 3. Web API Client Fix

- [x] 3.1 Update `apps/web/lib/api.ts` `request()` to set `Content-Type: application/json` only when `init?.body` is defined
- [x] 3.2 Remove `body: JSON.stringify({})` from `submitQuote` and `approveQuote` in `apps/web/lib/api.ts`

## 4. Shared Web Utility

- [x] 4.1 Create `apps/web/lib/format.ts` exporting `formatState(value: string): string`
- [x] 4.2 Replace `formatWorkflowState` in `apps/web/app/page.tsx` with import of `formatState` from `apps/web/lib/format.ts`
- [x] 4.3 Replace `formatState` local function in `apps/web/app/rfqs/[rfqId]/page.tsx` with import from `apps/web/lib/format.ts`

## 5. Schema Tightening

- [x] 5.1 Change `rawPayload String?` to `rawPayload String` in `apps/api/prisma/schema.prisma`
- [x] 5.2 Run `npm run db:generate` to regenerate Prisma client

## 6. Verification

- [x] 6.1 Run `npm run typecheck` — all workspaces pass
- [x] 6.2 Run `npm run test` — all 6 tests pass
- [x] 6.3 Run `npm run build` — full workspace builds clean
