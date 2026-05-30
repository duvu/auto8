# Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│  Browser                                         │
│  Next.js 16 (App Router)  :3000                 │
│  apps/web                                        │
└────────────────────┬────────────────────────────┘
                     │  HTTP (fetch, credentials: include)
                     ▼
┌─────────────────────────────────────────────────┐
│  NestJS API  :4000                               │
│  apps/api                                        │
│                                                  │
│  RbacGuard + BillingGuard + ThrottlerGuard       │
│  SentryInterceptor (error tracking)              │
│  pino structured logging                         │
│  ValidationPipe (whitelist + transform)          │
└────────────────────┬────────────────────────────┘
                     │  Prisma ORM
                     ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL 16                                   │
│  (Docker: postgres:16-alpine in docker-compose)  │
└─────────────────────────────────────────────────┘

External services:
  OpenAI / Anthropic / Google Gemini / Ollama  ← LlmService
  Gmail API (OAuth2)                           ← GmailConnectorService / OAuth2ConnectorService
  Microsoft Graph API                          ← OutlookConnectorService / OAuth2ConnectorService
  Slack Events API                             ← SlackConnectorService / OAuth2ConnectorService
  WhatsApp Business API (Meta Cloud)           ← WhatsappConnectorService
  Telegram Bot API                             ← TelegramConnectorService
  Zalo OA API                                  ← ZaloConnectorService
  Resend (transactional email)                 ← EmailService
  Stripe (subscription billing)                ← BillingService
  SePay (Vietnamese bank transfer)             ← BillingService
  Google Sheets API (service account)          ← SheetExportService
  Sentry (error monitoring)                    ← SentryInterceptor
```

---

## NestJS Module Map

| Module | Description |
|---|---|
| `AppModule` | Root module — registers all feature modules, global guards (RbacGuard → BillingGuard → ThrottlerGuard), rate limiter (named: default/auth/public), pino logger, SentryInterceptor |
| `AuthModule` | JWT login/refresh/logout, password reset, workspace signup, email verification, team invite; exports `JwtModule` |
| `UsersModule` | User CRUD; admin-only write endpoints; workspace-scoped |
| `RbacModule` | `RbacGuard`, `@Roles`, `@Public`, `@CurrentUser`, `@CurrentWorkspaceId` decorators; sets Sentry user context |
| `WorkspaceModule` | Workspace CRUD; multi-tenant root entity; super_admin-only writes |
| `EmailModule` | Transactional email via Resend SDK; 5 methods (generic send, password reset, email verify, invite, portal revision); no-op when RESEND_API_KEY unset |
| `BillingModule` | Subscription management; Stripe checkout + webhooks; SePay bank transfer verification; `BillingGuard` (global, skips @Public + super_admin) |
| `RfqsModule` | RFQ intake, classification, extraction, quote workflow, pipeline status, item matching; reply threading |
| `QuotesModule` | Read-only quote endpoints (`GET /quotes/:id`) |
| `QuoteEmailModule` | Quote email compose, edit, and send via Resend |
| `AuditModule` | Append-only audit event log |
| `SchedulerModule` | Cron-based Gmail and Outlook sync; iterates DB connectors first, with legacy env-var fallback for Gmail |
| `GmailModule` | Gmail OAuth2 client; `sync()` supports per-connector credentials; email reply threading (gmailThreadId) |
| `OutlookModule` | Microsoft Graph connector; unread inbox polling via refresh-token OAuth2 |
| `SlackModule` | Slack Events/Slash command receiver; `intakeSlack()` supports per-connector credentials |
| `WhatsappModule` | WhatsApp Business API webhook receiver; HMAC-SHA256 via `X-Hub-Signature-256`; media download (16 MB) |
| `TelegramModule` | Telegram Bot API webhook receiver; secret-in-URL auth; document download (20 MB) |
| `ZaloModule` | Zalo OA API webhook receiver; HMAC-SHA256 via `mac` field; attachment download (20 MB) |
| `ConnectorRegistryModule` | DB-persisted connector registry; bootstrap from env vars on first boot; OAuth2 authorize/callback; test-credentials endpoint |
| `CatalogueModule` | Product catalogue upload (XLSX/CSV), search, CRUD; semantic matching via pgvector embeddings |
| `AttachmentsModule` | Attachment text extraction (PDF via pdf-parse, DOCX via mammoth, XLSX/CSV via xlsx) |
| `JobsModule` | `BackgroundJob` DB table; `@Cron` every 5s polls pending jobs; retry logic |
| `MatchingModule` | Keyword-based fuzzy matching + semantic matching (pgvector) of `RfqExtractedItem` against `Product` catalogue |
| `SheetExportModule` | Appends approved quotes to Google Sheets via service account |
| `SettingsModule` | Admin UI for LLM provider configuration (stored in `LlmSetting` table) |
| `LlmModule` | Provider abstraction — switches between OpenAI, Anthropic, Google Gemini, Ollama |
| `AnalyticsModule` | Aggregated business metrics: RFQ volume, win rate, response time, top customers, connector stats; workspace-scoped |
| `PortalModule` | Customer portal: magic-link share (24h TTL, single-use), token validation, accept/reject/revision; public routes |
| `WebhooksModule` | Outbound webhook endpoints CRUD, HMAC-signed delivery via `BackgroundJob`, retry logic (3 attempts, 30s/5m backoff) |
| `PrismaModule` | Shared `PrismaService` exported for all modules |

---

## Data Model Overview

```
User
 ├── RefreshToken[]
 ├── PasswordResetToken[]
 ├── EmailVerifyToken[]
 ├── isEmailVerified Boolean
 └── (role: admin | quote_operator | sales_approver | super_admin)

Workspace
 ├── User[]
 ├── Connector[]
 ├── Customer[]
 ├── ProductCatalogue[]
 ├── QuoteTemplate[]
 ├── WebhookEndpoint[]
 ├── InviteToken[]
 ├── Subscription?  (plan, status, trialEndsAt, stripeCustomerId, sePayOrderCode)
 └── (slug @unique, multi-tenant root)

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
 │         ├── QuoteStatusEvent[]
 │         └── MagicLinkToken[]  (customer portal share links)
 ├── RfqAttachment[]
 └── (isReply, replyToRfqId → Rfq for email thread replies)

Product
 └── ProductCatalogue

BackgroundJob  (type: attachment_parse | rfq_extract | item_match | sheet_export | webhook_deliver)

AuditLog  (resourceType + resourceId + event)

LlmSetting  (singleton row id="default")

IngestionRun  (one per connector sync run)

WebhookEndpoint  (outbound webhook targets per workspace)
 └── WebhookDelivery[]  (per-delivery record with retry state)

Subscription  (one per workspace — plan: trial | active | expired)

InviteToken  (email invite with 7d TTL, used for team member onboarding)

EmailVerifyToken  (token for email verification on signup)
```

**Key relationships:**
- `RfqIntake` → `Rfq` is 1:1 when the message passes classification
- `RfqExtractedItem` → `RfqItemMatch[]` → `Product` links LLM-extracted items to catalogue entries
- `QuoteLineItem` has an optional `productId` FK when created from matches
- `BackgroundJob` `payload` is JSON with the relevant resource ID
- `RfqIntake.isReply = true` when the email belongs to an existing RFQ thread (skips classification/extraction)
- `MagicLinkToken` is single-use with 24h TTL; generated by `POST /portal/quotes/:quoteId/share`
- `Subscription` is 1:1 with Workspace; auto-created as `trial` (14 days) on workspace registration
- `InviteToken` is valid for 7 days; on accept, creates User with `quote_operator` role in the workspace

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
- `quote_draft_created` → set by `QuoteWorkflowService.saveDraft()` on draft save
- `approved` → set by `QuoteWorkflowService.approveQuote()`
- `sent` → set by `QuoteEmailService.send()`

**Manual advance:**
- `PATCH /api/rfqs/:rfqId/pipeline-status` (quote_operator role) — for operator override

---

## Auth Flow

```
1. Workspace Registration
   POST /api/auth/register { workspaceName, email, password }
   ← creates Workspace + User(admin) + Subscription(trial, 14d) + EmailVerifyToken
   ← sends verification email via Resend

   POST /api/auth/verify-email { token }
   ← validates token, sets user.isEmailVerified = true

2. Login
   POST /api/auth/login { email, password }
   ← sets httpOnly cookie: access_token (JWT, 15m)
   ← sets httpOnly cookie: refresh_token (opaque, 7d, stored as SHA-256 hash in DB)

3. Authenticated Request
   Browser sends cookies automatically (credentials: 'include')
   RbacGuard reads access_token cookie → verifies JWT → loads User from DB
   (falls back to Authorization: Bearer header for API clients)
   JWT payload: { sub: userId, role, workspaceId }

4. Token Refresh
   POST /api/auth/refresh  (reads refresh_token cookie)
   ← revokes old refresh token in DB
   ← sets new access_token + refresh_token cookies

5. Logout
   POST /api/auth/logout  (reads refresh_token cookie)
   ← revokes refresh token in DB
   ← clears both cookies (Max-Age=0)

6. Password Reset
   POST /api/auth/forgot-password { email }
   ← creates PasswordResetToken in DB (1h expiry), sends email via Resend

   POST /api/auth/reset-password { token, newPassword }
   ← validates token, hashes new password, revokes all refresh tokens for user

7. Team Invite
   POST /api/auth/invite { email }  (requires admin role)
   ← creates InviteToken (7d TTL), sends invite email via Resend

   POST /api/auth/invite/accept { token, password, name? }
   ← validates token, creates User(quote_operator), marks token used
   ← sets auth cookies (auto-login)
```

**Guard behaviour:**
- `RbacGuard` is registered as a global `APP_GUARD` — applies to all routes
- `BillingGuard` runs after RbacGuard — checks subscription status (active or trialing); skips `@Public()` routes and `super_admin` users
- `ThrottlerGuard` enforces named rate limits: `default` (60/min), `auth` (5/5min), `public` (30/min)
- Routes with `@Public()` skip authentication entirely
- Routes with `@Roles(...)` require a valid token AND the user to have one of the listed roles
- Routes with neither `@Public()` nor `@Roles()` require a valid token but allow any role
- `admin` and `super_admin` roles bypass all role checks
- `SentryInterceptor` captures exceptions and sets user context from RbacGuard
