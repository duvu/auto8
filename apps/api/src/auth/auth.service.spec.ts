import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

function makeJwtService() {
  return {
    sign: vi.fn().mockReturnValue("mock-jwt-token"),
  };
}

function makeConfigService() {
  return {
    get: vi.fn((key: string, defaultVal?: unknown) => {
      if (key === "JWT_REFRESH_EXPIRES_IN") return "7d";
      return defaultVal;
    }),
  };
}

function makePrisma() {
  return {
    user: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("AuthService", () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;
  let jwtService: ReturnType<typeof makeJwtService>;
  let configService: ReturnType<typeof makeConfigService>;

  beforeEach(() => {
    prisma = makePrisma();
    jwtService = makeJwtService();
    configService = makeConfigService();
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it("returns accessToken + refreshToken on successful login", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@auto8.dev",
      role: "admin",
      isActive: true,
      passwordHash: hash,
    });

    const result = await service.login("admin@auto8.dev", "correct-password");
    expect(result.accessToken).toBe("mock-jwt-token");
    expect(typeof result.refreshToken).toBe("string");
    expect(result.refreshToken.length).toBeGreaterThan(10);
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: "user-1",
      role: "admin",
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it("throws 401 on wrong password", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@auto8.dev",
      role: "admin",
      isActive: true,
      passwordHash: hash,
    });

    await expect(service.login("admin@auto8.dev", "wrong-password")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws 401 on deactivated user", async () => {
    const hash = await bcrypt.hash("password", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "inactive@auto8.dev",
      role: "quote_operator",
      isActive: false,
      passwordHash: hash,
    });

    await expect(service.login("inactive@auto8.dev", "password")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws 401 when user not found", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login("nobody@auto8.dev", "password")).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
