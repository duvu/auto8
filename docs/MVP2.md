# auto8 — MVP2 Feature Roadmap and Status

> **MVP1 recap**: RFQ intake (Gmail / Outlook / Slack) → LLM classification & extraction → quote drafting → approval workflow → email send. Product catalogue, fuzzy item matching, Google Sheets export, audit log, i18n (EN/VI), responsive UI.
>
> **Current status (2026-06-04)**: MVP2 implementation tasks are complete in OpenSpec. Final aggregate verification and archival should run before treating the branch as release-ready.

---

## Themes

| Theme | Goal |
|---|---|
| **Operator Efficiency** | Cut quote turnaround time |
| **Channel Expansion** | Capture more RFQ sources |
| **Intelligence** | Better LLM accuracy & automation |
| **Enterprise Ops** | Handle real sales org workflows |
| **Integration** | Make auto8 play with other systems |

---

## Implementation Status Snapshot

| Area | OpenSpec change | Progress | Status |
|---|---:|---:|---|
| Sprint 1 — Efficiency core | `mvp2-sprint1-efficiency` | 56 / 56 | ✅ Complete |
| Sprint 2 — Enterprise ops | `mvp2-sprint2-enterprise-ops` | 61 / 61 | ✅ Complete |
| Sprint 3 — Intelligence | `mvp2-sprint3-intelligence` | 42 / 42 | ✅ Complete |
| Sprint 4 — Channels & Integration | `sprint-4-channels-integration` | 62 / 62 | ✅ Complete |
| Platform maturity | `mvp3-platform-maturity` | 60 / 60 | ✅ Complete |
| OAuth2 connector flow | `connector-oauth2-flow` | 22 / 22 | ✅ Complete |
| Responsive fullscreen UI | `responsive-fullscreen-ui` | 16 / 16 | ✅ Complete |
| Persistent toolbar navigation | `persistent-toolbar-navigation` | 18 / 18 | ✅ Complete |
| Simplified connector setup | `simplify-connector-setup` | 19 / 19 | ✅ Complete |
| Plugin architecture hardening | `plugin-architecture-hardening` | 28 / 28 | ✅ Complete |
| Pluggable logging transports | `pluggable-logging-transports` | 13 / 13 | ✅ Complete |
| Multi-language i18n | `i18n-multi-language` | 36 / 36 | ✅ Complete |
| Demo data seed | `demo-data-seed` | 30 / 30 | ✅ Complete |
| Codebase consistency audit | `codebase-consistency-audit` | 24 / 24 | ✅ Complete |

**Verification note**: Individual implementation agents reported passing `npm run typecheck` and `npm run build` for their changes. Because many changes landed concurrently, run a final aggregate `npm run typecheck`, `npm run build`, `npm run verify:contracts`, and targeted tests before release/merge archival.

---

## Features

### 1. Customer Address Book
**Theme**: Operator Efficiency  
**Priority**: 🔴 High
**Status**: ✅ Complete via `mvp2-sprint1-efficiency`

Customers are currently extracted ad-hoc from each RFQ with no persistence. A customer address book lets operators:

- Save customers extracted from past RFQs as named contacts (company, email, phone, address)
- Auto-fill recipient fields when composing quote emails
- View all historical RFQs and quotes per customer
- Manually create / edit / merge duplicate customer records

**Data model**: new `Customer` table with optional FK on `RfqExtractedCustomer` and `Quote`.

---

### 2. Quote Templates
**Theme**: Operator Efficiency  
**Priority**: 🔴 High
**Status**: ✅ Complete via `mvp2-sprint1-efficiency`

Every quote is currently drafted from scratch. Templates allow:

- Saving reusable quote structures (header copy, payment terms, validity period, standard line items)
- Applying a template when creating a new quote draft
- Per-role template management (admin creates, operators apply)

**Data model**: new `QuoteTemplate` + `QuoteTemplateLineItem` tables.

---

### 3. Multi-currency & Pricing Rules
**Theme**: Operator Efficiency  
**Priority**: 🔴 High
**Status**: ✅ Complete via `mvp2-sprint1-efficiency`

Quote line items currently have no currency or margin logic. Add:

- Currency field on `Quote` (USD, VND, EUR, …) with exchange rate input
- Per-product or per-category default markup percentage
- Automatic unit price suggestion: `catalogue cost × (1 + markup)`
- Currency display in quote email output

**Data model**: `currency` + `exchangeRate` on `Quote`; `defaultMarkup` on `Product` / `ProductCatalogue`.

---

### 4. Quote Revision & Version History
**Theme**: Enterprise Ops  
**Priority**: 🔴 High
**Status**: ✅ Complete via `mvp2-sprint2-enterprise-ops`

Quotes often require revision after customer feedback. Add:

- "Revise" action on a submitted or approved quote — creates `v2`, `v3`, … linked to original
- Diff view between versions (changed line items, prices)
- Customer can be sent a revised quote without re-opening the full approval flow
- Version history visible in quote detail page

**Data model**: `parentQuoteId` self-reference on `Quote`; `version` integer field.

---

### 5. Connector: WhatsApp & Telegram
**Theme**: Channel Expansion  
**Priority**: 🟠 Medium-High
**Status**: ✅ Complete via `sprint-4-channels-integration`

WhatsApp Business API and Telegram are the dominant B2B messaging channels in Southeast Asia. Add intake connectors that feed the same `RfqIntake` → classification pipeline:

- WhatsApp: via Meta Cloud API webhook (message + attachment support)
- Telegram: via Bot API webhook
- Per-connector credentials stored in existing `Connector` registry
- Attachment extraction already handled by `AttachmentsModule`

---

### 6. Bulk RFQ Assignment
**Theme**: Enterprise Ops  
**Priority**: 🟠 Medium-High
**Status**: ✅ Complete via `mvp2-sprint2-enterprise-ops`

Supervisors need to distribute incoming RFQs across a team. Add:

- `assignedTo` FK (`userId`) on `Rfq`
- Assign / reassign action in RFQ list and detail views (admin + sales_approver roles)
- Filter RFQ list by assignee
- "My RFQs" default view for `quote_operator` role

**Data model**: `assignedToId` on `Rfq`.

---

### 7. Semantic Item Matching (Embeddings)
**Theme**: Intelligence  
**Priority**: 🟠 Medium-High
**Status**: ✅ Complete via `mvp2-sprint3-intelligence`

Current keyword fuzzy matching misses "SS hex bolt M8×1.25" → "stainless steel bolt M8". Upgrade to:

- Generate embeddings for `Product` descriptions on catalogue upload (OpenAI / local model)
- Store in `pgvector` column on `Product`
- Match `RfqExtractedItem` descriptions via cosine similarity
- Fall back to existing keyword match when no vector match exceeds threshold

**Data model**: `embedding vector(1536)` on `Product`; requires `pgvector` Postgres extension.

---

### 8. Catalogue Enrichment via LLM
**Theme**: Intelligence  
**Priority**: 🟡 Medium
**Status**: ✅ Complete via `mvp2-sprint3-intelligence`

Raw catalogue uploads (XLSX/CSV) often have inconsistent product names, missing descriptions, and no category tags. Add a post-upload enrichment step:

- LLM pass to normalize product names and fill missing descriptions
- Auto-suggest category tags per product
- Operator reviews and confirms enrichment before saving
- Surfaced as a step in the catalogue upload flow

---

### 9. Email Threading / Reply Detection
**Theme**: Operator Efficiency  
**Priority**: 🟡 Medium
**Status**: ✅ Complete via `sprint-4-channels-integration`

When a customer replies to a sent quote email, the reply currently lands as a new unrelated RFQ intake. Add:

- Parse `In-Reply-To` / `References` headers in incoming Gmail/Outlook messages
- Auto-link reply to originating `Rfq` and `Quote`
- Show reply thread inline on quote detail page
- Suppress auto-classification for detected replies

---

### 10. SLA / Deadline Tracking
**Theme**: Enterprise Ops  
**Priority**: 🟡 Medium
**Status**: ✅ Complete via `mvp2-sprint2-enterprise-ops`

Sales managers need visibility into response time commitments. Add:

- `expectedResponseBy` datetime field on `Rfq` (set manually or via configurable SLA rule)
- Overdue badge on RFQ list rows
- Dashboard widget: "X RFQs overdue", "Y due today"
- Optional email/Slack alert when an RFQ approaches deadline

**Data model**: `expectedResponseBy` on `Rfq`; new `SlaConfig` settings table.

---

### 11. Outbound Webhooks
**Theme**: Integration  
**Priority**: 🟡 Medium
**Status**: ✅ Complete via `sprint-4-channels-integration`

Allow auto8 to push events to external systems (ERP, custom dashboards, Zapier) without polling. Add:

- Configurable webhook endpoints per event type: `rfq.created`, `quote.approved`, `quote.sent`, etc.
- HMAC-signed payloads
- Delivery log with retry (max 3 attempts, exponential backoff)
- Admin UI to manage webhook endpoints (URL, secret, event subscriptions)

**Data model**: new `WebhookEndpoint` + `WebhookDelivery` tables.

---

## Suggested Sequencing

```
Sprint 1 (Efficiency core) ✅ Complete
  #1 Customer Address Book
  #2 Quote Templates
  #3 Multi-currency & Pricing Rules

Sprint 2 (Enterprise ops) ✅ Complete
  #4 Quote Revisions
  #6 Bulk RFQ Assignment
  #10 SLA Tracking

Sprint 3 (Intelligence) ✅ Complete
  #7 Semantic Matching
  #8 Catalogue Enrichment

Sprint 4 (Channels & Integration) ✅ Complete
  #5 WhatsApp / Telegram
  #9 Email Threading
  #11 Outbound Webhooks
```

---

## Next Roadmap Phase

With MVP2 complete, the next phase should focus on release hardening and operational readiness rather than adding more feature surface area immediately.

### Phase A — Release hardening

- Run final aggregate verification across the whole worktree: typecheck, build, contract verification, and targeted Jest suites.
- Remove temporary implementation scripts and keep only source, tests, docs, migrations, and intended assets.
- Archive completed OpenSpec changes after verification so active work only shows true future scope.
- Reconcile any pre-existing failing tests and DB setup gaps before tagging a release.

### Phase B — Production readiness

- Expand smoke tests for auth, connector OAuth2, RFQ intake, quote revisions, portal actions, and webhook delivery.
- Add deployment runbook coverage for new env vars: OAuth2 providers, logging transports, pgvector, embedding threshold, webhook signing, and i18n.
- Validate seed data and demo guide against the deployed Z440 environment.

### Phase C — Post-MVP2 product work

- Improve analytics from dashboards into actionable alerts and scheduled reports.
- Add configurable notification rules for SLA breach warnings.
- Harden AI workflows with evaluation fixtures for classification, extraction, matching, and enrichment.
- Add connector observability dashboards: sync health, delivery failures, retry queues, and per-channel throughput.

---

*Generated: 2026-05-29. Updated: 2026-06-04.*
