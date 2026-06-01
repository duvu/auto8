import { describe, expect, it, beforeEach, vi } from "vitest";
import { PluginRegistryService } from "./plugin-registry.service";
import type { PluginManifest } from "./plugin.interfaces";

// Mock service classes used as serviceToken (class reference)
class GmailConnectorService {}
class SlackConnectorService {}
class OutlookConnectorService {}

function makeGmailManifest(): PluginManifest {
  return {
    name: "GmailPlugin",
    module: class GmailModule {},
    connector: {
      type: "gmail",
      serviceToken: GmailConnectorService,
      fieldDefs: [],
      syncable: true,
    },
  };
}

function makeSlackManifest(): PluginManifest {
  return {
    name: "SlackPlugin",
    module: class SlackModule {},
    connector: {
      type: "slack",
      serviceToken: SlackConnectorService,
      fieldDefs: [],
      syncable: false,
    },
  };
}

function makeOutlookManifest(): PluginManifest {
  return {
    name: "OutlookPlugin",
    module: class OutlookModule {},
    connector: {
      type: "outlook",
      serviceToken: OutlookConnectorService,
      fieldDefs: [],
      syncable: true,
    },
  };
}

function makeWebhooksManifest(): PluginManifest {
  return {
    name: "WebhooksPlugin",
    module: class WebhooksModule {},
    // no connector
  };
}

function makeRfqsManifest(): PluginManifest {
  return {
    name: "RfqsPlugin",
    module: class RfqsModule {},
    // no connector
  };
}

/**
 * Build a PluginRegistryService with injected manifests and a mock ModuleRef.
 * `resolveToken` controls what moduleRef.get() returns.
 */
function buildService(
  manifests: PluginManifest[],
  resolveToken?: (token: unknown) => unknown,
): PluginRegistryService {
  const moduleRef = {
    get: vi.fn((token: unknown) => {
      if (resolveToken) return resolveToken(token);
      return {};
    }),
  } as never;
  return new PluginRegistryService(manifests, moduleRef);
}

describe("PluginRegistryService", () => {
  // ── onModuleInit / registration ─────────────────────────────────────────────
  describe("onModuleInit", () => {
    it("registers connector plugins from manifests", () => {
      const svc = buildService([makeGmailManifest()]);
      svc.onModuleInit();
      expect(svc.getConnectorPlugin("gmail")).toBeDefined();
    });

    it("throws on duplicate connector type registration", () => {
      const svc = buildService([makeGmailManifest(), makeGmailManifest()]);
      expect(() => svc.onModuleInit()).toThrow(/Duplicate connector type/);
    });

    it("ignores non-connector manifests (no connector field)", () => {
      const svc = buildService([makeWebhooksManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(0);
    });

    it("registers multiple connectors from multiple manifests", () => {
      const svc = buildService([makeGmailManifest(), makeSlackManifest(), makeOutlookManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(3);
    });
  });

  // ── validate() ─────────────────────────────────────────────────────────────
  describe("validate", () => {
    it("throws when a connector serviceToken cannot be resolved", () => {
      const svc = buildService([makeGmailManifest()], () => {
        throw new Error("No provider");
      });
      expect(() => svc.onModuleInit()).toThrow(/cannot be resolved/);
    });

    it("does not throw when all connector serviceTokens resolve successfully", () => {
      const svc = buildService([makeGmailManifest()], () => new GmailConnectorService());
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });

  // ── getConnectorPlugin ──────────────────────────────────────────────────────
  describe("getConnectorPlugin", () => {
    let service: PluginRegistryService;

    beforeEach(() => {
      service = buildService([makeGmailManifest(), makeSlackManifest()]);
      service.onModuleInit();
    });

    it("returns undefined for unregistered type", () => {
      expect(service.getConnectorPlugin("zalo")).toBeUndefined();
    });

    it("returns connector plugin after registration", () => {
      expect(service.getConnectorPlugin("gmail")).toBeDefined();
    });

    it("exposes syncable=true for pull connectors (gmail)", () => {
      expect(service.getConnectorPlugin("gmail")?.syncable).toBe(true);
    });

    it("exposes syncable=false for push-only connectors (slack)", () => {
      expect(service.getConnectorPlugin("slack")?.syncable).toBe(false);
    });

    it("exposes class reference as serviceToken", () => {
      expect(service.getConnectorPlugin("gmail")?.serviceToken).toBe(GmailConnectorService);
    });
  });

  // ── getAllConnectorPlugins ──────────────────────────────────────────────────
  describe("getAllConnectorPlugins", () => {
    it("returns all registered connector plugins", () => {
      const svc = buildService([makeGmailManifest(), makeSlackManifest()]);
      svc.onModuleInit();
      const plugins = svc.getAllConnectorPlugins();
      expect(plugins).toHaveLength(2);
      const types = plugins.map((p) => p.type);
      expect(types).toContain("gmail");
      expect(types).toContain("slack");
    });

    it("returns empty array when no connectors registered", () => {
      const svc = buildService([makeRfqsManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(0);
    });
  });
});
