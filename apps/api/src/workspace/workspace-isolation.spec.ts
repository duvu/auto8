/**
 * Workspace isolation smoke checks.
 *
 * These unit tests verify that services that received workspaceId scoping
 * in MVP3/MVP4 correctly filter by workspaceId on reads and set it on writes.
 * They do NOT verify DB-level isolation (that requires integration tests with
 * a real DB), but they confirm the service-layer contract is in place.
 */
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { CustomersService } from "../customers/customers.service";
import { ConnectorRegistryService } from "../connector-registry/connector-registry.service";
import { PluginRegistryService } from "../plugin-registry/plugin-registry.service";

// ── Customers isolation ────────────────────────────────────────────────────

const mockCustomer = {
  id: "cust-1",
  companyName: "Acme Corp",
  contactName: "John",
  email: "john@acme.com",
  phone: null,
  address: null,
  notes: null,
  workspaceId: "ws-A",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { quotes: 0 },
};

function makeCustomerPrisma() {
  return {
    customer: {
      findMany: vi.fn().mockResolvedValue([mockCustomer]),
      findUnique: vi.fn().mockResolvedValue(mockCustomer),
      create: vi.fn().mockResolvedValue(mockCustomer),
      update: vi.fn().mockResolvedValue(mockCustomer),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(1),
    },
  };
}

describe("CustomersService — workspace isolation", () => {
  let service: CustomersService;
  let prisma: ReturnType<typeof makeCustomerPrisma>;

  beforeEach(() => {
    prisma = makeCustomerPrisma();
    service = new CustomersService(prisma as unknown as PrismaService);
  });

  it("findAll passes workspaceId filter to Prisma when provided", async () => {
    await service.findAll({ page: 1, limit: 20 }, "ws-A");

    const call = prisma.customer.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({ workspaceId: "ws-A" });
  });

  it("findAll does NOT filter by workspaceId when omitted (admin cross-workspace)", async () => {
    await service.findAll({ page: 1, limit: 20 });

    const call = prisma.customer.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    // workspaceId should not appear in where clause
    expect(call.where).not.toHaveProperty("workspaceId");
  });

  it("findAll with search query includes workspaceId in OR clause", async () => {
    await service.findAll({ page: 1, limit: 20, q: "acme" }, "ws-A");

    const call = prisma.customer.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toHaveProperty("workspaceId", "ws-A");
  });

  it("create sets workspaceId from parameter", async () => {
    await service.create({ companyName: "New Corp" }, "ws-B");

    const call = prisma.customer.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toHaveProperty("workspaceId", "ws-B");
  });

  it("create defaults workspaceId to 'default' when not provided", async () => {
    await service.create({ companyName: "New Corp" });

    const call = prisma.customer.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toHaveProperty("workspaceId", "default");
  });
});

// ── ConnectorRegistryService isolation ────────────────────────────────────

const mockConnector = {
  id: "conn-1",
  type: "gmail",
  label: "Sales",
  credentialsJson: "{}",
  isEnabled: true,
  lastSyncAt: null,
  lastError: null,
  failureCount: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  workspaceId: "ws-A",
};

function makeConnectorPrisma() {
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

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  return { get: vi.fn((key: string, def?: unknown) => overrides[key] ?? def) };
}

describe("ConnectorRegistryService — workspace isolation", () => {
  let service: ConnectorRegistryService;
  let prisma: ReturnType<typeof makeConnectorPrisma>;

  beforeEach(() => {
    prisma = makeConnectorPrisma();
    const mockPluginRegistry = {
      getConnectorPlugin: vi.fn().mockReturnValue(null),
      getAllConnectorPlugins: vi.fn().mockReturnValue([]),
      getAllWebhookEvents: vi.fn().mockReturnValue([]),
      getAllManifests: vi.fn().mockReturnValue([]),
      validate: vi.fn(),
      register: vi.fn(),
    } as unknown as PluginRegistryService;
    const mockModuleRef = { get: vi.fn().mockReturnValue(null) };
    service = new ConnectorRegistryService(
      prisma as unknown as PrismaService,
      makeConfig() as never,
      mockPluginRegistry,
      mockModuleRef as never,
    );
  });

  it("findAll passes workspaceId where clause when provided", async () => {
    await service.findAll("ws-A");

    const call = prisma.connector.findMany.mock.calls[0][0] as {
      where?: Record<string, unknown>;
    };
    expect(call.where).toEqual({ workspaceId: "ws-A" });
  });

  it("findAll uses undefined where clause when no workspaceId provided", async () => {
    await service.findAll();

    const call = prisma.connector.findMany.mock.calls[0][0] as {
      where?: unknown;
    };
    expect(call.where).toBeUndefined();
  });

  it("create sets workspaceId from parameter", async () => {
    await service.create({ type: "gmail", label: "L", credentials: {} }, "ws-B");

    const call = prisma.connector.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toHaveProperty("workspaceId", "ws-B");
  });

  it("create defaults workspaceId to 'default'", async () => {
    await service.create({ type: "gmail", label: "L", credentials: {} });

    const call = prisma.connector.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toHaveProperty("workspaceId", "default");
  });
});

// ── WorkspaceService isolation (findById guard) ────────────────────────────
import { WorkspaceService } from "../workspace/workspace.service";

const mockWorkspace = {
  id: "ws-A",
  name: "Workspace A",
  slug: "workspace-a",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function makeWorkspacePrisma() {
  return {
    workspace: {
      findUnique: vi.fn().mockResolvedValue(mockWorkspace),
      findMany: vi.fn().mockResolvedValue([mockWorkspace]),
      create: vi.fn().mockResolvedValue(mockWorkspace),
      update: vi.fn().mockResolvedValue(mockWorkspace),
    },
  };
}

describe("WorkspaceService — isolation guards", () => {
  let service: WorkspaceService;
  let prisma: ReturnType<typeof makeWorkspacePrisma>;

  beforeEach(() => {
    prisma = makeWorkspacePrisma();
    service = new WorkspaceService(prisma as unknown as PrismaService);
  });

  it("findById throws 404 when workspace not found", async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
  });

  it("findById returns workspace when found", async () => {
    const result = await service.findById("ws-A");
    expect(result.id).toBe("ws-A");
    expect(result.name).toBe("Workspace A");
  });

  it("create persists new workspace", async () => {
    prisma.workspace.create.mockResolvedValue({ ...mockWorkspace, id: "ws-B", name: "Workspace B" });
    const result = await service.create({ name: "Workspace B", slug: "workspace-b" });
    expect(result.name).toBe("Workspace B");
    expect(prisma.workspace.create).toHaveBeenCalledOnce();
  });
});
