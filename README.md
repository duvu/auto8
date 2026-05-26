# auto8

`auto8` is the MVP1 workflow for turning an inbound RFQ email into a draft quote and a sales-approved quote.

## Stack

- `Next.js` app in `apps/web` for the internal sales workspace
- `NestJS` app in `apps/api` for the RFQ and quote workflow API
- `Prisma + SQLite` for local persistence and seed/demo data
- `TypeScript` npm workspaces with shared contracts in `packages/shared`

## MVP1 Workflow

1. Submit a normalized RFQ email payload.
2. Review the RFQ in the queue.
3. Create or update a draft quote with line items.
4. Submit the quote for approval.
5. Approve the quote as a sales user.

## Seeded Demo Users

- Quote operator: `operator@auto8.dev`
- Sales approver: `sales@auto8.dev`

The UI provides a lightweight acting-user switcher instead of production auth so the approval handoff can be demoed locally.

## Local Setup

1. Install dependencies:
   `npm install`
2. Copy environment files if you want to reset them:
   `cp apps/api/.env.example apps/api/.env`
   `cp apps/web/.env.example apps/web/.env.local`
3. Create the local database and seed demo data:
   `npm run db:migrate`
   `npm run db:seed`
4. Start both apps:
   `npm run dev`

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`

Database files live under `apps/api/prisma/` and are ignored by git.

## Useful Commands

- `npm run dev`: build shared contracts once, then start API and web together
- `npm run build`: build shared contracts, NestJS API, and Next.js app
- `npm run test`: run the API integration + happy-path end-to-end test suite
- `npm run typecheck`: run TypeScript checks across all workspaces
- `npm run db:migrate`: apply Prisma migrations to the local SQLite database
- `npm run db:seed`: reset demo records through the Prisma seed script

## Repository Layout

- `apps/api`: NestJS API, Prisma schema, migrations, seed data, tests
- `apps/web`: Next.js sales workspace for RFQ intake and approval flow
- `packages/shared`: shared types and constants used by both apps
- `openspec`: change proposal, design, specs, and task tracking

## Test Coverage

The current automated suite verifies:

- RFQ email intake creates a new RFQ
- Draft quote persistence with line items
- Submit-for-approval state transition
- Sales-only approval enforcement
- Happy-path end-to-end flow from intake to approved quote
