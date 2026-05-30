"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Link from "next/link";

import { WorkspaceShell } from "../../../components/workspace-shell";
import { createCustomer } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function NewCustomerPage() {
  const authResult = useRequireAuth();
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCustomer({
        companyName,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
      router.push("/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="New Customer"
      description="Add a customer to your address book."
      authUser={authResult.user}
      section="Customers"
    >
      <div className="mb-4">
        <Link href="/customers" className="text-sm text-muted hover:underline">
          ← Back to Customers
        </Link>
      </div>

      <div className="max-w-xl">
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Company Name *</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Acme Corp"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Contact Name</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="123 Main St, City, Country" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional notes…" className="input w-full" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : "Create Customer"}
            </button>
            <Link href="/customers" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}
