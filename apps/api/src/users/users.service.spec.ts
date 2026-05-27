import { ConflictException, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

const mockUser = {
  id: "user-1",
  email: "test@auto8.dev",
  name: "Test User",
  role: "quote_operator",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function makePrisma() {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([mockUser]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
  };
}

describe("UsersService", () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns all users", async () => {
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe("test@auto8.dev");
      expect(result.data[0].isActive).toBe(true);
    });
  });

  describe("create", () => {
    it("creates a user with hashed password", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: typeof mockUser & { passwordHash: string } }) =>
        Promise.resolve({ ...mockUser, ...data, id: "user-2", createdAt: new Date() })
      );

      const result = await service.create({
        email: "new@auto8.dev",
        name: "New User",
        role: "quote_operator" as const,
        password: "password123",
      });

      expect(result.email).toBe("new@auto8.dev");
      const createCall = prisma.user.create.mock.calls[0][0] as { data: { passwordHash: string } };
      const isHashed = await bcrypt.compare("password123", createCall.data.passwordHash);
      expect(isHashed).toBe(true);
    });

    it("throws 409 if email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create({ email: "test@auto8.dev", name: "Dup", role: "quote_operator" as const, password: "pw" })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("update", () => {
    it("updates user fields", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, name: "Updated Name" });

      const result = await service.update("user-1", { name: "Updated Name" });
      expect(result.name).toBe("Updated Name");
    });

    it("throws 404 if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update("non-existent", { name: "X" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("deactivate", () => {
    it("sets isActive to false", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.deactivate("user-1");
      expect(result.isActive).toBe(false);
    });

    it("throws 404 if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivate("non-existent")).rejects.toThrow(NotFoundException);
    });
  });
});
