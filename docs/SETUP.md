# Setup Guide

This guide covers everything needed to get auto8 running locally, configure integrations, and run the test suite.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 or higher |
| npm | 10 or higher |
| PostgreSQL | 16 (or Docker) |
| Git | any recent version |

Verify your versions:

```bash
node -v   # should print v20.x.x or higher
npm -v    # should print 10.x.x or higher
psql --version
```

---

## Option A: Docker Compose (Recommended)

Docker Compose starts a PostgreSQL 16 container so you do not need a local PostgreSQL installation.

**Additional prerequisite:** Docker + Docker Compose.

```bash
# 1. Clone the repository
git clone https://github.com/duvu/auto8.git
cd auto8

# 2. Set up API environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env:
#   - Set JWT_SECRET to a long random string (required)
#   - Optionally set OPENAI_API_KEY for AI features

# 3. Start PostgreSQL in the background
docker-compose up -d postgres

# 4. Install dependencies
npm install

# 5. Generate Prisma client and apply migrations
npm run db:generate
npm run db:migrate

# 6. Seed default users
npm run db:seed

# 7. Start the development servers
npm run dev
```

Both servers start concurrently:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:4000

To stop everything:

```bash
docker-compose down
```

---

## Option B: Manual PostgreSQL

Use this option if you already have PostgreSQL 16 installed locally.

```bash
# 1. Create database and user
psql -U postgres
```

Inside psql:

```sql
CREATE USER auto8 WITH PASSWORD 'auto8';
CREATE DATABASE auto8 OWNER auto8;
GRANT ALL PRIVILEGES ON DATABASE auto8 TO auto8;
\q
```

```bash
# 2. Clone the repository
git clone https://github.com/duvu/auto8.git
cd auto8

# 3. Set up environment
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```ini
DATABASE_URL="postgresql://auto8:auto8@localhost:5432/auto8"
JWT_SECRET=replace-with-a-long-random-secret
```

```bash
# 4. Install dependencies
npm install

# 5. Generate Prisma client and apply migrations
npm run db:generate
npm run db:migrate

# 6. Seed default users
npm run db:seed

# 7. Start
npm run dev
```

---

## Environment Variables

All variables live in `apps/api/.env`. Copy from `apps/api/.env.example` as a starting point.

### Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `API_PORT` | no | `4000` | Port the NestJS API listens on |

### JWT Auth

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | **yes** | — | Secret for signing JWTs — use a long random string |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Short-lived access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | no | `7d` | Long-lived refresh token expiry |
| `JWT_EXPIRES_IN` | no | `24h` | Legacy fallback (kept for compatibility) |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` | Comma-separated CORS allowed origins |
| `FRONTEND_URL` | no | `http://localhost:3000` | Base URL for password reset email links |

### Slack Connector

| Variable | Required | Description |
|---|---|---|
| `SLACK_SIGNING_SECRET` | no | Slack app signing secret (env var connector only) |
| `SLACK_ALLOWED_WORKSPACE_IDS` | no | Comma-separated allowed workspace IDs |
| `SLACK_BOT_TOKEN` | no | Bot user OAuth token |

### Gmail Connector

| Variable | Required | Description |
|---|---|---|
| `GMAIL_CONNECTOR_SECRET` | no | Random secret to protect the `POST /connectors/gmail/sync` endpoint |
| `GMAIL_CLIENT_ID` | no | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | no | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | no | Long-lived OAuth refresh token |
| `GMAIL_SEARCH_QUERY` | no | Gmail search filter (code default: `is:unread`; common override: `subject:RFQ is:unread`) |
| `GMAIL_MAX_RESULTS` | no | Max messages per sync (default: `20`) |
| `GMAIL_CRON_SCHEDULE` | no | Cron expression for scheduled sync (default: `0 * * * *`) |

### Outlook Connector

| Variable | Required | Description |
|---|---|---|
| `OUTLOOK_CLIENT_ID` | no | Microsoft Entra / Azure app client ID (env-var connector only) |
| `OUTLOOK_CLIENT_SECRET` | no | Microsoft Entra / Azure app client secret |
| `OUTLOOK_REFRESH_TOKEN` | no | Long-lived Outlook refresh token |
| `OUTLOOK_TENANT_ID` | no | Tenant ID or `common` (default: `common`) |

### LLM / AI

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | no | OpenAI API key; enables classification, extraction, quote gen, smart email |
| `OPENAI_MODEL` | no | Model name (default: `gpt-4o-mini`) |
| `QUOTE_EMAIL_AI` | no | Set to `true` to enable AI-generated email subject/intro |
| `RFQ_CLASSIFICATION_THRESHOLD` | no | Score threshold 0–1 for RFQ classification (default: `0.7`) |

> LLM provider (OpenAI, Anthropic, Google Gemini, or Ollama) can also be configured at runtime in the Admin → Settings UI. DB config takes precedence over env vars.

### SMTP

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | no | SMTP server hostname |
| `SMTP_PORT` | no | SMTP port (default: `587`) |
| `SMTP_USER` | no | SMTP authentication username |
| `SMTP_PASS` | no | SMTP authentication password |
| `QUOTE_EMAIL_FROM` | no | Optional sender address override for quote emails |
| `SMTP_SECURE` | no | `true` enforces TLS (default: `true`; use `false` for MailHog/dev) |

### Google Sheets Export

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SHEET_ID` | no | Spreadsheet ID for quote export |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | no | JSON string of Google service account credentials |

### Attachments & Connectors

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATTACHMENT_STORAGE_PATH` | no | `./attachments` | Local directory for storing email attachments |
| `CONNECTOR_AUTO_DISABLE_THRESHOLD` | no | `5` | Consecutive failures before a connector is disabled |
| `CREDENTIALS_ENCRYPTION_KEY` | no | — | 64-hex-char AES-256-GCM key used to encrypt DB-stored connector credentials |

### Frontend

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | no | `http://localhost:4000` | Frontend base URL for API calls when the API is not on the same host |

---

## Running Tests

Tests require a running PostgreSQL database. If using Docker Compose, ensure `postgres` is running:

```bash
docker-compose up -d postgres
```

Then run:

```bash
npm run test
```

The test suite resets the database schema before each run using `prisma db push --force-reset`. It currently covers 58 passing tests across unit and end-to-end flows:

- **Unit tests** — `AuthService`, `UsersService`, `LlmService`, `RfqClassificationService`, `RfqExtractionService`, `AiQuoteGenerationService`, `SmartEmailGenerationService` (via `*.spec.ts` files co-located with source)
- **E2E tests** — `apps/api/test/api.e2e.spec.ts` and `apps/api/test/mvp1-flow.e2e.spec.ts` covering auth, RFQ intake, quote workflow, email, catalogue, connectors, jobs, audit, and full MVP1 flows

To run only unit tests:

```bash
cd apps/api && npx vitest run src
```

To run only e2e tests:

```bash
cd apps/api && npx vitest run test/api.e2e.spec.ts test/mvp1-flow.e2e.spec.ts
```
