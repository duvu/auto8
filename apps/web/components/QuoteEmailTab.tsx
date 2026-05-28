"use client";

import { useEffect, useState } from "react";

import type { QuoteEmailDraftView } from "@auto8/shared";

import { getQuoteEmail, sendQuoteEmail, updateQuoteEmail } from "../lib/api";

interface Props {
  quoteId: string;
}

export function QuoteEmailTab({ quoteId }: Props) {
  const [draft, setDraft] = useState<QuoteEmailDraftView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local edit state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  useEffect(() => {
    setLoading(true);
    getQuoteEmail(quoteId)
      .then((d) => {
        setDraft(d);
        setSubject(d.subject);
        setBody(d.body);
        setRecipientEmail(d.recipientEmail);
      })
      .catch((e: unknown) => {
        // Draft not found (404) is normal before approval
        if (!(e instanceof Error) || !e.message.includes("not found")) {
          setError(e instanceof Error ? e.message : "Failed to load email draft.");
        }
      })
      .finally(() => setLoading(false));
  }, [quoteId]);

  const hasSentSuccessfully = draft?.sends?.some((s) => s.status === "sent") ?? false;

  async function handleSave() {
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateQuoteEmail(quoteId, { subject, body, recipientEmail });
      setDraft(updated);
      setSuccess("Email draft saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSend() {
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await sendQuoteEmail(quoteId);
      const updated = await getQuoteEmail(quoteId);
      setDraft(updated);
      setSuccess("Email sent successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <p>Loading email draft...</p>;
  }

  if (!draft) {
    return <p>No email draft yet. Approve the quote to generate a draft.</p>;
  }

  return (
    <div className="quote-email-tab">
      {error && <div className="error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="field-group">
        <label>
          To
          <input
            disabled={hasSentSuccessfully}
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
        </label>
        <label>
          Subject
          <input
            disabled={hasSentSuccessfully}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label>
          Body
          <textarea
            disabled={hasSentSuccessfully}
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      </div>

      <div className="actions">
        <button
          className="button-ghost"
          disabled={working || hasSentSuccessfully}
          type="button"
          onClick={() => void handleSave()}
        >
          {working ? "Saving..." : "Save draft"}
        </button>
        <button
          className="button"
          disabled={working}
          type="button"
          onClick={() => void handleSend()}
        >
          {working ? "Sending..." : "Send email"}
        </button>
      </div>

      {draft.sends.length > 0 && (
        <section className="send-history">
          <h4>Send history</h4>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Sent at</th>
                <th>Recipient</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {draft.sends.map((send) => (
                <tr key={send.id}>
                  <td>{send.status}</td>
                  <td>{new Date(send.sentAt).toLocaleString()}</td>
                  <td>{send.recipientEmail}</td>
                  <td>{send.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
