/**
 * Tests for:
 *   4.8 — template application in saveDraft (templateId merges template defaults into input)
 *         price suggestion logic (basePrice × (1 + defaultMarkup / 100))
 */
import { describe, expect, it } from "vitest";

// ── price suggestion helper (mirrors the frontend / shared logic) ──────────

function suggestedPrice(basePrice: number | null, defaultMarkup: number): number | null {
  if (basePrice === null || basePrice === undefined) return null;
  return basePrice * (1 + defaultMarkup / 100);
}

describe("Price suggestion logic", () => {
  it("returns basePrice when markup is 0", () => {
    expect(suggestedPrice(100, 0)).toBe(100);
  });

  it("applies 20% markup correctly", () => {
    expect(suggestedPrice(100, 20)).toBe(120);
  });

  it("applies 15.5% markup correctly", () => {
    expect(suggestedPrice(200, 15.5)).toBeCloseTo(231);
  });

  it("returns null when basePrice is null", () => {
    expect(suggestedPrice(null, 20)).toBeNull();
  });

  it("returns 0 when basePrice is 0", () => {
    expect(suggestedPrice(0, 50)).toBe(0);
  });
});

// ── template application logic (mirrors quote-workflow.service.ts saveDraft) ─

interface TemplateDefaults {
  paymentTerms: string | null;
  deliveryTerms: string | null;
  validityDays: number | null;
  currency: string;
  headerNotes: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    sortOrder: number;
    productId: string | null;
  }>;
}

interface QuoteInput {
  customerName: string;
  customerCompany: string;
  currency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  notes?: string;
  templateId?: string;
  customerId?: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; productId?: string }>;
}

/** Mirrors the merging logic in QuoteWorkflowService.saveDraft */
function applyTemplateDefaults(input: QuoteInput, template: TemplateDefaults): QuoteInput {
  return {
    ...input,
    paymentTerms: input.paymentTerms ?? template.paymentTerms ?? undefined,
    deliveryTerms: input.deliveryTerms ?? template.deliveryTerms ?? undefined,
    validityDays: input.validityDays ?? template.validityDays ?? undefined,
    currency: input.currency ?? template.currency,
    notes: input.notes ?? template.headerNotes ?? undefined,
    lineItems:
      input.lineItems.length > 0
        ? input.lineItems
        : template.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            productId: li.productId ?? undefined,
          })),
  };
}

const baseTemplate: TemplateDefaults = {
  paymentTerms: "Net 30",
  deliveryTerms: "FOB Warehouse",
  validityDays: 30,
  currency: "VND",
  headerNotes: "Thank you for your inquiry.",
  lineItems: [
    { description: "Widget A", quantity: 1, unitPrice: 50, sortOrder: 0, productId: "prod-1" },
    { description: "Widget B", quantity: 2, unitPrice: 25, sortOrder: 1, productId: null },
  ],
};

const baseInput: QuoteInput = {
  customerName: "Jane",
  customerCompany: "Acme",
  lineItems: [],
};

describe("Template application in saveDraft", () => {
  it("copies template paymentTerms when input has none", () => {
    const result = applyTemplateDefaults(baseInput, baseTemplate);
    expect(result.paymentTerms).toBe("Net 30");
  });

  it("preserves input paymentTerms over template", () => {
    const input: QuoteInput = { ...baseInput, paymentTerms: "Due on receipt" };
    const result = applyTemplateDefaults(input, baseTemplate);
    expect(result.paymentTerms).toBe("Due on receipt");
  });

  it("copies template deliveryTerms when input has none", () => {
    const result = applyTemplateDefaults(baseInput, baseTemplate);
    expect(result.deliveryTerms).toBe("FOB Warehouse");
  });

  it("copies template validityDays when input has none", () => {
    const result = applyTemplateDefaults(baseInput, baseTemplate);
    expect(result.validityDays).toBe(30);
  });

  it("copies template currency when input has none", () => {
    const result = applyTemplateDefaults(baseInput, baseTemplate);
    expect(result.currency).toBe("VND");
  });

  it("preserves input currency over template", () => {
    const input: QuoteInput = { ...baseInput, currency: "EUR" };
    const result = applyTemplateDefaults(input, baseTemplate);
    expect(result.currency).toBe("EUR");
  });

  it("copies headerNotes as notes when input notes is absent", () => {
    const result = applyTemplateDefaults(baseInput, baseTemplate);
    expect(result.notes).toBe("Thank you for your inquiry.");
  });

  it("uses template line items when input has no line items", () => {
    const result = applyTemplateDefaults(baseInput, baseTemplate);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0].description).toBe("Widget A");
    expect(result.lineItems[0].productId).toBe("prod-1");
    expect(result.lineItems[1].productId).toBeUndefined();
  });

  it("keeps input line items when provided (ignores template items)", () => {
    const input: QuoteInput = {
      ...baseInput,
      lineItems: [{ description: "Custom Part", quantity: 3, unitPrice: 99 }],
    };
    const result = applyTemplateDefaults(input, baseTemplate);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toBe("Custom Part");
  });

  it("does not override null template fields with undefined", () => {
    const templateWithNulls: TemplateDefaults = {
      ...baseTemplate,
      paymentTerms: null,
      deliveryTerms: null,
      validityDays: null,
      headerNotes: null,
    };
    const result = applyTemplateDefaults(baseInput, templateWithNulls);
    expect(result.paymentTerms).toBeUndefined();
    expect(result.deliveryTerms).toBeUndefined();
    expect(result.validityDays).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("preserves exchangeRate from input unchanged", () => {
    const input: QuoteInput = { ...baseInput, exchangeRate: 23000 };
    const result = applyTemplateDefaults(input, baseTemplate);
    expect(result.exchangeRate).toBe(23000);
  });

  it("preserves customerId from input unchanged", () => {
    const input: QuoteInput = { ...baseInput, customerId: "cust-42" };
    const result = applyTemplateDefaults(input, baseTemplate);
    expect(result.customerId).toBe("cust-42");
  });
});
