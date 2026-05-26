## 1. Workspace Bootstrap

- [x] 1.1 Initialize the TypeScript monorepo structure with `apps/web`, `apps/api`, and `packages/shared`
- [x] 1.2 Add core Next.js, NestJS, Prisma, and workspace tooling dependencies plus environment templates
- [x] 1.3 Add the baseline repository files needed for public publishing and local developer onboarding

## 2. Data Model And API

- [x] 2.1 Model `User`, `RfqEmail`, `Rfq`, `Quote`, `QuoteLineItem`, and `QuoteStatusEvent` in Prisma and generate the initial migration
- [x] 2.2 Add seed data for a quote operator, a sales approver, and sample RFQ intake records
- [x] 2.3 Implement the RFQ email intake endpoint and service that stores inbound email data and creates RFQ records
- [x] 2.4 Implement draft quote create and update endpoints with line item persistence
- [x] 2.5 Implement submit-for-approval, sales-only approval, and workflow history query endpoints

## 3. Sales Workspace

- [x] 3.1 Build the lightweight internal user selection flow for seeded roles
- [x] 3.2 Build the RFQ list and detail views showing intake data and current workflow state
- [x] 3.3 Build the draft quote editor for quote fields and line items
- [x] 3.4 Build the approval action and status history UI for pending and approved quotes

## 4. Verification And Demo Path

- [x] 4.1 Add backend tests for RFQ intake, draft persistence, submission, and approval authorization
- [x] 4.2 Add one happy-path end-to-end test from sample RFQ intake to approved quote
- [x] 4.3 Document local setup, database seed, and demo steps for running the workflow end to end

## 5. Repository Publication

- [ ] 5.1 Create the public GitHub repository `auto8` and push the MVP scaffold
- [ ] 5.2 Verify the published project can be cloned, bootstrapped, and run through the MVP1 happy path
