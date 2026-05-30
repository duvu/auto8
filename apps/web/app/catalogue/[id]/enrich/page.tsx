"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { EnrichmentPreviewResponse, CatalogueEnrichmentSuggestionView } from "@auto8/shared";
import { getEnrichmentPreview, triggerCatalogueEnrichment, confirmEnrichment } from "../../../../lib/api";
import { WorkspaceShell } from "../../../../components/workspace-shell";
import { useRequireAuth } from "../../../../lib/use-require-auth";

export default function CatalogueEnrichPage() {
  const authResult = useRequireAuth("admin");
  const params = useParams();
  const router = useRouter();
  const catalogueId = params?.id as string;

  const [preview, setPreview] = useState<EnrichmentPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!catalogueId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEnrichmentPreview(catalogueId);
      setPreview(data);
      setSelected(new Set(data.pending.map((s) => s.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrichment preview");
    } finally {
      setLoading(false);
    }
  }, [catalogueId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function handleTrigger() {
    setTriggering(true);
    setError(null);
    try {
      await triggerCatalogueEnrichment(catalogueId);
      setSuccess("Enrichment job enqueued. Refresh in a few seconds to see suggestions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger enrichment");
    } finally {
      setTriggering(false);
    }
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmEnrichment(catalogueId, { suggestionIds: Array.from(selected) });
      setSuccess(`Applied ${result.confirmed} enrichment suggestion(s) to catalogue.`);
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm enrichment");
    } finally {
      setConfirming(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!preview) return;
    if (selected.size === preview.pending.length) setSelected(new Set());
    else setSelected(new Set(preview.pending.map((s) => s.id)));
  }

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell title="Catalogue Enrichment" description="AI-powered product data enrichment suggestions" authUser={authResult.user} section="Catalogue">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text">AI Enrichment</h2>
            <p className="text-sm text-text-muted mt-1">
              Generate category tags, improved descriptions, and brand detection for your catalogue products.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/catalogue/${catalogueId}`)}
              className="px-4 py-2 text-sm rounded-md border border-border text-text hover:bg-surface-hover"
            >
              Back
            </button>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {triggering ? "Triggering…" : "Run Enrichment"}
            </button>
            <button
              onClick={() => void loadPreview()}
              className="px-4 py-2 text-sm rounded-md border border-border text-text hover:bg-surface-hover"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

        {loading ? (
          <div className="text-sm text-text-muted py-8 text-center">Loading enrichment preview…</div>
        ) : preview && preview.pending.length === 0 ? (
          <div className="text-sm text-text-muted py-8 text-center">
            No pending enrichment suggestions. Click <strong>Run Enrichment</strong> to generate suggestions.
          </div>
        ) : preview ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">{preview.total} pending suggestion(s)</p>
              <div className="flex gap-3">
                <button
                  onClick={toggleAll}
                  className="text-sm text-primary hover:underline"
                >
                  {selected.size === preview.pending.length ? "Deselect all" : "Select all"}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming || selected.size === 0}
                  className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {confirming ? "Applying…" : `Apply selected (${selected.size})`}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {preview.pending.map((item: CatalogueEnrichmentSuggestionView) => {
                const sugg = item.suggestions as Record<string, unknown>;
                const categoryTags = Array.isArray(sugg["categoryTags"]) ? (sugg["categoryTags"] as string[]) : [];
                const improvedDescription = typeof sugg["improvedDescription"] === "string" ? sugg["improvedDescription"] : null;
                const brand = typeof sugg["brand"] === "string" ? sugg["brand"] : null;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-4 space-y-3 ${selected.has(item.id) ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text">{item.productCode}</p>
                        <p className="text-xs text-text-muted">Suggestion ID: {item.id.slice(0, 8)}…</p>
                      </div>
                    </div>

                    {categoryTags.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Category Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {categoryTags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {improvedDescription && (
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Improved Description</p>
                        <p className="text-sm text-text">{improvedDescription}</p>
                      </div>
                    )}

                    {brand && (
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Detected Brand</p>
                        <p className="text-sm text-text">{brand}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
