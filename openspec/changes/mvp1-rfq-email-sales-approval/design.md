## Context

The repository is currently an OpenSpec scaffold with no application code, database schema, or delivery pipeline. MVP1 needs to establish the first runnable product slice and the initial repository structure at the same time.

The workflow spans multiple concerns: inbound RFQ intake, internal quote drafting, approval authorization, persistent state management, and a browser UI for sales operations. The user already constrained the implementation stack to TypeScript, NestJS, Prisma, and Next.js.

## Goals / Non-Goals

**Goals:**
- Deliver one locally runnable end-to-end workflow from RFQ email intake to sales-approved quote.
- Establish the initial monorepo structure for web, API, database, and shared types.
- Persist RFQs, quote drafts, quote line items, and approval state transitions in Prisma.
- Enforce that only sales users can approve a draft quote.
- Make the workflow easy to demo with seeded users and sample RFQ data.

**Non-Goals:**
- Production-grade authentication and SSO.
- Automated outbound quote email delivery to customers.
- OCR, attachment parsing, or ERP/CRM integration.
- Complex pricing engines, taxes, multi-currency, or discount approval chains.
- Real mailbox provider lock-in for MVP1; provider-specific adapters can follow after the normalized intake contract exists.

## Decisions

### 1. Monorepo structure
Use a TypeScript monorepo with `apps/web` for Next.js, `apps/api` for NestJS, and `packages/shared` for DTOs and domain constants.

Why:
- Keeps frontend and backend aligned on request/response contracts.
- Matches the requested stack without introducing extra workspace complexity beyond MVP1.

Alternatives considered:
- Separate repositories for web and API: rejected because it slows initial delivery and duplicates setup.
- Single Next.js app with API routes: rejected because the user explicitly asked for NestJS.

### 2. Normalized RFQ email intake boundary
Model the inbound email as a normalized API contract handled by NestJS. The backend will store the raw email metadata and create an RFQ record from it. A dev/test path can submit the same payload directly without requiring a live mail provider.

Why:
- Preserves the business entry point as an email RFQ.
- Allows local end-to-end verification before choosing a production inbox provider.

Alternatives considered:
- Direct IMAP polling: rejected as too operationally heavy for MVP1.
- Hard-coding one inbound email vendor now: rejected because the business workflow matters more than vendor selection at this stage.

### 3. Simple relational domain model with explicit workflow states
Use Prisma models for `User`, `Rfq`, `RfqEmail`, `Quote`, `QuoteLineItem`, and `QuoteStatusEvent`. A quote moves through `draft`, `pending_approval`, and `approved` states; RFQ list screens derive their current workflow state from the linked quote state.

Why:
- Keeps workflow rules explicit and easy to validate.
- Status events provide the audit trail requested in the proposal without requiring event sourcing.

Alternatives considered:
- A single table with JSON payloads: rejected because approval and line-item updates need relational constraints.
- Full workflow engine: rejected as unnecessary for a first slice.

### 4. Role enforcement through seeded internal users
Seed at least two internal users: a quote operator and a sales approver. MVP1 will use a lightweight login or user-switch mechanism suitable for local demos, while the API enforces role checks server-side.

Why:
- Satisfies the approval authorization requirement without blocking on external identity setup.

Alternatives considered:
- Clerk/Auth.js/enterprise SSO: rejected for MVP1 due to setup cost.
- No roles at all: rejected because the core workflow requires sales approval separation.

### 5. REST API and server-rendered sales workspace
Expose REST endpoints from NestJS for intake, RFQ listing/detail, draft quote save, submission for approval, and approval actions. Next.js will provide the internal workflow UI with list/detail screens and quote edit forms.

Why:
- Clear separation of responsibilities.
- Easy to test through API integration tests and UI happy-path tests.

Alternatives considered:
- GraphQL: rejected because the domain is still small and REST is faster to bootstrap.

## Risks / Trade-offs

- [Simulated inbound email in local development may differ from production email providers] -> Mitigation: define a stable normalized intake DTO and keep provider mapping at the edge.
- [Lightweight demo auth is not production ready] -> Mitigation: keep authorization checks in NestJS services so the auth adapter can be replaced later.
- [One quote record per RFQ limits revision modeling] -> Mitigation: accept this for MVP1 and add quote versioning only if revision history becomes a real requirement.
- [Bootstrapping web, API, and database together increases first-change scope] -> Mitigation: keep the product slice narrow and validate with one happy-path workflow only.

## Migration Plan

1. Initialize the monorepo, package manager workspace, shared TypeScript config, and environment templates.
2. Create the NestJS API, Prisma schema, initial migration, and seed data.
3. Build the Next.js sales workspace and connect it to the API.
4. Add demo intake and approval flow tests.
5. Publish the repository as a public GitHub repo once the MVP scaffold is in place.

Rollback for early development is straightforward: revert the change, drop the local database, and remove the GitHub repository if publication has already occurred.

## Open Questions

- Which inbound email provider should be integrated first after the normalized intake path is working?
- Does the business need approval comments or rejection handling in MVP1, or is approve-only sufficient?
- Should approved quotes receive a formal customer-facing quote number immediately, or can the internal record ID serve as the initial reference?
