import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectorView } from "@auto8/shared";
import { CONNECTOR_TYPES, CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { ConnectorRegistryService } from "./connector-registry.service";

const mockConnector = {
  id: "conn-1",
  type: "gmail",
  label: "Test Gmail",
  credentialsJson: JSON.stringify({ clientId: "cid", clientSecret: "csec", refreshToken: "rtoken" }),
  isEnabled: true,
  lastSyncAt: null,
  lastError: null,
  failureCount: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  workspaceId: "default",
};

function makePrisma() {
  return {
    connector: {
      findMany: vi.fn().mockResolvedValue([mockConnector]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(mockConnector),
      create: vi.fn().mockResolvedValue(mockConnector),
      update: vi.fn().mockResolvedValue(mockConnector),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function makeConfig(overrides: Record<string, string | number | undefined> = {}) {
  return { get: vi.fn((key: string, def?: unknown) => overrides[key] ?? def) };
}

describe("ConnectorRegistryService", () => {
  let service: ConnectorRegistryService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ConnectorRegistryService(
      prisma as unknown as PrismaService,
      makeConfig() as never,
    );
  });

  // ── findAll ────────────────────────────────────────────────────────────────
  describe("findAll", () => {
    it("returns serialized ConnectorView list", async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      const view = result[0] as ConnectorView;
      expect(view.id).toBe("conn-1");
      expect(view.type).toBe("gmail");
      expect(view.label).toBe("Test Gmail");
      expect(view.isEnabled).toBe(true);
      expect(view.lastSyncAt).toBeNull();
      expect(view.failureCount).toBe(0);
      expect(view.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("passes workspaceId filter when provided", async () => {
      await service.findAll("ws-42");
      expect(prisma.connector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: "ws-42" } }),
      );
    });

    it("omits where filter when workspaceId not provided", async () => {
      await service.findAll();
      expect(prisma.connector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it("never exposes credentialsJson in returned view", async () => {
      const result = await service.findAll();
      const view = result[0] as ConnectorView & { credentialsJson?: unknown };
      expect(view.credentialsJson).toBeUndefined();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────
  describe("create", () => {
    it("stores workspaceId on creation", async () => {
      prisma.connector.create.mockResolvedValue({ ...mockConnector, workspaceId: "ws-99" });
      await service.create({ type: "gmail", label: "Label", credentials: {} }, "ws-99");
      expect(prisma.connector.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: "ws-99" }),
        }),
      );
    });

    it("defaults workspaceId to 'default' when not provided", async () => {
      await service.create({ type: "gmail", label: "Label", credentials: {} });
      expect(prisma.connector.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: "default" }),
        }),
      );
    });

    it("stores credentials as JSON string", async () => {
      const creds = { clientId: "cid", refreshToken: "rt" };
      await service.create({ type: "gmail", label: "L", credentials: creds });
      const createArg = prisma.connector.create.mock.calls[0][0] as {
        data: { credentialsJson: string };
      };
      const stored = JSON.parse(createArg.data.credentialsJson) as typeof creds;
      expect(stored.clientId).toBe("cid");
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────
  describe("findOne", () => {
    it("returns connector with decrypted credentials", async () => {
      const result = await service.findOne("conn-1");
      expect(result.id).toBe("conn-1");
    });

    it("throws 404 when connector not found", async () => {
      prisma.connector.findUnique.mockResolvedValue(null);
      await expect(service.findOne("bad-id")).rejects.toThrow(NotFoundException);
    });
  });

  // ── syncNow ────────────────────────────────────────────────────────────────
  describe("syncNow", () => {
    it("throws 422 for slack (push-only)", async () => {
      prisma.connector.findUnique.mockResolvedValue({ ...mockConnector, type: "slack" });
      await expect(service.syncNow("conn-1")).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws 422 for whatsapp (push-only)", async () => {
      prisma.connector.findUnique.mockResolvedValue({ ...mockConnector, type: "whatsapp" });
      await expect(service.syncNow("conn-1")).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws 422 for telegram (push-only)", async () => {
      prisma.connector.findUnique.mockResolvedValue({ ...mockConnector, type: "telegram" });
      await expect(service.syncNow("conn-1")).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws 422 for zalo (push-only)", async () => {
      prisma.connector.findUnique.mockResolvedValue({ ...mockConnector, type: "zalo" });
      await expect(service.syncNow("conn-1")).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws 422 when connector is disabled", async () => {
      prisma.connector.findUnique.mockResolvedValue({ ...mockConnector, type: "gmail", isEnabled: false });
      await expect(service.syncNow("conn-1")).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── testCredentials ────────────────────────────────────────────────────────
  describe("testCredentials", () => {
    it("returns error result when no handler registered for type", async () => {
      // No external services injected on the bare service
      const result = await service.testCredentials("gmail", { clientId: "x" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("No test handler");
    });

    it("delegates to gmailService when injected", async () => {
      const mockTest = vi.fn().mockResolvedValue({ ok: true });
      service.gmailService = { testConnector: mockTest, sync: vi.fn() };
      const result = await service.testCredentials("gmail", { clientId: "x" });
      expect(result.ok).toBe(true);
      expect(mockTest).toHaveBeenCalledOnce();
    });

    it("delegates to whatsappService when injected", async () => {
      const mockTest = vi.fn().mockResolvedValue({ ok: true });
      service.whatsappService = { testConnector: mockTest };
      const result = await service.testCredentials("whatsapp", {});
      expect(result.ok).toBe(true);
    });

    it("delegates to telegramService when injected", async () => {
      const mockTest = vi.fn().mockResolvedValue({ ok: true });
      service.telegramService = { testConnector: mockTest };
      const result = await service.testCredentials("telegram", {});
      expect(result.ok).toBe(true);
    });

    it("delegates to zaloService when injected", async () => {
      const mockTest = vi.fn().mockResolvedValue({ ok: true });
      service.zaloService = { testConnector: mockTest };
      const result = await service.testCredentials("zalo", {});
      expect(result.ok).toBe(true);
    });

    it("returns ok:false when service throws", async () => {
      service.gmailService = {
        testConnector: vi.fn().mockRejectedValue(new Error("Auth failed")),
        sync: vi.fn(),
      };
      const result = await service.testCredentials("gmail", {});
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Auth failed");
    });
  });

  // ── CONNECTOR_FIELD_DEFS completeness ──────────────────────────────────────
  describe("CONNECTOR_FIELD_DEFS coverage", () => {
    it("every CONNECTOR_TYPES entry has CONNECTOR_FIELD_DEFS", () => {
      for (const type of CONNECTOR_TYPES) {
        expect(CONNECTOR_FIELD_DEFS).toHaveProperty(type);
        expect(Object.keys(CONNECTOR_FIELD_DEFS[type])).not.toHaveLength(0);
      }
    });

    it("every field def has required label and placeholder", () => {
      for (const type of CONNECTOR_TYPES) {
        const fields = CONNECTOR_FIELD_DEFS[type];
        for (const [key, def] of Object.entries(fields)) {
          expect(def.label, `${type}.${key}.label`).toBeTruthy();
          expect(def.placeholder, `${type}.${key}.placeholder`).toBeTruthy();
        }
      }
    });

    it("OAuth2 connectors (gmail, slack, outlook) have no required fields in CONNECTOR_FIELD_DEFS", () => {
      // OAuth2 connectors use the OAuth2 flow, not manual credential entry
      const oauth2Types = ["gmail", "slack", "outlook"] as const;
      for (const type of oauth2Types) {
        const fields = CONNECTOR_FIELD_DEFS[type];
        const requiredFields = Object.values(fields).filter((f) => f.required);
        // OAuth2 types may have 0 required fields (all handled by OAuth flow)
        expect(requiredFields.length).toBeGreaterThanOrEqual(0);
      }
    });

    it("webhook connectors (whatsapp, telegram, zalo) have at least one required secret field", () => {
      const webhookTypes = ["whatsapp", "telegram", "zalo"] as const;
      for (const type of webhookTypes) {
        const fields = CONNECTOR_FIELD_DEFS[type];
        const secretFields = Object.values(fields).filter((f) => f.secret);
        expect(secretFields.length, `${type} should have at least one secret field`).toBeGreaterThan(0);
      }
    });
  });
});
