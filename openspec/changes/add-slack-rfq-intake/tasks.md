## 1. Intake Model Refactor

- [x] 1.1 Replace the email-only RFQ intake persistence model with a normalized source-aware intake record that supports both email and Slack
- [x] 1.2 Add the Prisma migration and seed updates needed for source-aware RFQs and Slack demo coverage

## 2. Slack Connector API

- [x] 2.1 Add Slack connector configuration and request verification for a trusted Slack intake endpoint
- [x] 2.2 Implement the Slack intake adapter that maps Slack submissions into the shared RFQ creation workflow
- [x] 2.3 Refactor the existing email intake path to reuse the shared normalized intake service without changing current behavior

## 3. Shared Contracts And Workspace Consistency

- [x] 3.1 Extend shared RFQ list/detail contracts with source type and provenance fields needed by both apps
- [x] 3.2 Update the RFQ queue and detail UI to label Slack-origin RFQs and show Slack context while keeping quote actions unchanged

## 4. Verification And Documentation

- [x] 4.1 Add backend tests for valid Slack intake, rejected untrusted Slack requests, and email-intake regression coverage
- [x] 4.2 Add one happy-path verification from Slack-origin RFQ intake through draft quote and sales approval
- [x] 4.3 Document Slack connector environment setup, local demo steps, and operator expectations alongside the current email workflow
