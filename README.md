[![CI](https://github.com/duvu/auto8/actions/workflows/ci.yml/badge.svg)](https://github.com/duvu/auto8/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)

# auto8

auto8 is an AI-assisted RFQ-to-quote workflow platform for B2B distributors and manufacturers. It ingests RFQ (Request for Quotation) messages from 6 channels (Gmail, Outlook, Slack, WhatsApp, Telegram, Zalo), classifies and extracts line items using LLM, matches items against a product catalogue (keyword + semantic/pgvector), and generates draft quotes ready for review and approval — with customer portal, outbound webhooks, analytics, and subscription billing.

## Features

### Inbound Channels (6)
- **Gmail** — OAuth2, scheduled sync, email reply threading (gmailThreadId)
- **Outlook** — Microsoft Graph, OAuth2, scheduled sync
- **Slack** — Events API, slash commands, HMAC verification
- **WhatsApp** — Business API webhook, HMAC-SHA256, media download (16 MB)
- **Telegram** — Bot API webhook, secret-in-URL auth, document download (20 MB)
- **Zalo** — OA API webhook, HMAC-SHA256, attachment download (20 MB)

### AI Pipeline
- **Classification** — LLM-based scoring to distinguish RFQs from non-RFQs; configurable threshold
- **Extraction** — structured line items (part number, description, quantity, unit, confidence) from RFQ body and attachments
- **Semantic matching** — pgvector embeddings for catalogue item similarity search
- **Quote generation** — AI-assisted draft quotes from matched items

### Quote Workflow
- Draft → submit → approve with sales-approver gate
- Quote email compose and send via Resend
- Google Sheets export on approval
- **Customer portal** — magic-link share (24h TTL), customer accept/reject/revision

### Platform
- **Multi-tenant** — Workspace isolation, workspaceId on all entities, JWT propagation
- **Subscription billing** — Stripe checkout + SePay bank transfer; 14-day trial; BillingGuard
- **Team management** — signup, email verification, invite with 7-day TTL
- **Analytics dashboard** — RFQ volume, win rate, response time, top customers, connector stats
- **Outbound webhooks** — HMAC-signed delivery, 3 retry attempts, configurable per workspace
- **Connector setup UX** — structured credential forms, test connection, setup guides, health badges
- **Background jobs** — DB-persisted queue (attachment_parse, rfq_extract, item_match, sheet_export, webhook_deliver)
- **Product catalogue** — XLSX/CSV upload, preview, semantic enrichment, export
- **Audit log** — append-only event log per resource
- **Error monitoring** — Sentry integration (NestJS + Next.js)
- **Rate limiting** — named throttlers (default 60/min, auth 5/5min, public 30/min)
- **4 roles** — `admin`, `quote_operator`, `sales_approver`, `super_admin`
- **Configurable LLM** — OpenAI, Anthropic, Google Gemini, or Ollama; hot-swappable
- **Connector credential encryption** — AES-256-GCM for DB-stored secrets
- **Contract verification** — `npm run verify:contracts` (40 automated checks)

## Stack

| Layer | Technology |
|---|---|
| API | NestJS 11, TypeScript strict |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL 16, Prisma ORM, pgvector |
| Auth | JWT (httpOnly cookies), bcrypt, email verification |
| Email | Resend (transactional) |
| Billing | Stripe (subscriptions), SePay (Vietnamese bank transfer) |
| Monitoring | Sentry (NestJS + Next.js), pino structured logging |
| Testing | Vitest, 51+ unit tests |
| CI/CD | GitHub Actions (typecheck → build → test) |
| Containerisation | Docker multi-stage build, Docker Compose |

## Quick Start — Docker Compose

**Prerequisites:** Docker and Docker Compose.

```bash
# 1. Clone
git clone https://github.com/duvu/auto8.git
cd auto8

# 2. Set up API environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env: set JWT_SECRET, DATABASE_URL, RESEND_API_KEY (optional)

# 3. Start PostgreSQL
docker-compose up -d postgres

# 4. Install dependencies and initialise database
npm install
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start API + frontend
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

## Quick Start — Manual PostgreSQL

**Prerequisites:** Node.js 20+, npm 10+, PostgreSQL 16, Git.

```bash
# 1. Clone and install
git clone https://github.com/duvu/auto8.git
cd auto8
npm install

# 2. Create database
psql -U postgres -c "CREATE USER auto8 WITH PASSWORD 'auto8';"
psql -U postgres -c "CREATE DATABASE auto8 OWNER auto8;"

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
# Set DATABASE_URL=postgresql://auto8:auto8@localhost:5432/auto8
# Set JWT_SECRET to a strong random string
# Set RESEND_API_KEY for transactional email (optional)
# Set STRIPE_SECRET_KEY for billing (optional)
# Set SENTRY_DSN for error monitoring (optional)

# 4. Initialise database
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start
npm run dev
```

## Default Credentials

> **Change these before any non-local deployment.**

| Email | Password | Role |
|---|---|---|
| admin@auto8.dev | admin123 | admin |
| operator@auto8.dev | auto8 | quote_operator |
| sales@auto8.dev | auto8 | sales_approver |

## Useful Commands

```bash
npm run dev               # Start API (port 4000) + frontend (port 3000) concurrently
npm run build             # Build all workspaces
npm run test              # Run API unit tests (requires PostgreSQL)
npm run typecheck         # TypeScript strict check across all workspaces
npm run verify:contracts  # Run 40 automated contract consistency checks
npm run db:generate       # Run prisma generate
npm run db:push           # Push schema to DB (development)
npm run db:seed           # Seed default users
npm run db:migrate        # prisma migrate dev (generate + apply new migration)
```

From `apps/api/`:

```bash
npx prisma migrate deploy   # Apply migrations in production
npx prisma studio           # Open Prisma Studio (database browser)
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `RESEND_API_KEY` | No | Resend SDK key for transactional email |
| `RESEND_FROM_EMAIL` | No | Sender email address (default: noreply@auto8.dev) |
| `STRIPE_SECRET_KEY` | No | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `SENTRY_DSN` | No | Sentry DSN for API error monitoring |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN for frontend error monitoring |
| `CONNECTOR_ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM credential encryption |

## Repository Layout

```
apps/
  api/
    src/
      auth/                 # JWT, signup, invite, email verify, password reset
      users/                # User CRUD (admin-only writes)
      rbac/                 # RbacGuard, @Roles, @Public, @CurrentWorkspaceId
      workspace/            # Workspace CRUD (multi-tenant root)
      billing/              # Stripe + SePay subscription billing, BillingGuard
      email/                # Transactional email via Resend SDK
      rfqs/                 # RFQ intake, classification, extraction, quote workflow
      quotes/               # Quote read endpoints
      quote-email/          # Quote email compose and send
      portal/               # Customer portal (magic-link, accept/reject/revision)
      analytics/            # Business metrics (5 endpoints)
      audit/                # Audit log
      catalogue/            # Product catalogue upload and CRUD
      attachments/          # Attachment parsing (PDF/DOCX/XLSX/CSV/TXT)
      matching/             # RFQ item ↔ product matching (keyword + semantic)
      jobs/                 # Background job queue + cron processor
      sheet-export/         # Google Sheets export
      settings/             # LLM provider settings
      llm/                  # LLM provider abstraction (OpenAI/Anthropic/Google/Ollama)
      gmail/                # Gmail OAuth connector
      outlook/              # Outlook / Microsoft Graph connector
      slack/                # Slack connector
      whatsapp/             # WhatsApp Business API connector
      telegram/             # Telegram Bot API connector
      zalo/                 # Zalo OA API connector
      webhooks/             # Outbound webhook CRUD + delivery
      connector-registry/   # Multi-connector DB registry + OAuth2 + test APIs
      scheduler/            # Cron scheduler (Gmail + Outlook sync)
      sentry/               # SentryInterceptor
      common/               # Filters, DTOs, pipes, shared server utilities
      config/               # Joi-based env validation
      connectors/           # Shared connector interface contracts
    prisma/
      schema.prisma
      migrations/
      seed.ts
  web/
    app/                    # Next.js App Router pages
      analytics/            # Analytics dashboard
      billing/              # Subscription management
      connectors/           # Connector list, create, edit
      customers/            # Customer address book
      invite/               # Team invite accept page
      login/                # Login page
      portal/               # Customer portal (public)
      rfqs/                 # RFQ list and detail
      settings/             # LLM + workspace settings
      signup/               # Workspace registration
      webhooks/             # Outbound webhook admin
    components/             # React components (WorkspaceShell, credential forms, setup guides)
    lib/                    # api.ts, auth hooks, config
packages/
  shared/
    src/                    # Shared interfaces, constants, type contracts
tools/
  contract-checks/          # Automated contract consistency verification (40 checks)
```

## Further Reading

- [Architecture](docs/ARCHITECTURE.md) — module map, data model, RFQ pipeline, auth flow
- [API Reference](docs/API.md) — all endpoints grouped by module
- [Release Gates](docs/RELEASE_GATES.md) — verification commands and release checklist
