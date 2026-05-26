"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import type { IntakeEmailInput, RfqListItemView, UserSummary } from "@auto8/shared";

import { WorkspaceShell } from "../components/workspace-shell";
import { createRfqFromEmail, fetchRfqs, fetchUsers } from "../lib/api";
import { useDemoUser } from "../lib/use-demo-user";

const initialIntakeForm: IntakeEmailInput = {
  fromEmail: "buyer@autofleet.example",
  fromName: "Alex Buyer",
  subject: "RFQ: cabin filters for service inventory",
  body: "Please quote 60 cabin filters for next week's service intake.",
  receivedAt: new Date().toISOString()
};

function formatWorkflowState(value: string) {
  return value.replaceAll("_", " ");
}

export default function DashboardPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [rfqs, setRfqs] = useState<RfqListItemView[]>([]);
  const [intakeForm, setIntakeForm] = useState<IntakeEmailInput>(initialIntakeForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { selectedUser, selectedUserId, selectUser } = useDemoUser(users);

  useEffect(() => {
    async function load() {
      try {
        const [nextUsers, nextRfqs] = await Promise.all([fetchUsers(), fetchRfqs()]);
        setUsers(nextUsers);
        setRfqs(nextRfqs);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const stats = useMemo(
    () => ({
      total: rfqs.length,
      pendingApproval: rfqs.filter((rfq) => rfq.workflowState === "pending_approval").length,
      approved: rfqs.filter((rfq) => rfq.workflowState === "approved").length
    }),
    [rfqs]
  );

  async function refreshRfqs() {
    const nextRfqs = await fetchRfqs();
    setRfqs(nextRfqs);
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
      selectedUser={selectedUser}
      selectedUserId={selectedUserId}
      users={users}
      onUserChange={selectUser}
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
                  </div>
                </div>
                <div className="meta">{rfq.senderName ?? rfq.senderEmail ?? rfq.sourceLabel}</div>
                {rfq.senderEmail ? <div className="mono">{rfq.senderEmail}</div> : <div className="hint">No sender email recorded.</div>}
                <div className="hint">Received {new Date(rfq.receivedAt).toLocaleString()}</div>
              </Link>
            ))}
            {!rfqs.length ? <div className="empty">No RFQs yet.</div> : null}
          </div>
        </section>
      </section>
    </WorkspaceShell>
  );
}
