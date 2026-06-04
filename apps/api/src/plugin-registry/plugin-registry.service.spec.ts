import { describe, expect, it, beforeEach, vi } from "vitest";
import { PluginRegistryService } from "./plugin-registry.service";
import type { ConnectorPluginManifest, ModulePluginManifest, PluginManifest } from "./plugin.interfaces";

// Mock service classes used as serviceToken (class reference)
class GmailConnectorService {}
class SlackConnectorService {}
class OutlookConnectorService {}

function makeGmailManifest(): ConnectorPluginManifest {
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

function makeSlackManifest(): ConnectorPluginManifest {
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

function makeOutlookManifest(): ConnectorPluginManifest {
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

function makeWebhooksManifest(): ModulePluginManifest {
  return {
    name: "WebhooksPlugin",
    module: class WebhooksModule {},
  };
}

function makeRfqsManifest(): ModulePluginManifest {
  return {
    name: "RfqsPlugin",
    module: class RfqsModule {},
  };
}

/**
 * Build a PluginRegistryService with injected manifests and an optional mock ModuleRef.
 * `resolveToken` controls what moduleRef.get() returns.
 */
function buildService(
  manifests: PluginManifest[],
  resolveToken?: (token: unknown) => unknown,
): PluginRegistryService {
  const svc = new PluginRegistryService(manifests);
  const moduleRef = {
    get: vi.fn((token: unknown) => {
      if (resolveToken) return resolveToken(token);
      return {};
    }),
  } as never;
  svc.setModuleRef(moduleRef);
  return svc;
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

    it("ignores non-connector manifests (ModulePluginManifest without connector field)", () => {
      const svc = buildService([makeWebhooksManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(0);
    });

    it("registers multiple connectors from multiple manifests", () => {
      const svc = buildService([makeGmailManifest(), makeSlackManifest(), makeOutlookManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(3);
    });

    it("handles mixed ConnectorPluginManifest and ModulePluginManifest in same array", () => {
      const svc = buildService([makeGmailManifest(), makeWebhooksManifest(), makeRfqsManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(1);
      expect(svc.getConnectorPlugin("gmail")).toBeDefined();
    });
  });

  // ── validate() ─────────────────────────────────────────────────────────────
  describe("validate", () => {
    it("warns (not throws) when a connector serviceToken cannot be resolved", () => {
      const svc = buildService([makeGmailManifest()], () => {
        throw new Error("No provider");
      });
      svc.onModuleInit();
      // validate() warns but does not throw
      expect(() => svc.validate()).not.toThrow();
    });

    it("does not throw when all connector serviceTokens resolve successfully", () => {
      const svc = buildService([makeGmailManifest()], () => new GmailConnectorService());
      svc.onModuleInit();
      expect(() => svc.validate()).not.toThrow();
    });

    it("ModulePluginManifest has no connector entry in registry", () => {
      const svc = buildService([makeWebhooksManifest(), makeRfqsManifest()]);
      svc.onModuleInit();
      expect(svc.getAllConnectorPlugins()).toHaveLength(0);
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

    it("reads syncable correctly from ConnectorPluginManifest", () => {
      const outlookSvc = buildService([makeOutlookManifest()]);
      outlookSvc.onModuleInit();
      expect(outlookSvc.getConnectorPlugin("outlook")?.syncable).toBe(true);
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
