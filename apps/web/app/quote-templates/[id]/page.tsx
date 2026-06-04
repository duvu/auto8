"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { QuoteTemplateView } from "@auto8/shared";

import { AppShell } from "../../../components/app-shell";
import {
  QuoteTemplateForm,
  type QuoteTemplateFormValues,
} from "../../../components/quote-template-form";
import { duplicateTemplate, getQuoteTemplate, updateQuoteTemplate } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function EditQuoteTemplatePage() {
  const t = useTranslations("quoteTemplates");
  const authResult = useRequireAuth("admin");
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [template, setTemplate] = useState<QuoteTemplateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<QuoteTemplateFormValues>({
    name: "",
    description: "",
    headerNotes: "",
    paymentTerms: "",
    deliveryTerms: "",
    validityDays: "",
    currency: "USD",
    lineItems: [],
  });

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    getQuoteTemplate(params.id)
      .then((t) => {
        setTemplate(t);
        setValues({
          name: t.name,
          description: t.description ?? "",
          headerNotes: t.headerNotes ?? "",
          paymentTerms: t.paymentTerms ?? "",
          deliveryTerms: t.deliveryTerms ?? "",
          validityDays: t.validityDays != null ? String(t.validityDays) : "",
          currency: t.currency,
          lineItems: t.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            sortOrder: li.sortOrder,
            productId: li.productId ?? undefined,
          })),
        });
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load template"),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      await updateQuoteTemplate(template.id, {
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
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!template) return;
    setDuplicating(true);
    setError(null);
    try {
      const copy = await duplicateTemplate(template.id);
      router.push(`/quote-templates/${copy.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setDuplicating(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <AppShell title="Edit Template">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/quote-templates" className="text-sm text-muted hover:underline">
          ← Back to Templates
        </Link>
        {template && (
          <button
            type="button"
            onClick={() => void handleDuplicate()}
            disabled={duplicating}
            className="btn btn-secondary text-xs"
          >
            {duplicating ? "Duplicating…" : t("duplicate")}
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!loading && template && (
        <QuoteTemplateForm
          values={values}
          onChange={setValues}
          onSubmit={handleSave}
          loading={saving}
          submitLabel="Save Template"
          onCancel={() => router.push("/quote-templates")}
        />
      )}
    </AppShell>
  );
}
