# Demo Guide — Acme Auto Parts

## Demo URL

- **Frontend**: http://localhost:3000  
- **API**: http://localhost:4000

## Login Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@auto8.dev | admin123 | Full platform access: connectors, settings, billing, users |
| Operator | operator@auto8.dev | auto8 | RFQ intake → classify → extract → draft quote → submit |
| Operator 2 | operator2@auto8.dev | auto8 | Same as Operator (second seat demo) |
| Sales Approver | sales@auto8.dev | auto8 | Review submitted quotes, approve or reject |

---

## Per-Role Feature Tour

### Admin (`admin@auto8.dev`)

1. **Connectors** — `/connectors`  
   View 3 pre-configured connectors (Gmail, Slack, WhatsApp). Toggle `isEnabled` to activate ingestion.  
   Click **Test Credentials** to validate connection.

2. **Settings** — `/settings`  
   Configure the LLM provider (OpenAI / Anthropic / Google Gemini / Ollama).  
   Change model, API key, base URL.

3. **Billing** — `/billing`  
   View the current trial subscription (14-day trial). Upgrade to a paid plan via Stripe or SePay.

4. **Users / Invite** — `/settings` or invite flow  
   Invite team members by email. They receive a 7-day invite link and auto-join as `quote_operator`.

5. **Analytics** — `/analytics`  
   View RFQ volume, win rate, average response time, top customers, and connector stats.

6. **Webhooks** — `/webhooks`  
   Configure outbound webhook endpoints for real-time event delivery (HMAC-signed).

---

### Operator (`operator@auto8.dev`)

**Full RFQ-to-Quote workflow walkthrough:**

1. **RFQ List** — `/rfqs`  
   See all 8 demo RFQs across different pipeline stages. Filter by status.

2. **Classify** — open an RFQ in `needs_review` stage  
   Review the classification score. Override to `isRfq: true` and advance to classified.

3. **Extract** — open an RFQ in `classified` stage  
   Trigger AI extraction to pull line items (part number, qty, unit) from the email body.

4. **Match** — after extraction  
   View matched catalogue products. Accept, reject, or override each match.

5. **Draft Quote** — open an RFQ in `ready_for_quote` stage  
   Generate a draft quote from the matched items. Edit line items, add notes, set payment terms.

6. **Submit for Approval** — from a `quote_draft_created` RFQ  
   Click **Submit** to advance the quote to `pending_approval`. This triggers a notification to the sales approver.

7. **Customers** — `/customers`  
   Browse the 10 demo B2B customers. View associated quotes per customer.

8. **Catalogue** — `/catalogue`  
   Browse 20 demo products across 4 categories. Upload new products via XLSX/CSV.

---

### Sales Approver (`sales@auto8.dev`)

1. **Approve Queue** — `/rfqs?status=pending_approval`  
   See quotes waiting for approval. One demo quote is in `quote_submitted` state.

2. **Approve Quote** — open the submitted quote  
   Review line items, total, payment terms. Click **Approve** to advance to `approved`.  
   A `sheet_export` background job is automatically queued.

3. **Reject / Request Revision** — from the same quote view  
   Send the quote back to the operator with revision notes.

4. **Approved Quote** — view the `approved` stage demo  
   See the approved quote ready for email send.

---

### Customer Portal (Public)

1. **Share Link** — from an approved quote, operator clicks **Share with Customer**  
   A 24-hour, single-use magic link is generated.

2. **Portal View** — customer opens the link at `/portal/quotes/:token`  
   Customer can **Accept**, **Reject**, or request a **Revision** with a note.

3. **Status Update** — after customer action, the quote status updates in the operator view.

---

## RFQ Pipeline Stages — All 8 Explained

| Stage | Description | Demo RFQ |
|-------|-------------|----------|
| `new` | Email/Slack received, not yet classified | RFQ-2001 (Gmail, hydraulic fittings) |
| `needs_review` | Classification score < 0.7; operator review required | RFQ-2002 (ambiguous inquiry) |
| `classified` | LLM confirmed as RFQ (score ≥ 0.9), no extraction yet | RFQ-2003 (Slack, safety equipment) |
| `ready_for_quote` | Items extracted, customer identified, matches found | RFQ-2004 (power tools, Sara Summit) |
| `quote_draft_created` | Draft quote saved with line items | RFQ-2005 (filter bulk order, Nancy Ports) |
| `quote_submitted` | Quote submitted for sales approval | RFQ-2006 (spark plugs, Eastgate) |
| `approved` | Sales approver approved; sheet_export job queued | RFQ-2007 (socket sets, Metro Parts — WhatsApp) |
| `sent` | Quote email sent to customer; follow-up replies linked | RFQ-2008 (hi-vis vests, City Works) |

---

## Demo Data Summary

| Entity | Count |
|--------|-------|
| Workspaces | 1 (Acme Auto Parts, slug: `demo`) |
| Users | 4 (admin, 2 × operator, sales_approver) |
| Customers | 10 (B2B automotive/industrial) |
| Products | 20 (4 categories: hydraulic, filters, safety, tools) |
| Connectors | 3 (Gmail, Slack, WhatsApp — disabled) |
| Quote Templates | 2 |
| RFQ Intakes | 10 (8 pipeline + 2 reply threads) |
| Quotes | 4 (draft, submitted, approved ×2) |
| Background Jobs | 1 (sheet_export for approved quote) |

---

## Re-seeding

```bash
# From repo root
npm run db:seed
```

The seed is fully idempotent — safe to run multiple times. All existing demo data is wiped and re-created on each run.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Can't reach database" | Ensure postgres is running: `docker-compose up -d postgres` |
| Login fails | Run `npm run db:seed` to reset credentials |
| No RFQs visible | Check you are logged in as `operator@auto8.dev` |
| Approve button not shown | Log in as `sales@auto8.dev` |
