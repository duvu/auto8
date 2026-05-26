## Why

Auto8 currently accepts email RFQs only when another system or the demo UI submits a normalized email payload directly to the API. Teams that live in Gmail still need a manual bridge outside Auto8, so we need a first-party Gmail connector that imports RFQ emails from a configured mailbox into the existing workflow.

## What Changes

- Add a Gmail connector that authenticates to one configured Gmail mailbox and imports matching RFQ emails into Auto8.
- Reuse the existing email intake path so Gmail-imported messages create standard email-origin RFQs and follow the current draft and approval workflow unchanged.
- Persist Gmail message identifiers and sync state needed to prevent duplicate RFQ creation across repeated sync runs.
- Add a trusted Gmail sync trigger, connector configuration, automated verification, and local setup guidance.
- Keep Gmail connector scope narrow for MVP: one mailbox, one configured search query, no outbound Gmail actions, no attachment parsing, and no real-time Gmail watch setup.

## Capabilities

### New Capabilities
- `gmail-rfq-intake`: Import RFQ emails from a configured Gmail mailbox into the existing RFQ workflow without creating duplicate RFQs on repeated syncs.

### Modified Capabilities
- None.

## Impact

- NestJS API modules, controllers, and services for trusted Gmail sync and Gmail API access.
- Prisma schema and migrations for Gmail message provenance and connector sync state.
- Shared API contracts only where needed for Gmail sync responses or source labeling.
- Environment configuration, tests, and README guidance for Gmail OAuth refresh-token setup and manual sync execution.
