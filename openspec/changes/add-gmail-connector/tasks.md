## 1. Gmail Connector Foundations

- [x] 1.1 Add the Gmail client dependency and connector configuration needed for OAuth refresh-token access from the API
- [x] 1.2 Add a Gmail connector service that exchanges the configured refresh token for an access token and fetches matching mailbox messages
- [x] 1.3 Add safe parsing utilities that map Gmail message headers/body into the existing `IntakeEmailInput` shape used by RFQ email intake

## 2. Persistence And Deduplication

- [x] 2.1 Extend Prisma schema and migration files with Gmail provenance fields needed for duplicate detection and troubleshooting
- [x] 2.2 Persist Gmail message identity during RFQ creation and skip already-imported Gmail messages on repeated syncs
- [x] 2.3 Return a Gmail sync summary that reports imported, skipped, and failed message counts for each sync run

## 3. Trusted Gmail Sync API

- [x] 3.1 Add a protected Gmail sync endpoint that requires a connector secret before running an import
- [x] 3.2 Implement the Gmail sync workflow that fetches matching messages and routes each valid email through the existing `intakeEmail()` path
- [x] 3.3 Reject untrusted or misconfigured Gmail sync attempts without creating RFQs

## 4. Verification And Documentation

- [x] 4.1 Add backend tests for successful Gmail import, duplicate-skip behavior, and rejected untrusted sync requests
- [x] 4.2 Add one integration-style verification that repeated Gmail syncs do not create duplicate RFQs for the same message
- [x] 4.3 Document Gmail connector environment variables, OAuth refresh-token setup, and manual sync execution steps in the README and env examples
