# auto8

`auto8` is the MVP workflow for turning an inbound RFQ from email or Slack into a draft quote and a sales-approved quote.

## Stack

- `Next.js` app in `apps/web` for the internal sales workspace
- `NestJS` app in `apps/api` for the RFQ and quote workflow API
- `Prisma + SQLite` for local persistence and seed/demo data
- `TypeScript` npm workspaces with shared contracts in `packages/shared`

## MVP1 Workflow

1. Submit a normalized RFQ from email or Slack.
2. Review the RFQ in the queue.
3. Create or update a draft quote with line items.
4. Submit the quote for approval.
5. Approve the quote as a sales user.

## Seeded Demo Users

- Quote operator: `operator@auto8.dev`
- Sales approver: `sales@auto8.dev`

The UI provides a lightweight acting-user switcher instead of production auth so the approval handoff can be demoed locally.

Seed data includes both email-origin RFQs and one Slack-origin RFQ so the source-aware workflow can be reviewed immediately after seeding.

## Local Setup

1. Install dependencies:
   `npm install`
2. Copy environment files if you want to reset them:
   `cp apps/api/.env.example apps/api/.env`
   `cp apps/web/.env.example apps/web/.env.local`
3. Configure the optional Slack connector values in `apps/api/.env` if you want to exercise signed Slack intake:
   `SLACK_SIGNING_SECRET`
   `SLACK_ALLOWED_WORKSPACE_IDS`
4. Create the local database and seed demo data:
   `npm run db:migrate`
   `npm run db:seed`
5. Start both apps:
   `npm run dev`

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`

Database files live under `apps/api/prisma/` and are ignored by git.

## Slack Connector Notes

- Slack intake uses `POST /api/rfqs/intake-slack`.
- Requests must include `x-slack-request-timestamp` and `x-slack-signature` headers signed with `SLACK_SIGNING_SECRET`.
- If `SLACK_ALLOWED_WORKSPACE_IDS` is set, Auto8 only accepts Slack RFQs from those workspace IDs.
- The seeded Slack RFQ and the automated API suite provide the fastest way to verify source-aware behavior locally.

## Useful Commands

- `npm run dev`: build shared contracts once, then start API and web together
- `npm run build`: build shared contracts, NestJS API, and Next.js app
- `npm run test`: run the API integration + happy-path end-to-end test suite
- `npm run typecheck`: run TypeScript checks across all workspaces
- `npm run db:migrate`: apply Prisma migrations to the local SQLite database
- `npm run db:seed`: reset demo records through the Prisma seed script

## Repository Layout

- `apps/api`: NestJS API, source-aware RFQ intake schema, migrations, seed data, tests
- `apps/web`: Next.js sales workspace for RFQ intake and approval flow
- `packages/shared`: shared types and constants used by both apps
- `openspec`: change proposal, design, specs, and task tracking

## Test Coverage

The current automated suite verifies:

- RFQ email intake still creates a new RFQ
- Verified Slack intake creates a new RFQ with source provenance
- Draft quote persistence with line items
- Submit-for-approval state transition
- Sales-only approval enforcement
- Happy-path end-to-end flow from Slack intake to approved quote
