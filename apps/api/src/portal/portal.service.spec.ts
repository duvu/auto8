import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { PortalService } from "./portal.service";

const mockToken = {
  id: "token-1",
  token: "abc123def456",
  quoteId: "quote-1",
  usedAt: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const mockQuote = {
  id: "quote-1",
  customerName: "John Doe",
  customerCompany: "Acme Corp",
  currency: "USD",
  discount: 0,
  tax: 10,
  grandTotal: 110,
  validityDays: 30,
  notes: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  status: "approved",
  lineItems: [
    {
      id: "li-1",
      description: "Widget A",
      quantity: 2,
      unitPrice: 50,
      subtotal: 100,
      sortOrder: 0,
    },
  ],
};

function makePrisma() {
  return {
    magicLinkToken: {
      create: vi.fn().mockResolvedValue(mockToken),
      findUnique: vi.fn().mockResolvedValue(mockToken),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ ...mockToken, usedAt: new Date() }),
    },
    quote: {
      findUnique: vi.fn().mockResolvedValue(mockQuote),
      update: vi.fn().mockResolvedValue(mockQuote),
    },
    quoteStatusEvent: {
      create: vi.fn().mockResolvedValue({ id: "ev-1" }),
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((key: string, def?: string) => overrides[key] ?? def),
  };
}

describe("PortalService", () => {
  let service: PortalService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PortalService(
      prisma as unknown as PrismaService,
      makeConfig({ FRONTEND_URL: "http://localhost:3000" }) as never,
      { sendPortalRevisionNotification: vi.fn().mockResolvedValue(undefined) } as unknown as EmailService,
    );
  });

  // ── createShareLink ────────────────────────────────────────────────────────
  describe("createShareLink", () => {
    it("creates a MagicLinkToken with 24h expiry", async () => {
      const before = Date.now();
      const result = await service.createShareLink("quote-1");
      const after = Date.now();

      expect(result.url).toContain("/portal/q/");
      expect(result.token).toBeTruthy();

      const createCall = prisma.magicLinkToken.create.mock.calls[0][0] as {
        data: { expiresAt: Date };
      };
      const expiryMs = createCall.data.expiresAt.getTime();
      expect(expiryMs).toBeGreaterThanOrEqual(before + 23.9 * 60 * 60 * 1000);
      expect(expiryMs).toBeLessThanOrEqual(after + 24.1 * 60 * 60 * 1000);
    });

    it("includes FRONTEND_URL in the share URL", async () => {
      const result = await service.createShareLink("quote-1");
      expect(result.url).toMatch(/^http:\/\/localhost:3000\/portal\/q\//);
    });

    it("generates a random token each call", async () => {
      prisma.magicLinkToken.create.mockImplementation(
        ({ data }: { data: { token: string; quoteId: string; expiresAt: Date } }) =>
          Promise.resolve({ ...mockToken, token: data.token }),
      );
      const r1 = await service.createShareLink("quote-1");
      const r2 = await service.createShareLink("quote-1");
      expect(r1.token).not.toBe(r2.token);
    });
  });

  // ── revokeShareLinks ───────────────────────────────────────────────────────
  describe("revokeShareLinks", () => {
    it("deletes all tokens for the given quoteId", async () => {
      await service.revokeShareLinks("quote-1");
      expect(prisma.magicLinkToken.deleteMany).toHaveBeenCalledWith({
        where: { quoteId: "quote-1" },
      });
    });
  });

  // ── getQuoteData ───────────────────────────────────────────────────────────
  describe("getQuoteData", () => {
    it("returns portal view with correct fields", async () => {
      const result = await service.getQuoteData("abc123def456");
      expect(result.customerName).toBe("John Doe");
      expect(result.customerCompany).toBe("Acme Corp");
      expect(result.currency).toBe("USD");
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toBe("Widget A");
      expect(result.lineItems[0].qty).toBe(2);
      expect(result.lineItems[0].unitPrice).toBe(50);
    });

    it("throws 404 when token is expired", async () => {
      prisma.magicLinkToken.findUnique.mockResolvedValue({
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.getQuoteData("abc123def456")).rejects.toThrow(NotFoundException);
    });

    it("throws 404 when token is already used", async () => {
      prisma.magicLinkToken.findUnique.mockResolvedValue({
        ...mockToken,
        usedAt: new Date(),
      });
      await expect(service.getQuoteData("abc123def456")).rejects.toThrow(NotFoundException);
    });

    it("throws 404 when token does not exist", async () => {
      prisma.magicLinkToken.findUnique.mockResolvedValue(null);
      await expect(service.getQuoteData("unknown-token")).rejects.toThrow(NotFoundException);
    });

    it("throws 404 when quote not found", async () => {
      prisma.quote.findUnique.mockResolvedValue(null);
      await expect(service.getQuoteData("abc123def456")).rejects.toThrow(NotFoundException);
    });
  });

  // ── acceptQuote ────────────────────────────────────────────────────────────
  describe("acceptQuote", () => {
    it("updates quote status to customer_accepted and marks token used", async () => {
      await service.acceptQuote("abc123def456");
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it("throws 404 for expired token", async () => {
      prisma.magicLinkToken.findUnique.mockResolvedValue({
        ...mockToken,
        expiresAt: new Date(Date.now() - 1),
      });
      await expect(service.acceptQuote("abc123def456")).rejects.toThrow(NotFoundException);
    });
  });

  // ── rejectQuote ────────────────────────────────────────────────────────────
  describe("rejectQuote", () => {
    it("updates quote status to customer_rejected and marks token used", async () => {
      await service.rejectQuote("abc123def456", "Price too high");
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it("throws 404 for already-used token", async () => {
      prisma.magicLinkToken.findUnique.mockResolvedValue({
        ...mockToken,
        usedAt: new Date(),
      });
      await expect(service.rejectQuote("abc123def456")).rejects.toThrow(NotFoundException);
    });
  });

  // ── requestRevision ────────────────────────────────────────────────────────
  describe("requestRevision", () => {
    it("updates quote status to revision_requested and marks token used", async () => {
      await service.requestRevision("abc123def456", "Add expedited shipping");
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it("throws 404 for expired token", async () => {
      prisma.magicLinkToken.findUnique.mockResolvedValue({
        ...mockToken,
        expiresAt: new Date(Date.now() - 1),
      });
      await expect(service.requestRevision("abc123def456", "note")).rejects.toThrow(NotFoundException);
    });
  });
});
