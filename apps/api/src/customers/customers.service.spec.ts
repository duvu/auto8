import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { CustomersService } from "./customers.service";

const NOW = new Date("2026-01-01T00:00:00Z");

function makeCustomer(overrides: Partial<{
  id: string; companyName: string; contactName: string | null; email: string | null;
  phone: string | null; address: string | null; notes: string | null;
  workspaceId: string; createdAt: Date; updatedAt: Date;
}> = {}) {
  return {
    id: "cust-1",
    companyName: "Acme Corp",
    contactName: "Jane",
    email: "jane@acme.com",
    phone: "+1555",
    address: "123 Main St",
    notes: null,
    workspaceId: "ws-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePrisma() {
  return {
    customer: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    quote: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    rfqExtractedCustomer: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("CustomersService", () => {
  let service: CustomersService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CustomersService(prisma as unknown as PrismaService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a customer and serializes it", async () => {
      const customer = makeCustomer();
      prisma.customer.create.mockResolvedValue(customer);

      const result = await service.create({ companyName: "Acme Corp" }, "ws-1");

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { companyName: "Acme Corp", workspaceId: "ws-1" },
      });
      expect(result.id).toBe("cust-1");
      expect(result.companyName).toBe("Acme Corp");
      expect(result.createdAt).toBe(NOW.toISOString());
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated customers", async () => {
      const customer = { ...makeCustomer(), _count: { quotes: 2 } };
      prisma.customer.findMany.mockResolvedValue([customer]);
      prisma.customer.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, "ws-1");

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].quoteCount).toBe(2);
    });

    it("filters by search query", async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll({ q: "acme", page: 1, limit: 20 }, "ws-1");

      const call = prisma.customer.findMany.mock.calls[0][0] as { where: { OR?: unknown[] } };
      expect(call.where).toHaveProperty("OR");
    });

    it("returns empty list when no customers", async () => {
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns customer with quotes and rfqs", async () => {
      const customer = {
        ...makeCustomer(),
        _count: { quotes: 1 },
        quotes: [{ id: "q-1", customerName: "Jane", status: "draft", createdAt: NOW, grandTotal: 100, currency: "USD" }],
        extractedCustomers: [{ id: "ec-1", rfq: { id: "rfq-1", reference: "REF-1", createdAt: NOW }, createdAt: NOW }],
      };
      prisma.customer.findUnique.mockResolvedValue(customer);

      const result = await service.findOne("cust-1");

      expect(result.id).toBe("cust-1");
      expect(result.quotes).toHaveLength(1);
      expect(result.rfqs).toHaveLength(1);
    });

    it("throws 404 when not found", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.findOne("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates and returns serialized customer", async () => {
      const original = makeCustomer();
      const updated = makeCustomer({ companyName: "Updated Corp" });
      prisma.customer.findUnique.mockResolvedValue(original);
      prisma.customer.update.mockResolvedValue(updated);

      const result = await service.update("cust-1", { companyName: "Updated Corp" });

      expect(result.companyName).toBe("Updated Corp");
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: { companyName: "Updated Corp" },
      });
    });

    it("throws 404 when not found", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.update("nonexistent", { companyName: "X" })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("nulls out FKs and deletes customer", async () => {
      const customer = makeCustomer();
      prisma.customer.findUnique.mockResolvedValue(customer);

      await service.remove("cust-1");

      expect(prisma.quote.updateMany).toHaveBeenCalledWith({
        where: { customerId: "cust-1" },
        data: { customerId: null },
      });
      expect(prisma.rfqExtractedCustomer.updateMany).toHaveBeenCalledWith({
        where: { customerId: "cust-1" },
        data: { customerId: null },
      });
      expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: "cust-1" } });
    });

    it("throws 404 when not found", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.remove("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  // ── merge ─────────────────────────────────────────────────────────────────

  describe("merge", () => {
    it("reassigns FKs from merged customers to primary and deletes merged", async () => {
      const primary = makeCustomer({ id: "primary-1" });
      const dup = makeCustomer({ id: "dup-1", companyName: "Duplicate Corp" });

      // findOne is called once for the primary result at the end
      prisma.customer.findUnique
        .mockResolvedValueOnce(primary)   // validate primary exists
        .mockResolvedValueOnce(dup)       // validate dup exists
        .mockResolvedValueOnce({          // final findOne result
          ...primary,
          _count: { quotes: 1 },
          quotes: [],
          extractedCustomers: [],
        });

      await service.merge("primary-1", ["dup-1"]);

      expect(prisma.quote.updateMany).toHaveBeenCalledWith({
        where: { customerId: "dup-1" },
        data: { customerId: "primary-1" },
      });
      expect(prisma.rfqExtractedCustomer.updateMany).toHaveBeenCalledWith({
        where: { customerId: "dup-1" },
        data: { customerId: "primary-1" },
      });
      expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: "dup-1" } });
    });

    it("throws 404 when primary not found", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.merge("nonexistent", ["dup-1"])).rejects.toThrow(NotFoundException);
    });

    it("throws 404 when a merge target not found", async () => {
      const primary = makeCustomer({ id: "primary-1" });
      prisma.customer.findUnique
        .mockResolvedValueOnce(primary)  // primary exists
        .mockResolvedValueOnce(null);    // dup not found
      await expect(service.merge("primary-1", ["nonexistent"])).rejects.toThrow(NotFoundException);
    });
  });
});
