[![CI](https://github.com/duvu/auto8/actions/workflows/ci.yml/badge.svg)](https://github.com/duvu/auto8/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)

# auto8

auto8 is an AI-assisted RFQ-to-quote workflow platform. It ingests RFQ (Request for Quotation) emails and Slack messages, classifies and extracts line items using LLM, matches items against a product catalogue, and generates draft quotes ready for review and approval — with optional Google Sheets export on approval.

## Features

- **RFQ intake** via email (Gmail OAuth) and Slack slash command, with deduplication
- **Multi-connector ingestion** — configure multiple Gmail and Slack connectors from the admin UI
- **AI classification** — LLM-based scoring to distinguish RFQs from non-RFQs; configurable threshold
- **LLM extraction** — extracts structured line items (part number, description, quantity, unit, confidence) from RFQ body and attachments
- **Attachment parsing** — PDF, DOCX, XLSX, CSV text extraction via background jobs
- **Product catalogue** — upload items via XLSX/CSV, full-text search, active/inactive management
- **Item matching** — keyword-based fuzzy matching of extracted items against catalogue; operator accept/override UI
- **Quote workflow** — draft → submit → approve with sales-approver gate; AI-assisted quote generation from matched items
- **Quote email** — compose and send quote emails via SMTP; optional AI-generated subject and intro (opt-in)
- **Google Sheets export** — appends approved quotes to a spreadsheet via service account
- **Background jobs** — DB-persisted job queue with cron polling, retry, and failure tracking
- **User management** — admin CRUD for users; three roles: `admin`, `quote_operator`, `sales_approver`
- **JWT cookie auth** — httpOnly access (15 min) + refresh (7 day) token pair; password reset via email
- **Audit log** — append-only event log per resource
- **Configurable LLM provider** — OpenAI, Anthropic, Google Gemini, or self-hosted Ollama; managed from admin Settings UI

## Stack

| Layer | Technology |
|---|---|
| API | NestJS 10, TypeScript strict |
| Frontend | Next.js 15 (App Router), React, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT (httpOnly cookies), bcrypt |
| Logging | pino / nestjs-pino (JSON in production) |
| Testing | Jest (API unit + e2e), 48 tests |
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
# Edit apps/api/.env: set JWT_SECRET to a strong random string

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
npm run test              # Run API unit + e2e tests (requires PostgreSQL)
npm run typecheck         # TypeScript strict check across all workspaces
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

## Repository Layout

```
apps/
  api/
    src/
      modules/
        auth/               # JWT login, refresh, logout, password reset
        users/              # User CRUD (admin-only writes)
        rbac/               # RbacGuard, @Roles, @Public decorators
        rfqs/               # RFQ intake, classification, extraction, quote workflow
        quotes/             # Quote read endpoints
        quote-email/        # Quote email compose and send
        audit/              # Audit log
        catalogue/          # Product catalogue upload and CRUD
        attachments/        # Attachment parsing (PDF/DOCX/XLSX/CSV)
        matching/           # RFQ item ↔ product matching
        jobs/               # Background job queue + cron processor
        sheet-export/       # Google Sheets export
        settings/           # LLM provider settings
        llm/                # LLM provider abstraction (OpenAI/Anthropic/Google/Ollama)
        gmail/              # Gmail OAuth connector
        slack/              # Slack connector
        connector-registry/ # Multi-connector DB registry
        scheduler/          # Cron scheduler (Gmail sync)
        health/             # GET /api/health
        common/             # Filters, DTOs, pipes
      prisma/
        schema.prisma
        migrations/
        seed.ts
  web/
    src/
      app/                  # Next.js App Router pages
      components/           # React components
      lib/                  # api.ts, auth.ts utilities
packages/
  shared/
    src/                    # Shared TypeScript interfaces and constants
```

## Further Reading

- [Setup Guide](docs/SETUP.md) — detailed development setup, env var reference
- [Architecture](docs/ARCHITECTURE.md) — module map, data model, RFQ pipeline, auth flow
- [API Reference](docs/API.md) — all endpoints grouped by module
- [Deployment](docs/DEPLOYMENT.md) — Docker, env var table, CI/CD, production checklist
