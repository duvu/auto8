"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import type { QuoteLineItemInput, RfqDetailView, SaveQuoteInput, UserSummary } from "@auto8/shared";

import { WorkspaceShell } from "../../../components/workspace-shell";
import { approveQuote, fetchRfqDetail, fetchUsers, saveDraftQuote, submitQuote } from "../../../lib/api";
import { useDemoUser } from "../../../lib/use-demo-user";

function formatState(value: string) {
  return value.replaceAll("_", " ");
}

function buildDraft(detail: RfqDetailView | null): SaveQuoteInput {
  return {
    customerName: detail?.quote?.customerName ?? detail?.senderName ?? detail?.senderEmail ?? detail?.sourceLabel ?? "",
    customerCompany: detail?.quote?.customerCompany ?? "",
    notes: detail?.quote?.notes ?? "",
    lineItems:
      detail?.quote?.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice
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
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [detail, setDetail] = useState<RfqDetailView | null>(null);
  const [draft, setDraft] = useState<SaveQuoteInput>(buildDraft(null));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { selectedUser, selectedUserId, selectUser } = useDemoUser(users);

  useEffect(() => {
    async function load() {
      try {
        const [nextUsers, nextDetail] = await Promise.all([fetchUsers(), fetchRfqDetail(rfqId)]);
        setUsers(nextUsers);
        setDetail(nextDetail);
        setDraft(buildDraft(nextDetail));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load RFQ detail.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [rfqId]);

  const quoteLocked = detail?.quote?.status === "pending_approval" || detail?.quote?.status === "approved";
  const canApprove = detail?.quote?.status === "pending_approval" && selectedUser?.role === "sales_approver";
  const quoteTotal = useMemo(
    () => draft.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [draft.lineItems]
  );

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

  if (loading || !detail) {
    return <main className="page"><section className="panel">Loading RFQ detail...</section></main>;
  }

  return (
    <WorkspaceShell
      title={`${detail.reference} / Quote Workspace`}
      description="Review inbound RFQ details, maintain the draft quote, and run the approval handoff without leaving the workflow regardless of source."
      selectedUser={selectedUser}
      selectedUserId={selectedUserId}
      users={users}
      onUserChange={selectUser}
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
        </aside>
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

          {draft.lineItems.map((item, index) => (
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
                  step={1}
                  type="number"
                  value={item.unitPrice}
                  onChange={(event) => updateLineItem(index, "unitPrice", event.target.value)}
                />
              </label>
              <button className="button-ghost" disabled={quoteLocked || draft.lineItems.length === 1} type="button" onClick={() => removeLineItem(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="actions">
          <button
            className="button"
            disabled={working || !selectedUserId || quoteLocked}
            type="button"
            onClick={() => void runAction(() => saveDraftQuote(rfqId, draft, selectedUserId), "Draft quote saved.")}
          >
            {working ? "Working..." : detail.quote ? "Update draft" : "Create draft"}
          </button>
          <button
            className="button-secondary"
            disabled={working || !detail.quote || detail.quote.status !== "draft" || !selectedUserId}
            type="button"
            onClick={() => void runAction(() => submitQuote(detail.quote!.id, selectedUserId), "Quote submitted for sales approval.")}
          >
            Submit for approval
          </button>
          <button
            className="button-secondary"
            disabled={working || !detail.quote || !canApprove || !selectedUserId}
            type="button"
            onClick={() => void runAction(() => approveQuote(detail.quote!.id, selectedUserId), "Quote approved by sales.")}
          >
            Approve quote
          </button>
        </div>
      </section>
    </WorkspaceShell>
  );
}
