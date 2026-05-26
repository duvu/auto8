## Context

The current Auto8 MVP persists RFQs as email-origin records and assumes every intake item has email-specific sender, subject, and body fields. That works for the existing workflow, but it makes Slack intake awkward because the system has no source-aware abstraction for inbound RFQs.

This change needs to add Slack as a second intake channel without creating a separate downstream workflow. Quote operators and sales approvers should continue to use the same RFQ queue, detail view, draft quote editor, and approval actions regardless of whether the RFQ started in email or Slack.

## Goals / Non-Goals

**Goals:**
- Accept verified RFQ submissions from Slack and create RFQ work items in Auto8.
- Preserve one consistent downstream workflow for email-origin and Slack-origin RFQs.
- Persist enough Slack source metadata for auditability, debugging, and UI visibility.
- Refactor the intake model and shared contracts so future channels can reuse the same normalized boundary.

**Non-Goals:**
- Sales approval actions executed directly from Slack.
- Two-way Slack sync, threaded replies, or outbound notification delivery.
- Parsing Slack file attachments, images, or rich blocks in MVP scope.
- Supporting multiple Slack app variants or advanced workspace provisioning flows.

## Decisions

### 1. Replace the email-only intake record with a normalized RFQ intake abstraction
Introduce a generalized intake record for RFQs with common fields such as source type, source label, subject, body, submitted timestamp, and raw payload, plus source-specific metadata for audit details.

Why:
- Keeps the RFQ queue and detail views source-agnostic.
- Avoids duplicating list/detail serialization logic for each intake channel.
- Creates a stable boundary for future channels beyond email and Slack.

Alternatives considered:
- Keep `RfqEmail` and add a separate `RfqSlack` model: rejected because it duplicates persistence and response-shaping logic.
- Store everything in source-specific JSON only: rejected because common queue/detail fields should stay queryable and consistent.

### 2. Add a dedicated Slack connector endpoint that adapts Slack payloads into the normalized intake service
Expose a dedicated NestJS endpoint for a single configured Slack app submission flow. The connector will verify Slack authenticity, extract the normalized RFQ fields and Slack context, and then call the same RFQ creation path used by other intake sources.

Why:
- Keeps provider-specific parsing at the edge and preserves one core RFQ creation workflow.
- Minimizes the change surface in quote drafting and approval logic.
- Supports local and automated testing of the Slack adapter independently from the downstream workflow.

Alternatives considered:
- Build a completely separate Slack-only RFQ creation service: rejected because it would drift from the email path.
- Let the UI post synthetic Slack RFQs directly: rejected because authenticity and connector behavior must be enforced server-side.

### 3. Enforce Slack authenticity and workspace scoping in the API
Require the Slack connector to validate configured Slack credentials and reject requests from untrusted sources before any RFQ record is created.

Why:
- Prevents arbitrary public requests from creating RFQs through the Slack endpoint.
- Keeps the connector safe enough for public repository users to run locally with explicit setup.

Alternatives considered:
- No request verification in MVP: rejected because the endpoint would become an unguarded RFQ creation surface.
- Full OAuth installation flow: rejected because it adds unnecessary operational scope for the first connector.

### 4. Extend shared contracts and UI presentation with source-aware fields while keeping actions unchanged
Update shared view models and the Next.js workspace to show whether an RFQ came from email or Slack and to render relevant provenance details, but keep quote editing, submission, and approval actions identical.

Why:
- Preserves user consistency across sources.
- Makes Slack-origin RFQs understandable without introducing source-specific operator branching.

Alternatives considered:
- Separate Slack-specific queue/detail screens: rejected because it breaks the consistency goal.
- Hide source metadata completely: rejected because operators need provenance to trust incoming requests.

## Risks / Trade-offs

- [Refactoring the existing email-only intake model touches persistence, API contracts, and UI at once] -> Mitigation: keep the normalized model narrow and reuse the existing workflow service path.
- [Slack payload formats can vary by app surface] -> Mitigation: support one explicit Slack submission shape in MVP and isolate mapping logic in the connector adapter.
- [Request verification adds setup friction in local development] -> Mitigation: document the minimal Slack env variables and provide a test path with signed fixture payloads.
- [Source-aware UI changes could accidentally alter current email behavior] -> Mitigation: preserve the current queue/detail actions and add regression coverage for email-origin RFQs.

## Migration Plan

1. Refactor the RFQ intake persistence model from email-only records to a normalized source-aware structure.
2. Update email intake to use the shared normalized RFQ creation path so current behavior is preserved.
3. Add the Slack connector endpoint, request verification, and source metadata persistence.
4. Update shared types, queue/detail responses, and UI labels to display RFQ source consistently.
5. Add automated tests and local setup documentation covering both email and Slack intake.

Rollback is straightforward during development: revert the schema and connector changes, reset the local database, and keep the existing email-only flow.

## Open Questions

- Which Slack app surface should be documented first for operators: slash command, form submission, or another single-step workflow?
- Should the MVP expose Slack submitter identifiers only internally, or also surface a Slack permalink when one is available?
- Does the business want source-specific filtering in the RFQ queue immediately, or is a source badge sufficient for the first connector release?
