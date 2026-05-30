"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import type { CustomerView, GenerateQuoteResult, QuoteLineItemInput, QuoteTemplateView, RfqDetailView, RfqExtractedCustomerView, RfqExtractedItemView, SaveQuoteInput } from "@auto8/shared";
import { SUPPORTED_CURRENCIES, calcQuoteTotals } from "@auto8/shared";

import { WorkspaceShell } from "../../../components/workspace-shell";
import { ExtractedItemsPanel } from "../../../components/ExtractedItemsPanel";
import { MatchReviewPanel } from "../../../components/MatchReviewPanel";
import { QuoteEmailTab } from "../../../components/QuoteEmailTab";
import { approveQuote, assignRfq, fetchRfqDetail, generateQuote, getCustomers, getExtractedCustomer, getExtractedItems, getQuoteRevisions, getQuoteTemplates, getUsers, reviseQuote, saveDraftQuote, saveCustomerFromRfq, submitQuote, getRfqReplies } from "../../../lib/api";

type ReplyItem = {
  id: string;
  subject: string | null;
  senderName: string | null;
  body: string | null;
  receivedAt: string;
};
import { useRequireAuth } from "../../../lib/use-require-auth";
import { formatState } from "../../../lib/format";

type UserOption = { id: string; name: string };
type RevisionItem = { id: string; version: number; status: string; createdAt: string; parentQuoteId: string | null };

function buildDraft(detail: RfqDetailView | null, extractedCustomer?: RfqExtractedCustomerView | null): SaveQuoteInput {
  return {
    customerName: detail?.quote?.customerName ?? extractedCustomer?.customerContact ?? detail?.senderName ?? detail?.senderEmail ?? detail?.sourceLabel ?? "",
    customerCompany: detail?.quote?.customerCompany ?? extractedCustomer?.customerCompany ?? "",
    notes: detail?.quote?.notes ?? "",
    currency: detail?.quote?.currency ?? "USD",
    exchangeRate: detail?.quote?.exchangeRate ?? 1,
    customerId: detail?.quote?.customerId ?? undefined,
    lineItems:
      detail?.quote?.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        productId: item.productId ?? undefined
      })) ?? [
        {
          description: "",
          quantity: 1,
          unitPrice: 0
        }
      ]
  };
}

export default function RfqDetailPage() {
  const params = useParams<{ rfqId: string }>();
  const rfqId = String(params.rfqId);
  const [detail, setDetail] = useState<RfqDetailView | null>(null);
  const [extractedItems, setExtractedItems] = useState<RfqExtractedItemView[]>([]);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [extractedCustomer, setExtractedCustomer] = useState<RfqExtractedCustomerView | null>(null);
  const [draft, setDraft] = useState<SaveQuoteInput>(buildDraft(null));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"quote" | "email">("quote");

  const [templates, setTemplates] = useState<QuoteTemplateView[]>([]);
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revising, setRevising] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [assigningRfq, setAssigningRfq] = useState(false);

  const authResult = useRequireAuth();
  const authUser = authResult?.forbidden === false ? authResult.user : null;
  const isAdmin = authUser?.role === "admin";

  useEffect(() => {
    async function load() {
      try {
        const [nextDetail, nextExtractedItems, nextExtractedCustomer, templatesRes, customersRes, usersRes, nextReplies] = await Promise.all([
          fetchRfqDetail(rfqId),
          getExtractedItems(rfqId),
          getExtractedCustomer(rfqId),
          getQuoteTemplates(undefined, 1, 50),
          getCustomers(undefined, 1, 100),
          getUsers(1, 100),
          getRfqReplies(rfqId).catch(() => [] as ReplyItem[]),
        ]);
        setDetail(nextDetail);
        setExtractedItems(nextExtractedItems);
        setExtractedCustomer(nextExtractedCustomer);
        setReplies(nextReplies);
        setDraft(buildDraft(nextDetail, nextExtractedCustomer));
        setTemplates(templatesRes.data);
        setCustomers(customersRes.data);
        setUsers(usersRes.data.map((u) => ({ id: u.id, name: u.name })));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load RFQ detail.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [rfqId]);

  const quoteLocked = detail?.quote?.status === "pending_approval" || detail?.quote?.status === "approved";
  const canApprove = detail?.quote?.status === "pending_approval" && authUser?.role === "sales_approver";
  const quoteTotals = useMemo(
    () => calcQuoteTotals(draft.lineItems, draft.discount ?? 0, draft.tax ?? 0),
    [draft.lineItems, draft.discount, draft.tax]
  );
  const quoteTotal = quoteTotals.grandTotal;

  function updateDraftField<K extends keyof SaveQuoteInput>(key: K, value: SaveQuoteInput[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateLineItem(index: number, key: keyof QuoteLineItemInput, value: string) {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (key === "description") {
          return { ...item, description: value };
        }

        return {
          ...item,
          [key]: Number(value)
        };
      })
    }));
  }

  function addLineItem() {
    setDraft((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
          description: "",
          quantity: 1,
          unitPrice: 0
        }
      ]
    }));
  }

  function removeLineItem(index: number) {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setDraft((current) => ({
      ...current,
      templateId,
      currency: tpl.currency,
      lineItems: tpl.lineItems.length > 0
        ? tpl.lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice }))
        : current.lineItems,
    }));
  }

  async function handleSaveCustomer() {
    setSavingCustomer(true);
    setError(null);
    try {
      const saved = await saveCustomerFromRfq(rfqId);
      setCustomers((prev) => [...prev, saved]);
      setDraft((current) => ({ ...current, customerId: saved.id }));
      setSuccessMessage("Customer saved to address book.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save customer");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleRevise() {
    if (!detail?.quote) return;
    setRevising(true);
    setError(null);
    try {
      await reviseQuote(rfqId, detail.quote.id);
      const [nextDetail, nextRevisions] = await Promise.all([
        fetchRfqDetail(rfqId),
        getQuoteRevisions(rfqId),
      ]);
      setDetail(nextDetail);
      setDraft(buildDraft(nextDetail));
      setRevisions(nextRevisions);
      setSuccessMessage("New revision created. Edit and submit the new draft.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revise quote");
    } finally {
      setRevising(false);
    }
  }

  async function handleLoadRevisions() {
    try {
      const nextRevisions = await getQuoteRevisions(rfqId);
      setRevisions(nextRevisions);
      setRevisionsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revisions");
    }
  }

  async function handleAssign(assignedToId: string) {
    setAssigningRfq(true);
    setError(null);
    try {
      await assignRfq(rfqId, assignedToId || null);
      const nextDetail = await fetchRfqDetail(rfqId);
      setDetail(nextDetail);
      setSuccessMessage("RFQ assigned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign RFQ");
    } finally {
      setAssigningRfq(false);
    }
  }

  async function refreshDetail() {
    const nextDetail = await fetchRfqDetail(rfqId);
    setDetail(nextDetail);
    setDraft(buildDraft(nextDetail));
  }

  async function runAction(action: () => Promise<RfqDetailView>, success: string) {
    setWorking(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const nextDetail = await action();
      startTransition(() => {
        setDetail(nextDetail);
        setDraft(buildDraft(nextDetail));
        setSuccessMessage(success);
      });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setWorking(false);
    }
  }

  async function handleGenerateQuote() {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result: GenerateQuoteResult = await generateQuote(rfqId);
      const nextDetail = await fetchRfqDetail(rfqId);
      startTransition(() => {
        setDetail(nextDetail);
        setDraft(buildDraft(nextDetail));
        setSuccessMessage(`AI draft generated using ${result.model}.`);
      });
    } catch (genError) {
      const msg = genError instanceof Error ? genError.message : "AI generation failed.";
      if (msg.includes("503") || msg.toLowerCase().includes("not available")) {
        setError("AI generation is not available — OPENAI_API_KEY is not configured.");
      } else if (msg.includes("409") || msg.toLowerCase().includes("submitted") || msg.toLowerCase().includes("approved")) {
        setError("Quote has already been submitted or approved and cannot be regenerated.");
      } else {
        setError(msg);
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !detail) {
    return <main className="page"><section className="panel">Loading RFQ detail...</section></main>;
  }

  return (
    <WorkspaceShell
      title={`${detail.reference} / Quote Workspace`}
      description="Review inbound RFQ details, maintain the draft quote, and run the approval handoff without leaving the workflow regardless of source."
      authUser={authUser}
      section="RFQs"
    >
      {error ? <div className="error">{error}</div> : null}
      {successMessage ? <div className="success-banner">{successMessage}</div> : null}

      <div className="toolbar">
        <Link className="button-ghost" href="/">
          Back to queue
        </Link>
        <button className="button-ghost" onClick={() => void refreshDetail()} type="button">
          Refresh
        </button>
      </div>

      <div className="tab-bar">
        <button
          className={activeTab === "quote" ? "tab-active" : "tab"}
          type="button"
          onClick={() => setActiveTab("quote")}
        >
          Quote
        </button>
        {detail.quote?.status === "approved" && (
          <button
            className={activeTab === "email" ? "tab-active" : "tab"}
            type="button"
            onClick={() => setActiveTab("email")}
          >
            Email{detail.emailSummary ? ` (${detail.emailSummary.totalSent} sent)` : ""}
          </button>
        )}
      </div>

      {activeTab === "email" && detail.quote ? (
        <section className="panel">
          <h3>Quote email</h3>
          {detail.emailSummary && (
            <p className="email-summary">
              Sent {detail.emailSummary.totalSent} time(s)
              {detail.emailSummary.lastSentAt ? `, last at ${new Date(detail.emailSummary.lastSentAt).toLocaleString()}` : ""}
              {detail.emailSummary.totalErrors > 0 ? `, ${detail.emailSummary.totalErrors} error(s)` : ""}
            </p>
          )}
          <QuoteEmailTab quoteId={detail.quote.id} />
        </section>
      ) : (
      <>
      <section className="detail-grid">
        <article className="panel">
          <div className="panel-header">
            <div className="stack">
              <h2>Inbound RFQ</h2>
              <p className="panel-subtitle">Original intake content and current workflow state.</p>
            </div>
            <div className="badge-row">
              <span className="badge dark">{detail.sourceLabel}</span>
              <span className={`badge ${detail.workflowState === "approved" ? "success" : ""}`}>{formatState(detail.workflowState)}</span>
            </div>
          </div>

          <div className="field-grid">
            <div>
              <div className="meta">Contact</div>
              <div>{detail.senderName ?? detail.slackSubmitterName ?? "Unknown sender"}</div>
              {detail.senderEmail ? <div className="mono">{detail.senderEmail}</div> : <div className="hint">No sender email recorded.</div>}
            </div>
            <div>
              <div className="meta">Source</div>
              <div>{detail.sourceLabel}</div>
            </div>
            <div>
              <div className="meta">Received</div>
              <div>{new Date(detail.receivedAt).toLocaleString()}</div>
            </div>
            {detail.expectedResponseBy && (
              <div>
                <div className="meta">Due by</div>
                <div className={detail.slaBreached ? "text-red-600 font-semibold" : ""}>
                  {new Date(detail.expectedResponseBy).toLocaleString()}
                  {detail.slaBreached && <span className="badge ml-2" style={{ background: "var(--red)", color: "#fff", marginLeft: 6 }}>Overdue</span>}
                </div>
              </div>
            )}
            <div>
              <div className="meta">Assigned to</div>
              {isAdmin ? (
                <select
                  disabled={assigningRfq}
                  value={detail.assignedToId ?? ""}
                  onChange={(e) => void handleAssign(e.target.value)}
                  style={{ fontSize: 13, padding: "2px 4px" }}
                >
                  <option value="">— Unassigned —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <div>{detail.assignedToName ?? "Unassigned"}</div>
              )}
            </div>
          </div>

          {detail.sourceType === "slack" ? (
            <div className="field-grid">
              <div>
                <div className="meta">Workspace</div>
                <div>{detail.slackWorkspaceName ?? detail.slackWorkspaceId ?? "Unknown workspace"}</div>
              </div>
              <div>
                <div className="meta">Channel</div>
                <div>{detail.slackChannelName ? `#${detail.slackChannelName}` : detail.slackChannelId ?? "Unknown channel"}</div>
              </div>
              <div>
                <div className="meta">Slack submitter</div>
                <div>{detail.slackSubmitterName ?? detail.slackSubmitterId ?? "Unknown submitter"}</div>
                {detail.slackSubmitterEmail ? <div className="mono">{detail.slackSubmitterEmail}</div> : null}
              </div>
            </div>
          ) : null}

          <div>
            <div className="meta">Subject</div>
            <h3>{detail.subject}</h3>
          </div>

          <div>
            <div className="meta">Body</div>
            <div className="quote-box">{detail.body}</div>
          </div>

          {extractedCustomer && (
            <div>
              <div className="meta" style={{ marginBottom: 4 }}>AI-Extracted Customer Info</div>
              <div className="field-grid" style={{ background: "var(--surface)", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>
                {extractedCustomer.customerCompany && (
                  <div><span className="meta">Company: </span>{extractedCustomer.customerCompany}</div>
                )}
                {extractedCustomer.customerContact && (
                  <div><span className="meta">Contact: </span>{extractedCustomer.customerContact}</div>
                )}
                {extractedCustomer.customerEmail && (
                  <div><span className="meta">Email: </span>{extractedCustomer.customerEmail}</div>
                )}
                {extractedCustomer.deliveryLocation && (
                  <div><span className="meta">Delivery: </span>{extractedCustomer.deliveryLocation}</div>
                )}
                {extractedCustomer.requestedDeadline && (
                  <div><span className="meta">Deadline: </span>{extractedCustomer.requestedDeadline}</div>
                )}
              </div>
              <button
                type="button"
                disabled={savingCustomer}
                onClick={() => void handleSaveCustomer()}
                className="mt-2 text-xs btn btn-secondary"
              >
                {savingCustomer ? "Saving…" : "Save to Address Book"}
              </button>
            </div>
          )}
        </article>

        <aside className="panel">
          <div className="stack">
            <h2>Status history</h2>
            <p className="panel-subtitle">Chronological transitions recorded on the quote.</p>
          </div>
          <div className="timeline">
            {detail.history.map((event) => (
              <div className="timeline-card" key={event.id}>
                <div className="history-line">
                  <span className={`badge ${event.status === "approved" ? "success" : ""}`}>{formatState(event.status)}</span>
                  <span className="meta">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <div>{event.actorName ?? "System"}</div>
                <div className="meta">{event.actorRole ?? "system"}</div>
              </div>
            ))}
            {!detail.history.length ? <div className="empty">No quote status events yet.</div> : null}
          </div>
          {detail.quote?.parentQuoteId && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button-ghost"
                onClick={() => void handleLoadRevisions()}
                style={{ fontSize: 12 }}
              >
                {revisionsOpen ? "Hide" : "Show"} revision history
              </button>
              {revisionsOpen && revisions.length > 0 && (
                <div className="timeline" style={{ marginTop: 8 }}>
                  {revisions.map((rev) => (
                    <div className="timeline-card" key={rev.id} style={{ fontSize: 12 }}>
                      <div className="history-line">
                        <span className="badge dark">v{rev.version}</span>
                        <span className={`badge ${rev.status === "approved" ? "success" : ""}`}>{formatState(rev.status)}</span>
                      </div>
                      <div className="meta">{rev.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </section>

      <ExtractedItemsPanel rfqId={rfqId} items={extractedItems} />

      <section className="panel">
        <div className="stack">
          <h2>Match Review</h2>
          <p className="panel-subtitle">Review catalogue matches for extracted items and create a quote from them.</p>
        </div>
        <MatchReviewPanel rfqId={rfqId} onQuoteCreated={() => void refreshDetail()} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="stack">
            <h2>Draft quote editor</h2>
            <p className="panel-subtitle">Save the quote while it is a draft, then submit it for sales approval.</p>
          </div>
          <span className="badge dark">Total ${quoteTotal}</span>
        </div>

        <div className="field-grid">
          <label>
            Template
            <select
              disabled={quoteLocked}
              value={draft.templateId ?? ""}
              onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}
            >
              <option value="">— None —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Customer
            <select
              disabled={quoteLocked}
              value={draft.customerId ?? ""}
              onChange={(e) => updateDraftField("customerId", e.target.value || undefined)}
            >
              <option value="">— None —</option>
              {customers
                .filter((c) => !customerSearch || c.companyName.toLowerCase().includes(customerSearch.toLowerCase()))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}{c.contactName ? ` (${c.contactName})` : ""}</option>
                ))}
            </select>
          </label>
          <label>
            Currency
            <select
              disabled={quoteLocked}
              value={draft.currency ?? "USD"}
              onChange={(e) => updateDraftField("currency", e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          {draft.currency && draft.currency !== "USD" && (
            <label>
              Exchange Rate (to USD)
              <input
                disabled={quoteLocked}
                type="number"
                min={0.0001}
                step={0.0001}
                value={draft.exchangeRate ?? 1}
                onChange={(e) => updateDraftField("exchangeRate", parseFloat(e.target.value) || 1)}
              />
            </label>
          )}
          <label>
            Customer name
            <input
              disabled={quoteLocked}
              value={draft.customerName}
              onChange={(event) => updateDraftField("customerName", event.target.value)}
            />
          </label>
          <label>
            Customer company
            <input
              disabled={quoteLocked}
              value={draft.customerCompany}
              onChange={(event) => updateDraftField("customerCompany", event.target.value)}
            />
          </label>
        </div>

        <label>
          Internal notes
          <textarea disabled={quoteLocked} value={draft.notes ?? ""} onChange={(event) => updateDraftField("notes", event.target.value)} />
        </label>

        <div className="stack">
          <div className="panel-header">
            <h3>Line items</h3>
            <button className="button-ghost" disabled={quoteLocked} type="button" onClick={addLineItem}>
              Add line item
            </button>
          </div>

          {draft.lineItems.map((item, index) => {
            const savedLineItem = detail.quote?.lineItems[index];
            const suggestedPrice = savedLineItem?.suggestedPrice ?? null;

            return (
            <div className="line-item-row" key={`${detail.id}-item-${index}`}>
              <label>
                Description
                <input disabled={quoteLocked} value={item.description} onChange={(event) => updateLineItem(index, "description", event.target.value)} />
              </label>
              <label>
                Quantity
                <input
                  disabled={quoteLocked}
                  min={1}
                  step={1}
                  type="number"
                  value={item.quantity}
                  onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                />
              </label>
              <label>
                Unit price
                <input
                  disabled={quoteLocked}
                  min={0}
                  step={0.01}
                  type="number"
                  value={item.unitPrice}
                  onChange={(event) => updateLineItem(index, "unitPrice", event.target.value)}
                />
              </label>
              {suggestedPrice !== null && (
                <label>
                  Suggested
                  <span className="meta" style={{ padding: "6px 0", display: "block" }}>${suggestedPrice.toFixed(2)}</span>
                </label>
              )}
              <button className="button-ghost" disabled={quoteLocked || draft.lineItems.length === 1} type="button" onClick={() => removeLineItem(index)}>
                Remove
              </button>
            </div>
            );
          })}
        </div>

        <div className="actions">
          <button
            className="button"
            disabled={working || quoteLocked}
            type="button"
            onClick={() => void runAction(() => saveDraftQuote(rfqId, { ...draft }), "Draft quote saved.")}
          >
            {working ? "Working..." : detail.quote ? "Update draft" : "Create draft"}
          </button>
          <button
            className="button-secondary"
            disabled={working || generating || quoteLocked}
            type="button"
            onClick={() => void handleGenerateQuote()}
          >
            {generating ? "Generating..." : "Generate with AI"}
          </button>
          <button
            className="button-secondary"
            disabled={working || !detail.quote || detail.quote.status !== "draft"}
            type="button"
            onClick={() => void runAction(() => submitQuote(detail.quote!.id), "Quote submitted for sales approval.")}
          >
            Submit for approval
          </button>
          <button
            className="button-secondary"
            disabled={working || !detail.quote || !canApprove}
            type="button"
            onClick={() => void runAction(() => approveQuote(detail.quote!.id), "Quote approved by sales.")}
          >
            Approve quote
          </button>
          {detail.quote?.status === "approved" && (
            <button
              className="button-secondary"
              disabled={revising}
              type="button"
              onClick={() => void handleRevise()}
            >
              {revising ? "Creating revision..." : "Revise quote (new draft)"}
            </button>
          )}
        </div>
      </section>
      </>
      )}

      <section className="panel" style={{ marginTop: "24px" }}>
        <div 
          className="panel-header" 
          style={{ cursor: "pointer" }} 
          onClick={() => setRepliesExpanded(!repliesExpanded)}
        >
          <div className="stack">
            <h2>Reply Threads {replies.length > 0 ? `(${replies.length})` : ""}</h2>
            <p className="panel-subtitle">Messages related to this RFQ.</p>
          </div>
          <button type="button" className="button-ghost">{repliesExpanded ? "Hide" : "Show"}</button>
        </div>
        {repliesExpanded && (
          <div style={{ marginTop: "16px" }}>
            {replies.length === 0 ? (
              <p className="hint">No reply threads.</p>
            ) : (
              <div className="stack" style={{ gap: "16px", display: "flex", flexDirection: "column" }}>
                {replies.map(r => (
                  <div key={r.id} style={{ border: "1px solid var(--border)", padding: "12px", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <strong>{r.subject || "No subject"}</strong>
                      <span className="meta">{new Date(r.receivedAt).toLocaleString()}</span>
                    </div>
                    <div className="meta" style={{ marginBottom: "8px" }}>From: {r.senderName || "Unknown"}</div>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", color: "var(--ink)", background: "var(--surface)", padding: "8px", borderRadius: "4px" }}>
                      {r.body || "No content"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
