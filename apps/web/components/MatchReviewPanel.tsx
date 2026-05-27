"use client";

import { useState, useEffect } from "react";
import type { RfqExtractedItemView, RfqItemMatchView } from "@auto8/shared";
import { getMatches, updateMatch, createQuoteFromMatches } from "../lib/api";

interface MatchGroup {
  extractedItem: RfqExtractedItemView;
  matches: RfqItemMatchView[];
}

interface MatchReviewPanelProps {
  rfqId: string;
  onQuoteCreated?: () => void;
}

export function MatchReviewPanel({ rfqId, onQuoteCreated }: MatchReviewPanelProps) {
  const [groups, setGroups] = useState<MatchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMatches(rfqId);
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  const handleAccept = async (matchId: string) => {
    try {
      await updateMatch(rfqId, matchId, "accept");
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to accept match");
    }
  };

  const handleCreateQuote = async () => {
    setCreating(true);
    try {
      await createQuoteFromMatches(rfqId);
      onQuoteCreated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create quote from matches");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading matches...</div>;

  if (groups.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No item matches yet. Matches are generated automatically after extraction completes.
      </div>
    );
  }

  const hasAccepted = groups.some((g) => g.matches.some((m) => m.status === "accepted" || m.status === "overridden"));

  return (
    <div>
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.extractedItem.id} className="border rounded p-3">
            <div className="font-medium text-sm mb-1">
              {g.extractedItem.partNumber && <span className="font-mono text-xs text-gray-500 mr-2">{g.extractedItem.partNumber}</span>}
              {g.extractedItem.description}
              {g.extractedItem.quantity && <span className="ml-2 text-gray-500 text-xs">× {g.extractedItem.quantity} {g.extractedItem.unit ?? ""}</span>}
            </div>

            {g.matches.length === 0 ? (
              <div className="text-xs text-gray-400">No catalogue matches found</div>
            ) : (
              <div className="space-y-1 mt-2">
                {g.matches.map((m) => (
                  <div key={m.id} className={`flex items-center gap-2 text-xs p-2 rounded ${m.status === "accepted" || m.status === "overridden" ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                    <div className="flex-1">
                      <span className="font-medium">{m.product?.productName ?? "Unknown product"}</span>
                      {m.product?.productCode && <span className="ml-1 text-gray-400 font-mono">[{m.product.productCode}]</span>}
                      {m.product?.basePrice != null && (
                        <span className="ml-2 text-gray-600">{m.product.currency} {m.product.basePrice.toFixed(2)}</span>
                      )}
                      <span className="ml-2 text-gray-400">score: {(m.score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex gap-1">
                      {m.status === "pending" && (
                        <button
                          onClick={() => void handleAccept(m.id)}
                          className="bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 text-xs"
                        >
                          Accept
                        </button>
                      )}
                      {(m.status === "accepted" || m.status === "overridden") && (
                        <span className="text-green-600 font-medium">&#10003; {m.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasAccepted && (
        <div className="mt-4">
          <button
            onClick={() => void handleCreateQuote()}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Quote from Matches"}
          </button>
        </div>
      )}
    </div>
  );
}
