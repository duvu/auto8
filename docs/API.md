# API Reference

Base URL: `http://localhost:4000/api`

All authenticated endpoints require valid auth cookies (set on login). The frontend uses `credentials: 'include'` on all requests. For programmatic use, obtain a token via `POST /api/auth/login` and include the `Authorization: Bearer <token>` header as a fallback.

**Role legend:**
- `public` — no authentication required
- `any` — any authenticated user
- `operator` — `quote_operator` or `admin`
- `approver` — `sales_approver` or `admin`
- `admin` — `admin` role only
- `super_admin` — super_admin role (bypasses all workspace restrictions)

---

## Authentication

### `POST /api/auth/login`
**Access:** public

Login and receive httpOnly JWT cookies.

**Request body:**
```json
{ "email": "admin@auto8.dev", "password": "admin123" }
```

**Response `200`:**
```json
{ "message": "ok" }
```

Sets cookies:
- `access_token` — JWT, 15 min
- `refresh_token` — opaque token, 7 days

---

### `POST /api/auth/refresh`
**Access:** public (reads `refresh_token` cookie)

Exchange a valid refresh token for a new token pair.

**Response `200`:** `{ "message": "ok" }` — sets new cookies.

**Response `401`:** refresh token missing, expired, or revoked.

---

### `POST /api/auth/logout`
**Access:** public (reads `refresh_token` cookie)

Revoke the refresh token and clear auth cookies.

**Response `204`** (no content)

---

### `GET /api/auth/me`
**Access:** any

Return the currently authenticated user.

**Response `200`:**
```json
{
  "id": "abc123",
  "email": "operator@auto8.dev",
  "name": "Operator",
  "role": "quote_operator",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

### `POST /api/auth/forgot-password`
**Access:** public

Send a password reset email. Always returns 204 regardless of whether the email exists (to prevent enumeration).

**Request body:** `{ "email": "user@example.com" }`

**Response `204`**

---

### `POST /api/auth/reset-password`
**Access:** public

Set a new password using a reset token from the email link.

**Request body:**
```json
{ "token": "<reset-token>", "newPassword": "mynewpassword" }
```

**Response `204`**

**Response `400`:** token missing, expired, or already used.

---

### `POST /api/auth/register`
**Access:** public

Register a new workspace. Creates Workspace + User(admin) + Subscription(trial, 14 days) + sends email verification link via Resend.

**Request body:**
```json
{ "workspaceName": "Acme Corp", "email": "admin@acme.com", "password": "securepass123" }
```

**Response `201`:** `{ "message": "Workspace created. Check your email to verify." }`

**Response `409`:** email already exists.

---

### `POST /api/auth/verify-email`
**Access:** public

Verify email address using the token from the verification email.

**Request body:** `{ "token": "<verify-token>" }`

**Response `204`**

**Response `400`:** token missing, expired, or already used.

---

### `POST /api/auth/invite`
**Access:** admin

Send a team invite email. Creates InviteToken (7-day TTL) and sends invite link via Resend.

**Request body:** `{ "email": "colleague@acme.com" }`

**Response `201`:** `{ "message": "Invite sent" }`

---

### `POST /api/auth/invite/accept`
**Access:** public

Accept a team invite. Creates a User with `quote_operator` role in the workspace and sets auth cookies.

**Request body:**
```json
{ "token": "<invite-token>", "password": "securepass", "name": "Jane Doe" }
```

**Response `200`:** `{ "ok": true }` — sets auth cookies (auto-login).

**Response `400`:** token missing, expired, or already used.

---

## Users

### `GET /api/users`
**Access:** any (authenticated)

List all users (paginated).

**Query params:** `page` (default 1), `limit` (default 20, max 100)

**Response `200`:**
```json
{
  "data": [
    { "id": "...", "email": "...", "name": "...", "role": "admin", "isActive": true, "createdAt": "..." }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "hasMore": false }
}
```

---

### `POST /api/users`
**Access:** admin

Create a new user.

**Request body:**
```json
{ "name": "Jane Doe", "email": "jane@example.com", "role": "quote_operator", "password": "securepass" }
```

**Response `201`:** `UserView`

**Response `409`:** email already exists.

---

### `PATCH /api/users/:id`
**Access:** admin

Update a user's name, email, role, password, or active status.

**Request body (all fields optional):**
```json
{ "name": "Jane Smith", "isActive": false }
```

**Response `200`:** updated `UserView`

---

### `DELETE /api/users/:id`
**Access:** admin

Soft-delete (deactivate) a user. Sets `isActive = false`.

**Response `204`**

---

## RFQs

### `GET /api/rfqs`
**Access:** any (authenticated)

List RFQs with optional filters (paginated).

**Query params:**
- `page`, `limit`
- `isRfq` — `true` (active RFQs, default) or `false` (rejected/classified-out)
- `pipelineStatus` — filter by pipeline stage (e.g., `ready_for_quote`)
- `includeReplies` — `true` to include reply intakes (default: `false`)

**Response `200`:** `PaginatedResponse<RfqListItemView>`

---

### `GET /api/rfqs/:rfqId/replies`
**Access:** any (authenticated)

Return all email reply intakes for this RFQ thread.

**Response `200`:** `RfqReplyView[]`

---

### `GET /api/rfqs/:rfqId`
**Access:** any (authenticated)

Get full RFQ detail including quote (if any).

**Response `200`:** `RfqDetailView`

---

### `POST /api/rfqs/intake-email`
**Access:** public

Ingest an RFQ from a raw email payload (used by Gmail webhook or direct POST).

---

### `GET /api/rfqs/:rfqId/extracted-items`
**Access:** any (authenticated)

Return LLM-extracted line items for this RFQ.

**Response `200`:** `RfqExtractedItemView[]`

---

### `GET /api/rfqs/:rfqId/extracted-customer`
**Access:** any (authenticated)

Return LLM-extracted customer information (name, company, contact, delivery address).

**Response `200`:** `RfqExtractedCustomerView | null`

---

### `GET /api/rfqs/:rfqId/matches`
**Access:** any (authenticated)

Return item matching results grouped by extracted item.

---

### `PATCH /api/rfqs/:rfqId/matches/:matchId`
**Access:** operator

Accept or override a specific item match.

**Request body:**
```json
{ "action": "accept" }
```
or
```json
{ "action": "override", "overrideDescription": "Custom desc", "overrideUnitPrice": 99 }
```

---

### `PATCH /api/rfqs/:rfqId/extracted-items/:itemId`
**Access:** operator

Edit an extracted item inline after review.

**Request body (all fields optional):**
```json
{ "partNumber": "ABC-123", "description": "Brake disc", "quantity": 2, "unit": "pcs" }
```

---

### `PATCH /api/rfqs/:rfqId/pipeline-status`
**Access:** operator

Manually advance or set the pipeline status.

**Request body:** `{ "status": "ready_for_quote" }`

---

### `PUT /api/rfqs/:rfqId/quote`
**Access:** operator

Save or update a quote draft.

**Request body:** `SaveQuoteInput` (`customerName`, `customerCompany`, `notes`, `lineItems`, `discount`, `tax`, `paymentTerms`, `deliveryTerms`, `validityDays`)

---

### `POST /api/rfqs/:rfqId/quote/generate`
**Access:** operator

Generate a draft quote using LLM based on extracted items.

**Response `200`:** `GenerateQuoteResult`
**Response `503`:** LLM not configured.
**Response `409`:** quote already submitted or approved.

---

### `POST /api/rfqs/:rfqId/quote/from-matches`
**Access:** operator

Create a quote from accepted/overridden item matches.

**Response `409`:** no accepted matches found.

---

### `POST /api/rfqs/:rfqId/quote/submit`
**Access:** operator

Submit a draft quote for approval.

---

### `POST /api/rfqs/:rfqId/quote/approve`
**Access:** approver

Approve a submitted quote. Triggers Google Sheets export job (if configured).

---

### `POST /api/rfqs/:rfqId/export-sheet`
**Access:** operator

Manually enqueue a Google Sheets export job for this RFQ's approved quote.

---

## Connectors

### `GET /api/connectors`
**Access:** admin

List all registered connectors.

**Response `200`:** `ConnectorView[]`

---

### `GET /api/connectors/:id`
**Access:** any (authenticated)

Return a single connector.

**Response `200`:** `ConnectorView`

**Response `404`:** connector not found.

---

### `GET /api/connectors/:id/runs`
**Access:** any (authenticated)

Return paginated ingestion history for a single connector.

**Query params:** `page`, `limit`

**Response `200`:** `PaginatedResponse<IngestionRunView>`

**Response `404`:** connector not found.

---

### `POST /api/connectors/:id/sync`
**Access:** admin

Trigger an immediate sync for a connector.

For `gmail` and `outlook`, the connector sync runs synchronously and returns a `ConnectorSyncSummary`.
For `slack`, the endpoint returns `422` because Slack is push-only.

**Response `200`:** `ConnectorSyncSummary`

**Response `422`:** connector is disabled, or connector type is push-only.

---

### `POST /api/connectors`
**Access:** admin

Register a new connector.

**Request body:**
```json
{
  "type": "gmail",
  "label": "Sales inbox",
  "credentials": {
    "clientId": "...",
    "clientSecret": "...",
    "refreshToken": "..."
  }
}
```

Supported connector types: `gmail`, `slack`, `outlook`, `whatsapp`, `telegram`, `zalo`

**Response `201`:** `ConnectorView`

---

### `PATCH /api/connectors/:id`
**Access:** admin

Update a connector's label, credentials, or enabled state.

Supported connector types: `gmail`, `slack`, `outlook`, `whatsapp`, `telegram`, `zalo`

---

### `DELETE /api/connectors/:id`
**Access:** admin

Remove a connector.

**Response `204`**

---

### `POST /api/connectors/:id/test`
**Access:** admin

Test the connector by making a live API call (Gmail profile check, Slack `auth.test`, Outlook `GET /me`, WhatsApp Graph API ping, Telegram `getMe`, Zalo OA info).

**Response `200`:** `ConnectorTestResult`

---

### `POST /api/connectors/test-credentials`
**Access:** admin

Test a set of credentials before saving. Does not write to the database.

**Request body:** `{ "type": "whatsapp", "credentials": { "appSecret": "...", "phoneNumberId": "..." } }`

**Response `200`:** `ConnectorTestResult`

---

### `GET /api/connectors/oauth2/providers`
**Access:** admin

List available OAuth2 providers (gmail, slack, outlook) and their authorization URLs.

**Response `200`:** `{ providers: [{ type, authUrl }] }`

---

### `GET /api/connectors/oauth2/start`
**Access:** admin

Redirect to the OAuth2 authorization URL for a provider.

**Query params:** `provider` (gmail | slack | outlook), `connectorId` (optional, for re-auth)

**Response `302`:** redirect to provider authorization page.

---

### `GET /api/connectors/oauth2/callback`
**Access:** public (OAuth2 callback)

Handle the OAuth2 callback, exchange code for tokens, and save to the connector record.

**Response `302`:** redirect to `/connectors/:id/edit?connected=true`

---

### `POST /api/connectors/slack/intake`
**Access:** public (Slack signs the request with HMAC)

Slack Events API endpoint for receiving slash commands and RFQ messages.

---

### `POST /api/connectors/slack/events`
**Access:** public (Slack signs the request with HMAC)

Slack Events API endpoint for event callbacks.

---

### `POST /api/connectors/gmail/sync`
**Access:** public (protected by `GMAIL_CONNECTOR_SECRET` header)

Trigger a sync for the legacy env-var Gmail connector.

---

### `GET /api/webhooks/whatsapp`
**Access:** public (Meta webhook challenge verification)

WhatsApp Business API webhook challenge endpoint.

---

### `POST /api/webhooks/whatsapp`
**Access:** public (HMAC-SHA256 via `X-Hub-Signature-256`)

Receive WhatsApp Business API message webhooks. Validates HMAC, downloads media (up to 16 MB), and creates `RfqIntake` records.

---

### `POST /api/webhooks/telegram/:secret`
**Access:** public (secret-in-URL auth)

Receive Telegram Bot API update webhooks. Downloads documents (up to 20 MB) and creates `RfqIntake` records.

---

### `GET /api/webhooks/zalo/:connectorId`
**Access:** public (Zalo challenge verification)

Zalo OA API webhook challenge endpoint. Returns the challenge string when `verifyToken` matches.

---

### `POST /api/webhooks/zalo/:connectorId`
**Access:** public (HMAC-SHA256 via `mac` field)

Receive Zalo OA API message webhooks. Downloads attachments (up to 20 MB) and creates `RfqIntake` records.

---

## Quote Email

### `GET /api/quotes/:quoteId/email`
**Access:** operator

Get the current email draft for a quote.

**Response `200`:** `QuoteEmailDraftView`

---

### `PUT /api/quotes/:quoteId/email`
**Access:** operator

Update the email draft (subject, body, recipient).

---

### `POST /api/quotes/:quoteId/email/send`
**Access:** operator

Send the quote email. Sets pipeline status to `sent`.

---

## Catalogue

### `GET /api/catalogue`
**Access:** any (authenticated)

List products (paginated, optional `q` search query).

**Query params:** `page`, `limit`, `q` (full-text filter)

**Response `200`:** `PaginatedResponse<ProductView>`

---

### `POST /api/catalogue/upload`
**Access:** admin

Upload a product catalogue from an XLSX or CSV file. Upserts products by `productCode`.

**Content-Type:** `multipart/form-data`, field name: `file`

**Response `201`:** `CatalogueUploadResult` with count of created and updated products.

---

### `POST /api/catalogue/upload/preview`
**Access:** admin

Preview a catalogue upload without writing anything to the database.

**Content-Type:** `multipart/form-data`, field name: `file`

**Response `201`:** `UploadPreviewResult`

---

### `GET /api/catalogue/export`
**Access:** admin

Download all active products as CSV.

**Response `200`:** `text/csv`

---

### `POST /api/catalogue`
**Access:** admin

Create a single product manually.

**Request body:** `CreateProductInput`

**Response `201`:** `ProductView`

---

### `GET /api/catalogue/:id`
**Access:** any (authenticated)

Get a single product.

---

### `PUT /api/catalogue/:id`
**Access:** admin

Fully update a product.

**Response `200`:** `ProductView`

---

### `PATCH /api/catalogue/:id`
**Access:** admin

Update a product's fields.

---

### `DELETE /api/catalogue/:id`
**Access:** admin

Deactivate (soft-delete) a product.

**Response `204`**

---

### `POST /api/catalogue/:id/reactivate`
**Access:** admin

Reactivate a soft-deleted product.

**Response `200`:** `ProductView`

---

## Settings

### `GET /api/settings/llm`
**Access:** admin

Return the current LLM provider configuration (API key is masked).

**Response `200`:** `LlmSettingView`

---

### `PUT /api/settings/llm`
**Access:** admin

Update the LLM provider configuration.

**Request body:** `UpdateLlmSettingInput` (provider, model, apiKey, baseUrl?)

**Response `200`:** `LlmSettingView`

---

### `POST /api/settings/llm/test`
**Access:** admin

Test the current LLM configuration with a live completion call.

**Response `200`:** `LlmTestResult` (success, latencyMs, model, error?)

---

## Jobs

### `GET /api/jobs`
**Access:** admin

List background jobs (paginated), optionally filtered by `status` or `type`.

**Query params:** `page`, `limit`, `status` (`pending|running|done|failed`), `type` (`attachment_parse|rfq_extract|item_match|sheet_export|webhook_deliver`)

**Response `200`:** `PaginatedResponse<BackgroundJobView>`

---

### `GET /api/jobs/:id`
**Access:** admin

Get a single background job by ID.

**Response `200`:** `BackgroundJobView`

---

## Audit

### `GET /api/audit`
**Access:** approver (sales_approver or admin)

List recent audit events (paginated).

**Query params:** `page`, `limit`, `resourceType`, `resourceId`, `actorId`

**Response `200`:** `PaginatedResponse<AuditLogView>`

---

## Health

### `GET /api/health`
**Access:** public

Simple liveness check.

**Response `200`:** `{ "ok": true }`

---

## Connector Runs (Ingestion Metrics)

### `GET /api/connectors/runs`
**Access:** any (authenticated)

List recent ingestion runs (paginated).

---

### `GET /api/connectors/runs/summary`
**Access:** any (authenticated)

Return aggregated ingestion metrics: total runs, success rate, per-connector stats.

The response also includes a `connectors` array with each connector's current health snapshot.

---

### `GET /api/connectors/runs/:connectorName`
**Access:** any (authenticated)

List runs for a specific connector (paginated).

---

## Webhooks (Outbound)

### `GET /api/webhooks/endpoints`
**Access:** admin

List all registered outbound webhook endpoints for the current workspace.

**Response `200`:** `WebhookEndpointView[]`

---

### `POST /api/webhooks/endpoints`
**Access:** admin

Register a new outbound webhook endpoint.

**Request body:**
```json
{
  "url": "https://example.com/hooks/auto8",
  "secret": "my-hmac-secret",
  "events": ["rfq.created", "quote.approved", "quote.sent"]
}
```

**Response `201`:** `WebhookEndpointView`

---

### `PATCH /api/webhooks/endpoints/:id`
**Access:** admin

Update a webhook endpoint's URL, secret, events, or enabled state.

**Response `200`:** `WebhookEndpointView`

---

### `DELETE /api/webhooks/endpoints/:id`
**Access:** admin

Remove a webhook endpoint.

**Response `204`**

---

### `POST /api/webhooks/endpoints/:id/test`
**Access:** admin

Send a test `ping` event to the endpoint. The request is signed with HMAC-SHA256 via `X-Auto8-Signature`.

**Response `200`:** `{ ok: true, statusCode: number }`

---

## Analytics

### `GET /api/analytics/rfq-volume`
**Access:** admin, sales_approver

Return RFQ intake counts grouped by day for the past 30 days.

**Response `200`:** `RfqVolumePoint[]` — `[{ date: string, count: number }]`

---

### `GET /api/analytics/win-rate`
**Access:** admin, sales_approver

Return quote win rate (approved / total submitted) for the past 90 days.

**Response `200`:** `WinRateResult` — `{ submitted: number, approved: number, winRate: number }`

---

### `GET /api/analytics/response-time`
**Access:** admin, sales_approver

Return average time from RFQ receipt to quote approval (in hours) for the past 90 days.

**Response `200`:** `ResponseTimeResult` — `{ avgHours: number | null }`

---

### `GET /api/analytics/top-customers`
**Access:** admin, sales_approver

Return top 10 customers by number of approved quotes.

**Response `200`:** `TopCustomerView[]` — `[{ customerId, companyName, approvedQuotes, totalRevenue }]`

---

### `GET /api/analytics/connectors`
**Access:** admin, sales_approver

Return per-connector ingestion stats (total intakes, last sync).

**Response `200`:** `ConnectorStatsView[]` — `[{ connectorId, label, type, totalIntakes, lastSyncAt }]`

---

## Workspace

### `GET /api/workspace`
**Access:** admin

Return all workspaces.

**Response `200`:** `WorkspaceView[]`

---

### `GET /api/workspace/:id`
**Access:** admin

Return a single workspace.

**Response `200`:** `WorkspaceView`

---

### `POST /api/workspace`
**Access:** super_admin

Create a new workspace.

**Request body:** `{ "name": "Acme Corp", "slug": "acme-corp" }`

**Response `201`:** `WorkspaceView`

---

### `PATCH /api/workspace/:id`
**Access:** admin

Update workspace name or slug.

**Response `200`:** `WorkspaceView`

---

## Customer Portal

### `POST /api/portal/quotes/:quoteId/share`
**Access:** operator

Generate a magic-link share token for the customer portal. Token is single-use with 24-hour TTL.

**Response `201`:** `ShareLinkResult` — `{ url: string }`

---

### `DELETE /api/portal/quotes/:quoteId/share`
**Access:** operator

Revoke all active magic-link tokens for this quote.

**Response `204`**

---

### `GET /api/portal/q/:token/data`
**Access:** public (no auth required)

Return quote data for the customer portal. Returns `401` if token is expired or used.

**Response `200`:** `PortalQuoteView`

---

### `POST /api/portal/q/:token/accept`
**Access:** public

Customer accepts the quote. Marks token as used, updates quote status to `customer_accepted`.

**Response `200`:** `{ ok: true }`

---

### `POST /api/portal/q/:token/reject`
**Access:** public

Customer rejects the quote. Marks token as used, updates quote status to `customer_rejected`.

**Request body (optional):** `{ "note": "Price too high" }`

**Response `200`:** `{ ok: true }`

---

### `POST /api/portal/q/:token/revision`
**Access:** public

Customer requests a revision. Marks token as used, updates quote status to `revision_requested`.

**Request body:** `{ "note": "Please add expedited shipping option" }`

**Response `200`:** `{ ok: true }`

---

## Billing

### `GET /api/billing/subscription`
**Access:** admin

Return the current workspace's subscription status.

**Response `200`:**
```json
{
  "plan": "trial",
  "status": "trialing",
  "trialEndsAt": "2026-06-13T00:00:00.000Z",
  "stripeCustomerId": null,
  "sePayOrderCode": null
}
```

---

### `POST /api/billing/stripe/checkout`
**Access:** admin

Create a Stripe Checkout session for upgrading to a paid plan. Returns a redirect URL.

**Response `200`:** `{ "url": "https://checkout.stripe.com/..." }`

---

### `POST /api/billing/stripe/webhook`
**Access:** public (Stripe signature verification via `stripe-signature` header)

Handle Stripe webhook events (checkout.session.completed, customer.subscription.deleted).

**Response `200`:** `{ "received": true }`

---

### `POST /api/billing/sepay/init`
**Access:** admin

Initialize a SePay bank transfer order. Returns bank details and a unique order code for the transfer content.

**Response `200`:**
```json
{
  "bankCode": "VCB",
  "accountNumber": "1234567890",
  "amount": 500000,
  "orderCode": "AUTO8-WS-abc123",
  "transferContent": "AUTO8-WS-abc123"
}
```

---

### `POST /api/billing/sepay/confirm`
**Access:** public (called by SePay webhook or manual verification)

Confirm a SePay bank transfer. Verifies the order code in the transfer content matches an existing workspace order, and the amount matches.

**Request body:** `{ "transferContent": "AUTO8-WS-abc123", "amount": 500000 }`

**Response `200`:** `{ "ok": true }`

**Response `400`:** order code not found or amount mismatch.
