"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "../../../components/app-shell";
import {
  QuoteTemplateForm,
  emptyFormValues,
  type QuoteTemplateFormValues,
} from "../../../components/quote-template-form";
import { createQuoteTemplate } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function NewQuoteTemplatePage() {
  const authResult = useRequireAuth("admin");
  const router = useRouter();

  const [values, setValues] = useState<QuoteTemplateFormValues>(emptyFormValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createQuoteTemplate({
        name: values.name,
        description: values.description || undefined,
        headerNotes: values.headerNotes || undefined,
        paymentTerms: values.paymentTerms || undefined,
        deliveryTerms: values.deliveryTerms || undefined,
        validityDays: values.validityDays ? parseInt(values.validityDays, 10) : undefined,
        currency: values.currency,
        lineItems: values.lineItems,
      });
      router.push("/quote-templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <AppShell title="New Template">
      <div className="mb-4">
        <Link href="/quote-templates" className="text-sm text-muted hover:underline">
          ← Back to Templates
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <QuoteTemplateForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel="Create Template"
        onCancel={() => router.push("/quote-templates")}
      />
    </AppShell>
  );
}
