## Why

The current MVP only accepts RFQs from email, but sales teams also receive quote requests in Slack. We need a Slack intake connector that brings those requests into the same RFQ queue and approval flow so operators can work consistently regardless of source.

## What Changes

- Add a Slack RFQ intake connector that accepts verified Slack submissions and creates RFQ work items in Auto8.
- Normalize Slack-origin RFQs into the same downstream draft quote and sales approval workflow already used for email-origin RFQs.
- Persist Slack source metadata needed for auditability and troubleshooting, including workspace, channel, submitter, and raw inbound payload.
- Refactor intake contracts, persistence, and UI presentation so RFQs can be identified by source without creating separate quote-handling behavior.
- Add automated verification and local setup guidance for the Slack connector alongside the existing email path.

## Capabilities

### New Capabilities
- `slack-rfq-intake`: Accept RFQ submissions from Slack and route them into the existing RFQ, draft quote, and sales approval workflow.

### Modified Capabilities
- None.

## Impact

- Prisma schema and migrations for intake-source modeling beyond email-only records.
- NestJS API endpoints and services for Slack request verification and RFQ creation.
- Shared TypeScript contracts and Next.js sales workspace views so source metadata is visible while workflow behavior stays consistent.
- Environment configuration, tests, seed/demo data, and developer documentation for Slack connector setup.
