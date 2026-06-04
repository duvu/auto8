import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Connector } from "@prisma/client";

import { WhatsappConnectorService } from "./whatsapp-connector.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";
import { PrismaService } from "../prisma/prisma.service";

const mockRfqIntakeService = { classifyAndIntake: vi.fn() };
const mockPrismaService = {
  rfqIntake: { findFirst: vi.fn() },
  connector: { findFirst: vi.fn() },
};

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "conn-1",
    type: "whatsapp",
    label: "WhatsApp",
    credentialsJson: JSON.stringify({ appSecret: "test-secret", verifyToken: "test-verify", accessToken: "token", phoneNumberId: "123" }),
    isEnabled: true,
    lastSyncAt: null,
    lastError: null,
    failureCount: 0,
    workspaceId: "default",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Connector;
}

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      WhatsappConnectorService,
      { provide: RfqIntakeService, useValue: mockRfqIntakeService },
      { provide: PrismaService, useValue: mockPrismaService },
    ],
  }).compile();

  return moduleRef.get(WhatsappConnectorService);
}

describe("WhatsappConnectorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifySignature", () => {
    it("throws UnauthorizedException when app secret is missing", async () => {
      const service = await buildService();
      const connector = makeConnector({ credentialsJson: JSON.stringify({}) });
      expect(() => service.verifySignature({}, "payload", connector)).toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when signature does not match", async () => {
      const service = await buildService();
      const connector = makeConnector();
      expect(() =>
        service.verifySignature({ "x-hub-signature-256": "sha256=bad" }, "payload", connector),
      ).toThrow(UnauthorizedException);
    });

    it("accepts a valid HMAC-SHA256 signature", async () => {
      const { createHmac } = await import("node:crypto");
      const service = await buildService();
      const appSecret = "test-secret";
      const rawPayload = '{"entry":[]}';
      const sig = `sha256=${createHmac("sha256", appSecret).update(rawPayload).digest("hex")}`;
      const connector = makeConnector({ credentialsJson: JSON.stringify({ appSecret }) });
      expect(() => service.verifySignature({ "x-hub-signature-256": sig }, rawPayload, connector)).not.toThrow();
    });
  });

  describe("verifyChallenge", () => {
    it("throws ForbiddenException when mode is not subscribe", async () => {
      const service = await buildService();
      const connector = makeConnector();
      expect(() => service.verifyChallenge(connector, "unsubscribe", "test-verify", "ch123")).toThrow(ForbiddenException);
    });

    it("throws ForbiddenException when token does not match", async () => {
      const service = await buildService();
      const connector = makeConnector();
      expect(() => service.verifyChallenge(connector, "subscribe", "wrong-token", "ch123")).toThrow(ForbiddenException);
    });

    it("returns challenge when verification passes", async () => {
      const service = await buildService();
      const connector = makeConnector();
      expect(service.verifyChallenge(connector, "subscribe", "test-verify", "ch123")).toBe("ch123");
    });
  });
});
