# Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│  Browser                                         │
│  Next.js 15 (App Router)  :3000                 │
│  apps/web                                        │
└────────────────────┬────────────────────────────┘
                     │  HTTP (fetch, credentials: include)
                     ▼
┌─────────────────────────────────────────────────┐
│  NestJS API  :4000                               │
│  apps/api                                        │
│                                                  │
│  RbacGuard (global)  +  ThrottlerGuard           │
│  pino structured logging                         │
│  ValidationPipe (whitelist + transform)          │
└────────────────────┬────────────────────────────┘
                     │  Prisma ORM
                     ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL 16                                   │
│  (Docker: postgres:16-alpine in docker-compose)  │
└─────────────────────────────────────────────────┘

External services (all optional):
  OpenAI / Anthropic / Google Gemini / Ollama  ← LlmService
  Gmail API (OAuth)                            ← GmailConnectorService
  Slack Events API                             ← SlackConnectorService
  SMTP server                                  ← QuoteEmailService
  Google Sheets API (service account)          ← SheetExportService
```

---

## NestJS Module Map

| Module | Description |
|---|---|
| `AppModule` | Root module — registers all feature modules, global guards, rate limiter, pino logger |
| `AuthModule` | JWT login/refresh/logout, password reset; exports `JwtModule` |
| `UsersModule` | User CRUD; admin-only write endpoints |
| `RbacModule` | `RbacGuard`, `@Roles`, `@Public`, `@CurrentUser` decorators |
| `RfqsModule` | RFQ intake, classification, extraction, quote workflow, pipeline status, item matching |
| `QuotesModule` | Read-only quote endpoints (`GET /quotes/:id`) |
| `QuoteEmailModule` | Quote email compose, edit, and send via SMTP |
| `AuditModule` | Append-only audit event log |
| `SchedulerModule` | Cron-based Gmail sync; iterates DB connectors first, falls back to env vars |
| `GmailModule` | Gmail OAuth client; `sync()` supports per-connector credentials |
| `SlackModule` | Slack Events/Slash command receiver; `intakeSlack()` supports per-connector credentials |
| `ConnectorRegistryModule` | DB-persisted connector registry; bootstrap from env vars on first boot |
| `CatalogueModule` | Product catalogue upload (XLSX/CSV), search, CRUD |
| `AttachmentsModule` | Attachment text extraction (PDF via pdf-parse, DOCX via mammoth, XLSX/CSV via xlsx) |
| `JobsModule` | `BackgroundJob` DB table; `@Cron` every 5s polls pending jobs; retry logic |
| `MatchingModule` | Keyword-based fuzzy matching of `RfqExtractedItem` against `Product` catalogue |
| `SheetExportModule` | Appends approved quotes to Google Sheets via service account |
| `SettingsModule` | Admin UI for LLM provider configuration (stored in `LlmSetting` table) |
| `LlmModule` | Provider abstraction — switches between OpenAI, Anthropic, Google Gemini, Ollama |
| `PrismaModule` | Shared `PrismaService` exported for all modules |

---

## Data Model Overview

```
User
 ├── RefreshToken[]
 ├── PasswordResetToken[]
 └── (role: admin | quote_operator | sales_approver)

Connector
 ├── RfqIntake[]
 └── IngestionRun[]

RfqIntake  (one per ingested message)
 ├── Rfq  (one per accepted RFQ)
 │    ├── RfqExtractedItem[]
 │    │    └── RfqItemMatch[]  ──► Product
 │    ├── RfqExtractedCustomer
 │    └── Quote
 │         ├── QuoteLineItem[]  ──► Product?
 │         └── QuoteStatusEvent[]
 └── RfqAttachment[]

Product
 └── ProductCatalogue

BackgroundJob  (type: attachment_parse | item_match | sheet_export)

AuditLog  (resourceType + resourceId + event)

LlmSetting  (singleton row id="default")

IngestionRun  (one per connector sync run)
```

**Key relationships:**
- `RfqIntake` → `Rfq` is 1:1 when the message passes classification
- `RfqExtractedItem` → `RfqItemMatch[]` → `Product` links LLM-extracted items to catalogue entries
- `QuoteLineItem` has an optional `productId` FK when created from matches
- `BackgroundJob` `payload` is JSON with the relevant resource ID

---

## RFQ Pipeline

The `rfqPipelineStatus` field on `RfqIntake` tracks the end-to-end state of an RFQ:

```
new
 │  (intake received — email or Slack)
 ▼
classified
 │  (LLM classification score ≥ threshold, isRfq = true)
 │  or
 ▼
needs_review
 │  (classification score < threshold, isRfq = false — operator can review)
 ▼
ready_for_quote
 │  (LLM extraction completed and extracted items saved)
 ▼
quote_draft_created
 │  (quote draft saved — manually or via AI generation from matches)
 ▼
quote_submitted
 │  (operator submits quote for approval)
 ▼
approved
 │  (sales approver approves; sheet_export job enqueued)
 ▼
sent
    (quote email sent to customer)
```

**Automatic advances:**
- `classified` → set by `RfqIntakeService.createRfqFromIntake()` on classification
- `ready_for_quote` → set by `RfqExtractionService.extractAsync()` after saving extracted items
- `quote_draft_created` → set by `QuoteWorkflowService.saveDraft()` on first draft save
- `approved` → set by `QuoteWorkflowService.approveQuote()`
- `sent` → set by `QuoteEmailService.send()`

**Manual advance:**
- `PATCH /api/rfqs/:rfqId/pipeline-status` (quote_operator role) — for operator override

---

## Auth Flow

```
1. Login
   POST /api/auth/login { email, password }
   ← sets httpOnly cookie: access_token (JWT, 15m)
   ← sets httpOnly cookie: refresh_token (opaque, 7d, stored as SHA-256 hash in DB)

2. Authenticated Request
   Browser sends cookies automatically (credentials: 'include')
   RbacGuard reads access_token cookie → verifies JWT → loads User from DB
   (falls back to Authorization: Bearer header for API clients)

3. Token Refresh
   POST /api/auth/refresh  (reads refresh_token cookie)
   ← revokes old refresh token in DB
   ← sets new access_token + refresh_token cookies

4. Logout
   POST /api/auth/logout  (reads refresh_token cookie)
   ← revokes refresh token in DB
   ← clears both cookies (Max-Age=0)

5. Password Reset
   POST /api/auth/forgot-password { email }
   ← creates PasswordResetToken in DB (1h expiry), sends email with link

   POST /api/auth/reset-password { token, newPassword }
   ← validates token, hashes new password, revokes all refresh tokens for user
```

**Guard behaviour:**
- `RbacGuard` is registered as a global `APP_GUARD` — applies to all routes
- Routes with `@Public()` skip authentication entirely
- Routes with `@Roles(...)` require a valid token AND the user to have one of the listed roles
- Routes with neither `@Public()` nor `@Roles()` require a valid token but allow any role
- `admin` role bypasses all role checks
