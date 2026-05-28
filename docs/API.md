# API Reference

Base URL: `http://localhost:4000/api`

All authenticated endpoints require valid auth cookies (set on login). The frontend uses `credentials: 'include'` on all requests. For programmatic use, obtain a token via `POST /api/auth/login` and include the `Authorization: Bearer <token>` header as a fallback.

**Role legend:**
- `public` — no authentication required
- `any` — any authenticated user
- `operator` — `quote_operator` or `admin`
- `approver` — `sales_approver` or `admin`
- `admin` — `admin` role only

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

**Response `200`:** `PaginatedResponse<RfqListItemView>`

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
{ "action": "override", "overrideDescription": "Custom desc", "overrideUnitPrice": 9900 }
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

**Request body:** `SaveQuoteInput` (customerName, customerCompany, notes, lineItems, discount, tax, grandTotal, paymentTerms, deliveryTerms, validityDays)

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

**Response `201`:** `ConnectorView`

---

### `PATCH /api/connectors/:id`
**Access:** admin

Update a connector's label, credentials, or enabled state.

---

### `DELETE /api/connectors/:id`
**Access:** admin

Remove a connector.

**Response `204`**

---

### `POST /api/connectors/:id/test`
**Access:** admin

Test the connector by making a live API call (Gmail profile check or Slack `auth.test`).

**Response `200`:** `ConnectorTestResult`

---

### `POST /api/connectors/slack/intake`
**Access:** public (Slack signs the request with HMAC)

Slack Events API endpoint for receiving slash commands and RFQ messages.

---

### `POST /api/connectors/gmail/sync`
**Access:** public (protected by `GMAIL_CONNECTOR_SECRET` header)

Trigger a Gmail sync for the env-var connector.

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

### `GET /api/catalogue/:id`
**Access:** any (authenticated)

Get a single product.

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

**Query params:** `page`, `limit`, `status` (`pending|running|done|failed`), `type` (`attachment_parse|item_match|sheet_export`)

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

---

### `GET /api/connectors/runs/:connectorName`
**Access:** any (authenticated)

List runs for a specific connector (paginated).
