import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import type { Connector } from "@prisma/client";

import { TelegramConnectorService } from "./telegram-connector.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";
import { PrismaService } from "../prisma/prisma.service";

const mockRfqIntakeService = { classifyAndIntake: vi.fn() };
const mockPrismaService = {
  rfqIntake: { findFirst: vi.fn() },
};

function makeConnector(webhookSecret = "my-secret"): Connector {
  return {
    id: "conn-tg",
    type: "telegram",
    label: "Telegram",
    credentialsJson: JSON.stringify({ botToken: "bot123:ABC", webhookSecret }),
    isEnabled: true,
    lastSyncAt: null,
    lastError: null,
    failureCount: 0,
    workspaceId: "default",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Connector;
}

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TelegramConnectorService,
      { provide: RfqIntakeService, useValue: mockRfqIntakeService },
      { provide: PrismaService, useValue: mockPrismaService },
    ],
  }).compile();

  return moduleRef.get(TelegramConnectorService);
}

describe("TelegramConnectorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateSecret", () => {
    it("throws UnauthorizedException when secret is empty", async () => {
      const service = await buildService();
      const connector = makeConnector("");
      expect(() => service.validateSecret("any-secret", connector)).toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when path secret does not match", async () => {
      const service = await buildService();
      const connector = makeConnector("correct-secret");
      expect(() => service.validateSecret("wrong-secret", connector)).toThrow(UnauthorizedException);
    });

    it("does not throw when secret matches", async () => {
      const service = await buildService();
      const connector = makeConnector("correct-secret");
      expect(() => service.validateSecret("correct-secret", connector)).not.toThrow();
    });
  });

  describe("processUpdate", () => {
    it("returns ok:true for non-message updates without calling intake", async () => {
      const service = await buildService();
      const connector = makeConnector();
      const result = await service.processUpdate({ update_id: 1 }, connector);
      expect(result).toEqual({ ok: true });
      expect(mockRfqIntakeService.classifyAndIntake).not.toHaveBeenCalled();
    });
  });
});
