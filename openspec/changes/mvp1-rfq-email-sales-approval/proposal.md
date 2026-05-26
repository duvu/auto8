## Why

The project currently has no application code or working quote workflow. We need a thin but complete MVP that proves the core business path from an inbound RFQ email to a sales-approved draft quote, so implementation can start against a clear end-to-end contract.

## What Changes

- Bootstrap the public `auto8` application as a TypeScript monorepo using Next.js for the sales UI and NestJS with Prisma for the backend.
- Add an MVP1 workflow that captures RFQ details received by email, stores them in the system, and creates a quote request record.
- Add a draft quote flow so internal users can review RFQ data, create a draft quote, and keep it in a pending approval state until sales approval.
- Add a sales approval flow so only approved draft quotes can move to the final approved state, with status history visible in the system.
- Provide one runnable end-to-end path with seeded/demo data and local development setup so the workflow can be verified from intake through approval.

## Capabilities

### New Capabilities
- `email-rfq-quote-approval`: End-to-end handling of RFQ email intake, draft quote creation, and sales approval for MVP1.

### Modified Capabilities
- None.

## Impact

- New application code for a Next.js frontend, NestJS backend, Prisma schema and migrations, and shared TypeScript contracts.
- New persistence for RFQs, quote drafts, approval states, users, and audit timestamps.
- New local developer workflows for bootstrapping, seeding, and running the MVP end to end.
- Assumes the intended public repository name is `auto8`, matching the current workspace.
