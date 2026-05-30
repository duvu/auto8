"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { formatState } from "../lib/format";

import type { IntakeEmailInput, RfqListItemView, SetupStatusView, UserView } from "@auto8/shared";
import { VALID_PIPELINE_STATUSES } from "@auto8/shared";

import { WorkspaceShell } from "../components/workspace-shell";
import { assignRfq, createRfqFromEmail, fetchRfqs, getSetupStatus, getUsers } from "../lib/api";
import { useRequireAuth } from "../lib/use-require-auth";

const initialIntakeForm: IntakeEmailInput = {
  fromEmail: "buyer@autofleet.example",
  fromName: "Alex Buyer",
  subject: "RFQ: cabin filters for service inventory",
  body: "Please quote 60 cabin filters for next week's service intake.",
  receivedAt: new Date().toISOString()
};

export default function DashboardPage() {
  const [rfqs, setRfqs] = useState<RfqListItemView[]>([]);
  const [rejectedRfqs, setRejectedRfqs] = useState<RfqListItemView[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "rejected">("active");
  const [pipelineFilter, setPipelineFilter] = useState<string>("");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("");
  const [intakeForm, setIntakeForm] = useState<IntakeEmailInput>(initialIntakeForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<UserView[]>([]);
  const [assigningRfqId, setAssigningRfqId] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatusView | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const authResult = useRequireAuth();
  const authUser = authResult?.forbidden === false ? authResult.user : null;
  const isAdmin = authUser?.role === "admin";

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && localStorage.getItem("onboarding_banner_dismissed") === "true";
    setBannerDismissed(dismissed);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [activeRes, rejectedRes, usersRes] = await Promise.all([
          fetchRfqs(true, pipelineFilter || undefined, assignedToFilter || undefined),
          fetchRfqs(false),
          isAdmin ? getUsers(1, 100) : Promise.resolve({ data: [] as UserView[], total: 0, page: 1, limit: 100, totalPages: 1 })
        ]);
        setRfqs(activeRes.data);
        setRejectedRfqs(rejectedRes.data);
        setUsers(usersRes.data);
        if (isAdmin) {
          try {
            const status = await getSetupStatus();
            setSetupStatus(status);
          } catch (_err) {
            setSetupStatus(null);
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [pipelineFilter, assignedToFilter, isAdmin]);

  const stats = useMemo(
    () => ({
      total: rfqs.length,
      pendingApproval: rfqs.filter((rfq) => rfq.rfqPipelineStatus === "quote_submitted").length,
      approved: rfqs.filter((rfq) => rfq.rfqPipelineStatus === "approved").length,
      overdue: rfqs.filter((rfq) => rfq.slaBreached).length
    }),
    [rfqs]
  );

  async function refreshRfqs() {
    const [activeRes, rejectedRes] = await Promise.all([
      fetchRfqs(true, pipelineFilter || undefined, assignedToFilter || undefined),
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

  async function handleAssign(rfqId: string, assignedToId: string | null) {
    setAssigningRfqId(rfqId);
    try {
      await assignRfq(rfqId, assignedToId);
      await refreshRfqs();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Assignment failed.");
    } finally {
      setAssigningRfqId(null);
    }
  }

  function handleDismissBanner() {
    localStorage.setItem("onboarding_banner_dismissed", "true");
    setBannerDismissed(true);
  }

  const stepsCompleted = setupStatus
    ? [setupStatus.llmConfigured, setupStatus.catalogueLoaded, setupStatus.connectorConfigured, setupStatus.teamMembersAdded].filter(Boolean).length
    : 0;

  if (loading) {
    return <main className="page"><section className="panel">Loading dashboard...</section></main>;
  }

  return (
    <WorkspaceShell
      title="RFQ Intake Dashboard"
      description="Capture inbound RFQs from email or Slack, route them into one queue, and hand them off for draft creation or sales approval."
      authUser={authUser}
      section="RFQs"
    >
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
          <span className="text-sm text-muted">Active RFQs</span>
          <strong className="text-2xl font-bold text-ink">{stats.total}</strong>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
          <span className="text-sm text-muted">Pending Approval</span>
          <strong className="text-2xl font-bold text-ink">{stats.pendingApproval}</strong>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
          <span className="text-sm text-muted">Approved</span>
          <strong className="text-2xl font-bold text-ink">{stats.approved}</strong>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
          <span className="text-sm text-muted text-red-500">Overdue</span>
          <strong className="text-2xl font-bold text-red-600">{stats.overdue}</strong>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {successMessage ? <div className="success-banner">{successMessage}</div> : null}

      {isAdmin && setupStatus && !setupStatus.completed && !bannerDismissed && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-amber-600 text-lg">⚙️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Setup in progress — {stepsCompleted}/4 steps complete</p>
              <p className="text-xs text-amber-700">Configure auto8 to start processing RFQs.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href="/setup" className="text-xs font-medium text-amber-700 underline hover:text-amber-900">Go to Setup</a>
            <button onClick={handleDismissBanner} className="text-amber-500 hover:text-amber-700 text-xs ml-2">✕</button>
          </div>
        </div>
      )}

      <section className="dashboard-grid">
        <form className="panel" onSubmit={handleIntakeSubmit}>
          <div className="stack">
            <h2 className="text-xl font-semibold text-ink">Simulate inbound RFQ email</h2>
            <p className="panel-subtitle">Use the normalized email intake contract. Slack uses the signed connector endpoint and appears in the same queue.</p>
          </div>
          <div className="field-grid">
            <label>
              Sender name
              <input className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" value={intakeForm.fromName ?? ""} onChange={(event) => updateField("fromName", event.target.value)} />
            </label>
            <label>
              Sender email
              <input className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" type="email" value={intakeForm.fromEmail} onChange={(event) => updateField("fromEmail", event.target.value)} required />
            </label>
          </div>
          <label>
            Subject
            <input className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" value={intakeForm.subject} onChange={(event) => updateField("subject", event.target.value)} required />
          </label>
          <label>
            Email body
            <textarea className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" value={intakeForm.body} onChange={(event) => updateField("body", event.target.value)} required />
          </label>
          <div className="actions">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "Creating RFQ..." : "Create RFQ"}
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="stack">
            <h2 className="text-xl font-semibold text-ink">RFQ work queue</h2>
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
            <div className="badge-row" style={{ marginBottom: 8, gap: 12 }}>
              <label className="meta" style={{ marginRight: 4 }}>Pipeline:</label>
              <select
                value={pipelineFilter}
                onChange={(e) => setPipelineFilter(e.target.value)}
                style={{ fontSize: 12, padding: "2px 6px", borderRadius: 4, border: "1px solid #ccc" }}
              >
                <option value="">All</option>
                {VALID_PIPELINE_STATUSES.filter((s) => s !== "new").map((s) => (
                  <option key={s} value={s}>{formatState(s)}</option>
                ))}
              </select>
              {isAdmin && users.length > 0 && (
                <>
                  <label className="meta" style={{ marginLeft: 8, marginRight: 4 }}>Assignee:</label>
                  <select
                    value={assignedToFilter}
                    onChange={(e) => setAssignedToFilter(e.target.value)}
                    style={{ fontSize: 12, padding: "2px 6px", borderRadius: 4, border: "1px solid #ccc" }}
                  >
                    <option value="">All</option>
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
          {activeTab === "active" ? (
            <div className="list">
              {rfqs.map((rfq) => (
                <div key={rfq.id} className="list-card" style={{ display: "block" }}>
                  <Link href={`/rfqs/${rfq.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <div className="list-card-header">
                      <div>
                        <h3>{rfq.reference}</h3>
                        <div className="meta">{rfq.subject}</div>
                      </div>
                      <div className="badge-row">
                        <span className="badge dark">{rfq.sourceLabel}</span>
                        <span className={`badge ${rfq.workflowState === "approved" ? "success" : ""}`}>{formatState(rfq.workflowState)}</span>
                        {rfq.rfqPipelineStatus && rfq.rfqPipelineStatus !== "classified" && (
                          <span className="badge">{rfq.rfqPipelineStatus.replace(/_/g, " ")}</span>
                        )}
                        {rfq.slaBreached && <span className="badge" style={{ background: "#fee2e2", color: "#dc2626" }}>Overdue</span>}
                      </div>
                    </div>
                    <div className="meta">{rfq.senderName ?? rfq.senderEmail ?? rfq.sourceLabel}</div>
                    {rfq.senderEmail ? <div className="mono">{rfq.senderEmail}</div> : <div className="hint">No sender email recorded.</div>}
                    <div className="hint">
                      Received {new Date(rfq.receivedAt).toLocaleString()}
                      {rfq.assignedToName ? <span style={{ marginLeft: 8 }}>· Assigned to <strong>{rfq.assignedToName}</strong></span> : <span style={{ marginLeft: 8 }}>· Unassigned</span>}
                      {rfq.expectedResponseBy && <span style={{ marginLeft: 8 }}>· Due {new Date(rfq.expectedResponseBy).toLocaleString()}</span>}
                    </div>
                  </Link>
                  {isAdmin && (
                    <div className="badge-row" style={{ marginTop: 6 }}>
                      <select
                        value={rfq.assignedToId ?? ""}
                        disabled={assigningRfqId === rfq.id}
                        style={{ fontSize: 11, padding: "1px 4px", borderRadius: 4, border: "1px solid #ccc" }}
                        onChange={(e) => { void handleAssign(rfq.id, e.target.value || null); }}
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {!rfqs.length ? (
                isAdmin && setupStatus && !setupStatus.connectorConfigured ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-sm font-medium text-ink mb-1">No RFQs yet</p>
                    <p className="text-xs text-muted mb-3">Connect an email inbox or Slack workspace to start ingesting RFQs automatically.</p>
                    <a href="/connectors/new" className="text-xs font-medium text-accent underline hover:opacity-80">Add a connector →</a>
                  </div>
                ) : (
                  <div className="empty">No active RFQs.</div>
                )
              ) : null}
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
