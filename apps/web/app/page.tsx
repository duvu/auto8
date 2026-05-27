"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { formatState } from "../lib/format";

import type { IntakeEmailInput, RfqListItemView } from "@auto8/shared";

import { WorkspaceShell } from "../components/workspace-shell";
import { createRfqFromEmail, fetchRfqs } from "../lib/api";
import { getAuthUser } from "../lib/auth";
import type { AuthUser } from "../lib/auth";

const initialIntakeForm: IntakeEmailInput = {
  fromEmail: "buyer@autofleet.example",
  fromName: "Alex Buyer",
  subject: "RFQ: cabin filters for service inventory",
  body: "Please quote 60 cabin filters for next week's service intake.",
  receivedAt: new Date().toISOString()
};

function formatWorkflowState(value: string) {
  return formatState(value);
}

export default function DashboardPage() {
  const [rfqs, setRfqs] = useState<RfqListItemView[]>([]);
  const [rejectedRfqs, setRejectedRfqs] = useState<RfqListItemView[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "rejected">("active");
  const [pipelineFilter, setPipelineFilter] = useState<string>("");
  const [intakeForm, setIntakeForm] = useState<IntakeEmailInput>(initialIntakeForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void getAuthUser().then(setAuthUser);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [activeRes, rejectedRes] = await Promise.all([
          fetchRfqs(true, pipelineFilter || undefined),
          fetchRfqs(false)
        ]);
        setRfqs(activeRes.data);
        setRejectedRfqs(rejectedRes.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [pipelineFilter]);

  const stats = useMemo(
    () => ({
      total: rfqs.length,
      pendingApproval: rfqs.filter((rfq) => rfq.workflowState === "pending_approval").length,
      approved: rfqs.filter((rfq) => rfq.workflowState === "approved").length
    }),
    [rfqs]
  );

  async function refreshRfqs() {
    const [activeRes, rejectedRes] = await Promise.all([
      fetchRfqs(true, pipelineFilter || undefined),
      fetchRfqs(false)
    ]);
    setRfqs(activeRes.data);
    setRejectedRfqs(rejectedRes.data);
  }

  function updateField<K extends keyof IntakeEmailInput>(key: K, value: IntakeEmailInput[K]) {
    setIntakeForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleIntakeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await createRfqFromEmail({
        ...intakeForm,
        receivedAt: new Date().toISOString()
      });
      startTransition(() => {
        setSuccessMessage(`Created ${created.reference} from inbound email.`);
      });
      setIntakeForm({
        ...initialIntakeForm,
        receivedAt: new Date().toISOString()
      });
      await refreshRfqs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "RFQ intake failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="page"><section className="panel">Loading dashboard...</section></main>;
  }

  return (
    <WorkspaceShell
      title="RFQ Intake Dashboard"
      description="Capture inbound RFQs from email or Slack, route them into one queue, and hand them off for draft creation or sales approval."
      authUser={authUser}
    >
      <section className="stats">
        <div className="stat">
          <span className="meta">Active RFQs</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat">
          <span className="meta">Pending Approval</span>
          <strong>{stats.pendingApproval}</strong>
        </div>
        <div className="stat">
          <span className="meta">Approved</span>
          <strong>{stats.approved}</strong>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {successMessage ? <div className="success-banner">{successMessage}</div> : null}

      <section className="dashboard-grid">
        <form className="panel" onSubmit={handleIntakeSubmit}>
          <div className="stack">
            <h2>Simulate inbound RFQ email</h2>
            <p className="panel-subtitle">Use the normalized email intake contract. Slack uses the signed connector endpoint and appears in the same queue.</p>
          </div>
          <div className="field-grid">
            <label>
              Sender name
              <input value={intakeForm.fromName ?? ""} onChange={(event) => updateField("fromName", event.target.value)} />
            </label>
            <label>
              Sender email
              <input type="email" value={intakeForm.fromEmail} onChange={(event) => updateField("fromEmail", event.target.value)} required />
            </label>
          </div>
          <label>
            Subject
            <input value={intakeForm.subject} onChange={(event) => updateField("subject", event.target.value)} required />
          </label>
          <label>
            Email body
            <textarea value={intakeForm.body} onChange={(event) => updateField("body", event.target.value)} required />
          </label>
          <div className="actions">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "Creating RFQ..." : "Create RFQ"}
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="stack">
            <h2>RFQ work queue</h2>
            <p className="panel-subtitle">Open any RFQ to draft a quote, submit it for approval, or confirm an approved status.</p>
          </div>
          <div className="tab-row">
            <button className={`tab ${activeTab === "active" ? "tab-active" : ""}`} onClick={() => setActiveTab("active")}>
              Active ({rfqs.length})
            </button>
            <button className={`tab ${activeTab === "rejected" ? "tab-active" : ""}`} onClick={() => setActiveTab("rejected")}>
              Rejected ({rejectedRfqs.length})
            </button>
          </div>
          {activeTab === "active" && (
            <div className="badge-row" style={{ marginBottom: 8 }}>
              <label className="meta" style={{ marginRight: 6 }}>Pipeline:</label>
              <select
                value={pipelineFilter}
                onChange={(e) => setPipelineFilter(e.target.value)}
                style={{ fontSize: 12, padding: "2px 6px", borderRadius: 4, border: "1px solid #ccc" }}
              >
                <option value="">All</option>
                <option value="classified">Classified</option>
                <option value="needs_review">Needs Review</option>
                <option value="ready_for_quote">Ready for Quote</option>
                <option value="quote_draft_created">Draft Created</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}
          {activeTab === "active" ? (
            <div className="list">
              {rfqs.map((rfq) => (
                <Link className="list-card" href={`/rfqs/${rfq.id}`} key={rfq.id}>
                  <div className="list-card-header">
                    <div>
                      <h3>{rfq.reference}</h3>
                      <div className="meta">{rfq.subject}</div>
                    </div>
                    <div className="badge-row">
                      <span className="badge dark">{rfq.sourceLabel}</span>
                      <span className={`badge ${rfq.workflowState === "approved" ? "success" : ""}`}>{formatWorkflowState(rfq.workflowState)}</span>
                      {rfq.rfqPipelineStatus && rfq.rfqPipelineStatus !== "classified" && (
                        <span className="badge">{rfq.rfqPipelineStatus.replace(/_/g, " ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="meta">{rfq.senderName ?? rfq.senderEmail ?? rfq.sourceLabel}</div>
                  {rfq.senderEmail ? <div className="mono">{rfq.senderEmail}</div> : <div className="hint">No sender email recorded.</div>}
                  <div className="hint">Received {new Date(rfq.receivedAt).toLocaleString()}</div>
                </Link>
              ))}
              {!rfqs.length ? <div className="empty">No active RFQs.</div> : null}
            </div>
          ) : (
            <div className="list">
              {rejectedRfqs.map((rfq) => (
                <Link className="list-card" href={`/rfqs/${rfq.id}`} key={rfq.id}>
                  <div className="list-card-header">
                    <div>
                      <h3>{rfq.reference}</h3>
                      <div className="meta">{rfq.subject}</div>
                    </div>
                    <div className="badge-row">
                      <span className="badge dark">{rfq.sourceLabel}</span>
                      <span className="badge">Rejected</span>
                      {rfq.classificationScore !== null && (
                        <span className="badge">{Math.round(rfq.classificationScore * 100)}% RFQ</span>
                      )}
                    </div>
                  </div>
                  <div className="meta">{rfq.senderName ?? rfq.senderEmail ?? rfq.sourceLabel}</div>
                  {rfq.senderEmail ? <div className="mono">{rfq.senderEmail}</div> : <div className="hint">No sender email recorded.</div>}
                  <div className="hint">Received {new Date(rfq.receivedAt).toLocaleString()}</div>
                </Link>
              ))}
              {!rejectedRfqs.length ? <div className="empty">No rejected messages.</div> : null}
            </div>
          )}
        </section>
      </section>
    </WorkspaceShell>
  );
}
