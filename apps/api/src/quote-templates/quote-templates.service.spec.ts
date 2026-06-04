import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { QuoteTemplatesService } from "./quote-templates.service";

const NOW = new Date("2026-01-01T00:00:00Z");

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "tpl-1",
    name: "Standard Template",
    description: "A test template",
    headerNotes: null,
    paymentTerms: "Net 30",
    deliveryTerms: "FOB",
    validityDays: 30,
    currency: "USD",
    createdById: "user-1",
    workspaceId: "ws-1",
    createdAt: NOW,
    updatedAt: NOW,
    lineItems: [],
    createdBy: { id: "user-1", name: "Admin" },
    ...overrides,
  };
}

function makePrisma() {
  return {
    quoteTemplate: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    quoteTemplateLineItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("QuoteTemplatesService", () => {
  let service: QuoteTemplatesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new QuoteTemplatesService(prisma as unknown as PrismaService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a template without line items", async () => {
      const template = makeTemplate();
      prisma.quoteTemplate.create.mockResolvedValue(template);

      const result = await service.create(
        { name: "Standard Template", currency: "USD" },
        "user-1",
        "ws-1",
      );

      expect(prisma.quoteTemplate.create).toHaveBeenCalledOnce();
      expect(result.name).toBe("Standard Template");
    });

    it("creates a template with nested line items", async () => {
      const template = makeTemplate({
        lineItems: [{ id: "li-1", description: "Widget", quantity: 1, unitPrice: 10, sortOrder: 0, productId: null }],
      });
      prisma.quoteTemplate.create.mockResolvedValue(template);

      const result = await service.create(
        {
          name: "Template With Items",
          currency: "USD",
          lineItems: [{ description: "Widget", quantity: 1, unitPrice: 10 }],
        },
        "user-1",
        "ws-1",
      );

      const createCall = prisma.quoteTemplate.create.mock.calls[0][0] as {
        data: { lineItems?: { create: unknown[] } };
      };
      expect(createCall.data.lineItems?.create).toHaveLength(1);
      expect(result.lineItems).toHaveLength(1);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated templates", async () => {
      const template = makeTemplate();
      prisma.quoteTemplate.findMany.mockResolvedValue([template]);
      prisma.quoteTemplate.count.mockResolvedValue(1);

      const result = await service.findAll({}, "ws-1");

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("applies search filter", async () => {
      prisma.quoteTemplate.findMany.mockResolvedValue([]);
      prisma.quoteTemplate.count.mockResolvedValue(0);

      await service.findAll({ q: "standard" }, "ws-1");

      const call = prisma.quoteTemplate.findMany.mock.calls[0][0] as { where: { OR?: unknown[] } };
      expect(call.where).toHaveProperty("OR");
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns template with line items", async () => {
      const template = makeTemplate({ lineItems: [{ id: "li-1", description: "Widget" }] });
      prisma.quoteTemplate.findFirst.mockResolvedValue(template);

      const result = await service.findOne("tpl-1", "ws-1");

      expect(result.id).toBe("tpl-1");
      expect(result.createdByName).toBe("Admin");
    });

    it("throws 404 when not found", async () => {
      prisma.quoteTemplate.findFirst.mockResolvedValue(null);
      await expect(service.findOne("nonexistent", "ws-1")).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates template fields", async () => {
      const template = makeTemplate();
      const updated = makeTemplate({ name: "Updated Template" });
      prisma.quoteTemplate.findFirst.mockResolvedValue(template);
      prisma.quoteTemplate.update.mockResolvedValue(updated);

      const result = await service.update("tpl-1", { name: "Updated Template" }, "ws-1");

      expect(result.name).toBe("Updated Template");
    });

    it("replaces line items when provided", async () => {
      const template = makeTemplate();
      const updated = makeTemplate({
        lineItems: [{ id: "li-new", description: "New Item", quantity: 2, unitPrice: 20, sortOrder: 0 }],
      });
      prisma.quoteTemplate.findFirst.mockResolvedValue(template);
      prisma.quoteTemplate.update.mockResolvedValue(updated);

      await service.update("tpl-1", { lineItems: [{ description: "New Item", quantity: 2, unitPrice: 20 }] }, "ws-1");

      const updateCall = prisma.quoteTemplate.update.mock.calls[0][0] as {
        data: { lineItems?: { deleteMany: unknown; create: unknown[] } };
      };
      expect(updateCall.data.lineItems?.deleteMany).toBeDefined();
      expect(updateCall.data.lineItems?.create).toHaveLength(1);
    });

    it("throws 404 when not found", async () => {
      prisma.quoteTemplate.findFirst.mockResolvedValue(null);
      await expect(service.update("nonexistent", { name: "X" }, "ws-1")).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes line items first, then template", async () => {
      const template = makeTemplate();
      prisma.quoteTemplate.findFirst.mockResolvedValue(template);
      prisma.quoteTemplate.delete.mockResolvedValue(template);

      await service.remove("tpl-1", "ws-1");

      expect(prisma.quoteTemplateLineItem.deleteMany).toHaveBeenCalledWith({ where: { templateId: "tpl-1" } });
      expect(prisma.quoteTemplate.delete).toHaveBeenCalledWith({ where: { id: "tpl-1" } });
    });

    it("throws 404 when not found", async () => {
      prisma.quoteTemplate.findFirst.mockResolvedValue(null);
      await expect(service.remove("nonexistent", "ws-1")).rejects.toThrow(NotFoundException);
    });
  });

  // ── duplicate ─────────────────────────────────────────────────────────────

  describe("duplicate", () => {
    it("creates a copy with 'Copy of' prefix", async () => {
      const original = makeTemplate({
        lineItems: [{ description: "Widget", quantity: 1, unitPrice: 10, sortOrder: 0, productId: null }],
      });
      const copy = makeTemplate({ id: "tpl-2", name: "Copy of Standard Template" });
      prisma.quoteTemplate.findFirst.mockResolvedValue(original);
      prisma.quoteTemplate.create.mockResolvedValue(copy);

      const result = await service.duplicate("tpl-1", "ws-1");

      const createCall = prisma.quoteTemplate.create.mock.calls[0][0] as { data: { name: string } };
      expect(createCall.data.name).toBe("Copy of Standard Template");
      expect(result.id).toBe("tpl-2");
    });
  });
});
