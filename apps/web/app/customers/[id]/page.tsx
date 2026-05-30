"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { CustomerView } from "@auto8/shared";

import { WorkspaceShell } from "../../../components/workspace-shell";
import { deleteCustomer, getCustomer, getCustomers, mergeCustomers, updateCustomer } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function CustomerDetailPage() {
  const authResult = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeCandidates, setMergeCandidates] = useState<CustomerView[]>([]);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    getCustomer(params.id)
      .then((c) => {
        setCustomer(c);
        setCompanyName(c.companyName);
        setContactName(c.contactName ?? "");
        setEmail(c.email ?? "");
        setPhone(c.phone ?? "");
        setAddress(c.address ?? "");
        setNotes(c.notes ?? "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load customer"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!showMerge) return;
    getCustomers(mergeSearch || undefined, 1, 20)
      .then((res) => setMergeCandidates(res.data.filter((c) => c.id !== params.id)))
      .catch(() => undefined);
  }, [showMerge, mergeSearch, params.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSaving(true);
    setError(null);
    try {
      await updateCustomer(customer.id, { companyName, contactName: contactName || undefined, email: email || undefined, phone: phone || undefined, address: address || undefined, notes: notes || undefined });
      router.push("/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    if (!confirm(`Delete customer "${customer.companyName}"? This cannot be undone.`)) return;
    try {
      await deleteCustomer(customer.id);
      router.push("/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleMerge = async () => {
    if (!customer || selectedMergeIds.length === 0) return;
    setMerging(true);
    setError(null);
    try {
      await mergeCustomers(customer.id, selectedMergeIds);
      router.push("/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="Customer Details"
      description="View and edit customer information."
      authUser={authResult.user}
      section="Customers"
    >
      <div className="mb-4">
        <Link href="/customers" className="text-sm text-muted hover:underline">
          ← Back to Customers
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!loading && customer && (
        <div className="max-w-xl">
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Contact Name</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input w-full" />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" onClick={() => setShowMerge(!showMerge)} className="btn btn-secondary">
                Merge Into…
              </button>
              {authResult.user?.role === "admin" && (
                <button type="button" onClick={() => void handleDelete()} className="btn btn-secondary text-red-600 ml-auto">
                  Delete
                </button>
              )}
            </div>
          </form>

          {showMerge && (
            <div className="mt-6 p-4 border border-border rounded-lg">
              <h3 className="text-sm font-semibold text-ink mb-3">Merge Duplicates Into This Customer</h3>
              <p className="text-xs text-muted mb-3">
                Selected customers will be deleted and all their quotes/RFQs will be reassigned to <strong>{customer.companyName}</strong>.
              </p>
              <input
                type="text"
                placeholder="Search customers to merge…"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                className="input w-full mb-3"
              />
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {mergeCandidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent-soft px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedMergeIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMergeIds((prev) => [...prev, c.id]);
                        } else {
                          setSelectedMergeIds((prev) => prev.filter((id) => id !== c.id));
                        }
                      }}
                    />
                    <span className="font-medium">{c.companyName}</span>
                    {c.email && <span className="text-muted text-xs">— {c.email}</span>}
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={selectedMergeIds.length === 0 || merging}
                onClick={() => void handleMerge()}
                className="btn btn-primary mt-3"
              >
                {merging ? "Merging…" : `Merge ${selectedMergeIds.length} customer${selectedMergeIds.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
