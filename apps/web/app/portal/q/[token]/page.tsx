"use client";

import { useEffect, useState } from "react";

import type { PortalQuoteView } from "../../../../lib/api";
import {
  getPortalQuoteData,
  portalAcceptQuote,
  portalRejectQuote,
  portalRequestRevision,
} from "../../../../lib/api";

type ActionState = "idle" | "accepted" | "rejected" | "revision";

export default function PortalQuotePage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [quote, setQuote] = useState<PortalQuoteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  useEffect(() => {
    void load();
  }, [token]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPortalQuoteData(token);
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This link has expired or is invalid.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    setActionLoading(true);
    setActionError(null);
    try {
      await portalAcceptQuote(token);
      setActionState("accepted");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    setActionLoading(true);
    setActionError(null);
    try {
      await portalRejectQuote(token, note || undefined);
      setActionState("rejected");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevision() {
    if (!note.trim()) {
      setActionError("Please describe what changes you need.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await portalRequestRevision(token, note);
      setActionState("revision");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <span className="text-xl font-bold text-blue-600">auto8</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading && <p className="text-gray-500">Loading quote...</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && quote && (
          <div className="space-y-6">
            <div className="bg-white border rounded p-6 space-y-2">
              <h1 className="text-xl font-semibold">Quote {quote.reference}</h1>
              <p className="text-sm text-gray-600">
                For {quote.customerName} {quote.customerCompany ? `— ${quote.customerCompany}` : ""}
              </p>
              {quote.validUntil && (
                <p className="text-sm text-gray-500">Valid until {new Date(quote.validUntil).toLocaleDateString()}</p>
              )}
            </div>

            <div className="bg-white border rounded overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left font-medium text-gray-600 py-3 px-4">Description</th>
                    <th className="text-right font-medium text-gray-600 py-3 px-4">Qty</th>
                    <th className="text-right font-medium text-gray-600 py-3 px-4">Unit Price</th>
                    <th className="text-right font-medium text-gray-600 py-3 px-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item: PortalQuoteView['lineItems'][number], i: number) => (
                    <tr key={i} className="border-t">
                      <td className="py-3 px-4">{item.description}</td>
                      <td className="py-3 px-4 text-right">{item.qty}</td>
                      <td className="py-3 px-4 text-right">{item.unitPrice.toLocaleString()} {item.currency}</td>
                      <td className="py-3 px-4 text-right font-medium">{item.total.toLocaleString()} {item.currency}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={3} className="py-2 px-4 text-right text-sm text-gray-600">Subtotal</td>
                    <td className="py-2 px-4 text-right text-sm">{quote.subtotal.toLocaleString()} {quote.currency}</td>
                  </tr>
                  {quote.discount > 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 px-4 text-right text-sm text-gray-600">Discount</td>
                      <td className="py-2 px-4 text-right text-sm text-green-600">-{quote.discount.toLocaleString()} {quote.currency}</td>
                    </tr>
                  )}
                  {quote.tax > 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 px-4 text-right text-sm text-gray-600">Tax</td>
                      <td className="py-2 px-4 text-right text-sm">{quote.tax.toLocaleString()} {quote.currency}</td>
                    </tr>
                  )}
                  <tr className="border-t">
                    <td colSpan={3} className="py-3 px-4 text-right font-semibold">Total</td>
                    <td className="py-3 px-4 text-right font-bold text-lg">{quote.grandTotal.toLocaleString()} {quote.currency}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {quote.notes && (
              <div className="bg-white border rounded p-4 text-sm text-gray-700">
                <p className="font-medium mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {actionState === "accepted" && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded p-4 text-sm font-medium">
                ✓ Quote accepted! We&apos;ll be in touch soon.
              </div>
            )}
            {actionState === "rejected" && (
              <div className="bg-gray-50 border rounded p-4 text-sm text-gray-600">
                Quote has been declined. Thank you for letting us know.
              </div>
            )}
            {actionState === "revision" && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded p-4 text-sm">
                ✓ Revision request sent. We&apos;ll review and get back to you.
              </div>
            )}

            {actionState === "idle" && (
              <div className="space-y-3">
                {actionError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{actionError}</div>
                )}

                {!showRejectForm && !showRevisionForm && (
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => void handleAccept()}
                      disabled={actionLoading}
                      className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading ? "Processing..." : "Accept Quote"}
                    </button>
                    <button
                      onClick={() => { setShowRejectForm(true); setShowRevisionForm(false); setNote(""); }}
                      className="border rounded px-5 py-2 text-sm hover:bg-gray-50"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => { setShowRevisionForm(true); setShowRejectForm(false); setNote(""); }}
                      className="border rounded px-5 py-2 text-sm hover:bg-gray-50"
                    >
                      Request Revision
                    </button>
                  </div>
                )}

                {showRejectForm && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Reason (optional)</p>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Let us know why you&apos;re declining..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleReject()}
                        disabled={actionLoading}
                        className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                      >
                        {actionLoading ? "Submitting..." : "Confirm Decline"}
                      </button>
                      <button
                        onClick={() => { setShowRejectForm(false); setNote(""); setActionError(null); }}
                        className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {showRevisionForm && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">What changes do you need? <span className="text-red-500">*</span></p>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Describe the changes you need..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleRevision()}
                        disabled={actionLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading ? "Submitting..." : "Submit Request"}
                      </button>
                      <button
                        onClick={() => { setShowRevisionForm(false); setNote(""); setActionError(null); }}
                        className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
