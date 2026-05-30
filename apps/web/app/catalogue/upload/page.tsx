"use client";

import { useState, useRef } from "react";
import type { CatalogueUploadResult, UploadPreviewResult, UploadPreviewRow } from "@auto8/shared";
import { uploadCatalogue, previewCatalogueUpload } from "../../../lib/api";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Stage = "select" | "preview" | "done";

export default function CatalogueUploadPage() {
  const authResult = useRequireAuth();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<UploadPreviewResult | null>(null);
  const [result, setResult] = useState<CatalogueUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await previewCatalogueUpload(file);
      setPreview(res);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadCatalogue(file);
      setResult(res);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setStage("select");
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const actionColor = (action: UploadPreviewRow["action"]) => {
    if (action === "create") return "text-green-700 bg-green-50";
    if (action === "update") return "text-blue-700 bg-blue-50";
    return "text-gray-500 bg-gray-50";
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell title="Upload Catalogue" description="Import products from a spreadsheet." authUser={authResult.user} section="Catalogue">
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/catalogue" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Catalogue
        </a>
        <h1 className="text-2xl font-bold">Upload Catalogue</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}

      {/* Stage: select file */}
      {stage === "select" && (
        <>
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center">
            <p className="text-gray-500 text-sm mb-3">
              Upload an Excel (.xlsx) or CSV file with product data.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Required columns: productCode, productName. Optional: description, brand, unit, basePrice, currency
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="border border-gray-400 rounded px-4 py-2 text-sm hover:bg-gray-100"
            >
              {file ? file.name : "Choose file"}
            </button>
          </div>

          {file && (
            <button
              onClick={() => void handlePreview()}
              disabled={previewing}
              className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {previewing ? "Previewing..." : "Preview Import"}
            </button>
          )}
        </>
      )}

      {/* Stage: preview */}
      {stage === "preview" && preview && (
        <>
          <div className="mb-4 flex gap-4 text-sm">
            <span className="text-green-700 font-medium">{preview.createCount} to create</span>
            <span className="text-blue-700 font-medium">{preview.updateCount} to update</span>
            <span className="text-gray-500">{preview.skipCount} skipped</span>
          </div>

          <div className="border rounded overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row} className="border-t">
                    <td className="px-3 py-2 text-gray-400">{row.row}</td>
                    <td className="px-3 py-2 font-mono">{row.productCode}</td>
                    <td className="px-3 py-2">{row.productName}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor(row.action)}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{row.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void handleUpload()}
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "Importing..." : `Confirm Import (${preview.createCount + preview.updateCount} products)`}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Stage: done */}
      {stage === "done" && result && (
        <div className="bg-green-50 border border-green-200 rounded p-4 text-sm">
          <p className="font-semibold text-green-700 mb-2">Import complete!</p>
          <p>Imported: <strong>{result.imported}</strong></p>
          <p>Skipped: <strong>{result.skipped}</strong></p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-orange-600 font-medium">Errors ({result.errors.length}):</p>
              <ul className="list-disc list-inside text-orange-600 text-xs mt-1">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <a
              href="/catalogue"
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700"
            >
              View Catalogue
            </a>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
    </WorkspaceShell>
  );
}
