"use client";

import { useState, useRef } from "react";
import type { CatalogueUploadResult } from "@auto8/shared";
import { uploadCatalogue } from "../../../lib/api";

export default function CatalogueUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CatalogueUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadCatalogue(file);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <a href="/catalogue" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Catalogue
        </a>
        <h1 className="text-2xl font-bold">Upload Catalogue</h1>
      </div>

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
          onClick={() => void handleUpload()}
          disabled={uploading}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded p-4 text-sm">
          <p className="font-semibold text-green-700 mb-2">Upload complete!</p>
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
        </div>
      )}
    </div>
  );
}
