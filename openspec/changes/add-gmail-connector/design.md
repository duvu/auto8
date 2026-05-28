## Context

Auto8 already has a normalized email intake path and a source-aware RFQ workflow, but email-origin RFQs only arrive when another caller posts a normalized payload to `POST /api/rfqs/intake-email`. There is no built-in integration with Gmail, so teams using a shared Gmail inbox still need an external bridge or manual copy/paste step before work appears in Auto8.

This change adds a Gmail connector without changing downstream workflow behavior. Gmail-imported messages should become ordinary email-origin RFQs so the queue, detail view, draft quote flow, and approval flow remain unchanged.

## Goals / Non-Goals

**Goals:**
- Connect Auto8 to one configured Gmail mailbox for MVP.
- Import Gmail messages that match a configured RFQ search into the existing email intake workflow.
- Prevent duplicate RFQ creation when the same Gmail message is encountered across multiple sync runs.
- Keep Gmail-specific concerns at the connector boundary and preserve the current RFQ/quote workflow.
- Support local verification with explicit connector configuration and deterministic automated tests.

**Non-Goals:**
- Full Gmail OAuth installation UI or multi-tenant mailbox onboarding.
- Gmail push notifications, Pub/Sub watch setup, or background worker orchestration in MVP.
- Attachment parsing, rich HTML rendering, inline image extraction, or thread-aware message grouping.
- Sending approval results or any other outbound updates back to Gmail.

## Decisions

### 1. Use a pull-based Gmail sync endpoint instead of background watch infrastructure
Expose a trusted internal endpoint that performs one Gmail sync run on demand. The endpoint will fetch matching messages from Gmail, import unseen RFQ emails, and return a sync summary.

Why:
- Fits the current MVP architecture with a single NestJS API process and no background job system.
- Easier to test locally and in CI than Pub/Sub watch callbacks.
- Keeps operational setup narrow while still proving end-to-end Gmail ingestion.

Alternatives considered:
- Gmail watch + Pub/Sub push delivery: rejected because it adds cloud infrastructure and lifecycle complexity before the connector behavior is proven.
- Cron inside the web app: rejected because connector logic belongs in the API and should not depend on browser execution.

### 2. Reuse the existing `intakeEmail()` workflow as the normalization boundary
The Gmail connector will parse Gmail message data into the existing `IntakeEmailInput` shape and call the same email intake service path already used by the demo form and tests.

Why:
- Preserves the current email-origin workflow semantics.
- Avoids creating a second email RFQ creation path that could drift from the existing logic.
- Keeps Gmail as an edge adapter rather than a new business workflow.

Alternatives considered:
- Create Gmail-specific RFQ creation methods: rejected because Gmail messages are still just email-origin RFQs.
- Expand `sourceType` with `gmail`: rejected because Gmail is an email provider, not a new operator-facing workflow source in MVP.

### 3. Persist Gmail provenance and sync state in dedicated intake metadata fields
Extend `RfqIntake` with Gmail-specific optional fields such as Gmail message ID, thread ID, and mailbox label/query context, and add a small connector state record for the last completed sync cursor if needed by the chosen Gmail listing strategy.

Why:
- Deduplication requires a stable external identifier.
- Operators and developers need basic provenance for debugging imported messages.
- Keeping Gmail metadata alongside intake records avoids a separate cross-reference table for this small MVP.

Alternatives considered:
- Store Gmail identifiers only inside `rawPayload`: rejected because duplicate detection must be queryable.
- Add a separate `GmailImport` model for every message: rejected because the first connector can stay simpler by enriching `RfqIntake` directly.

### 4. Authenticate to Gmail with configured OAuth client credentials plus refresh token
Use server-side Google OAuth credentials from environment variables to obtain access tokens and call the Gmail REST API for one mailbox.

Why:
- This is the minimal durable server-to-server pattern for a single mailbox where the account owner has already granted consent.
- Avoids interactive OAuth flows in the product UI.

Alternatives considered:
- IMAP with app passwords: rejected because it is weaker operationally and less aligned with modern Gmail access.
- Storing a short-lived access token manually: rejected because it is not maintainable.

### 5. Protect manual Gmail sync with an internal connector secret
Require a dedicated secret header for the Gmail sync endpoint so only trusted callers can trigger imports.

Why:
- Prevents anonymous public triggering of Gmail reads.
- Matches the current MVP style of lightweight but explicit connector trust boundaries.

Alternatives considered:
- No protection because the endpoint only reads Gmail: rejected because it still causes state-changing imports.
- Reusing `x-user-id`: rejected because connector triggering is infrastructure trust, not operator identity.

## Risks / Trade-offs

- [Gmail message formats vary between plain text and HTML] -> Mitigation: support plain text first and fall back to a safe text extraction path from Gmail payload parts.
- [Repeated syncs can create duplicates if message identity is not persisted correctly] -> Mitigation: make Gmail message ID unique in persistence and skip already-imported messages.
- [OAuth refresh-token setup is operationally heavier than the current email demo flow] -> Mitigation: document the minimal env vars and keep the endpoint manual rather than fully automated in MVP.
- [Large mailboxes may produce too many matches in one sync] -> Mitigation: scope the connector to a configured search query and bounded page size for MVP.

## Migration Plan

1. Extend persistence with Gmail provenance fields and any required connector sync state.
2. Add Gmail client/configuration support in the API.
3. Implement a protected Gmail sync endpoint that fetches matching Gmail messages and maps them into `intakeEmail()`.
4. Add duplicate protection, tests, and seed-free connector verification coverage.
5. Document Gmail OAuth refresh-token setup and manual sync execution steps.

Rollback during development is straightforward: remove the Gmail connector code, revert schema changes, and reset the local database.

## Open Questions

- Should the MVP search query be entirely env-configured, or should the sync endpoint accept an optional override for local demos?
- Do we want to store the Gmail snippet separately from the normalized subject/body for troubleshooting?
- Is a sync summary response enough for operators, or do we eventually want a lightweight connector status view in the web app?
