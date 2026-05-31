import { describe, expect, it, beforeEach } from "vitest";
import { PluginRegistryService } from "./plugin-registry.service";
import type { PluginManifest } from "./plugin.interfaces";

function makeGmailManifest(): PluginManifest {
  return {
    name: "GmailPlugin",
    module: class GmailModule {},
    connector: {
      type: "gmail",
      serviceToken: "GmailConnectorService",
      module: class GmailModule {},
      fieldDefs: [],
      syncable: true,
    },
    jobHandlers: [],
    webhookEvents: [],
  };
}

function makeWebhooksManifest(): PluginManifest {
  return {
    name: "WebhooksPlugin",
    module: class WebhooksModule {},
    jobHandlers: [{ type: "webhook_deliver", description: "Deliver outbound webhook" }],
    webhookEvents: [],
  };
}

function makeRfqsManifest(): PluginManifest {
  return {
    name: "RfqsPlugin",
    module: class RfqsModule {},
    jobHandlers: [
      { type: "rfq_extract", description: "Extract RFQ line items" },
      { type: "attachment_parse", description: "Parse attachment" },
    ],
    webhookEvents: ["rfq.created"],
  };
}

function makeQuotesManifest(): PluginManifest {
  return {
    name: "QuotesPlugin",
    module: class QuotesModule {},
    jobHandlers: [{ type: "sheet_export", description: "Export to sheet" }],
    webhookEvents: ["quote.approved", "quote.sent"],
  };
}

describe("PluginRegistryService", () => {
  let service: PluginRegistryService;

  beforeEach(() => {
    service = new PluginRegistryService();
  });

  describe("register", () => {
    it("registers connector plugin and makes it retrievable", () => {
      service.register([makeGmailManifest()]);
      const plugin = service.getConnectorPlugin("gmail");
      expect(plugin).toBeDefined();
      expect(plugin?.type).toBe("gmail");
      expect(plugin?.serviceToken).toBe("GmailConnectorService");
    });

    it("throws on duplicate connector type registration", () => {
      service.register([makeGmailManifest()]);
      expect(() => service.register([makeGmailManifest()])).toThrow(/Duplicate connector type/);
    });

    it("registers manifests without connector (job-only)", () => {
      service.register([makeWebhooksManifest()]);
      expect(service.getAllManifests()).toHaveLength(1);
      expect(service.getConnectorPlugin("webhook" as never)).toBeUndefined();
    });

    it("collects webhook events from multiple manifests without duplicates", () => {
      service.register([makeRfqsManifest(), makeQuotesManifest()]);
      const events = service.getAllWebhookEvents();
      expect(events).toContain("rfq.created");
      expect(events).toContain("quote.approved");
      expect(events).toContain("quote.sent");
      const uniqueSet = new Set(events);
      expect(uniqueSet.size).toBe(events.length);
    });
  });

  describe("getAllConnectorPlugins", () => {
    it("returns all registered connector plugins", () => {
      service.register([
        makeGmailManifest(),
        {
          name: "SlackPlugin",
          module: class SlackModule {},
          connector: {
            type: "slack",
            serviceToken: "SlackConnectorService",
            module: class SlackModule {},
            fieldDefs: [],
            syncable: false,
          },
        },
      ]);
      const plugins = service.getAllConnectorPlugins();
      expect(plugins).toHaveLength(2);
      const types = plugins.map((p) => p.type);
      expect(types).toContain("gmail");
      expect(types).toContain("slack");
    });
  });

  describe("getAllManifests", () => {
    it("returns a copy of all registered manifests", () => {
      const manifests = [makeGmailManifest(), makeWebhooksManifest()];
      service.register(manifests);
      const result = service.getAllManifests();
      expect(result).toHaveLength(2);
      result.push(makeRfqsManifest());
      expect(service.getAllManifests()).toHaveLength(2);
    });
  });

  describe("getConnectorPlugin", () => {
    it("returns undefined for unregistered type", () => {
      expect(service.getConnectorPlugin("nonexistent" as never)).toBeUndefined();
    });

    it("returns connector plugin after registration", () => {
      service.register([makeGmailManifest()]);
      expect(service.getConnectorPlugin("gmail")).toBeDefined();
    });

    it("exposes syncable=true for pull connectors (gmail)", () => {
      service.register([makeGmailManifest()]);
      expect(service.getConnectorPlugin("gmail")?.syncable).toBe(true);
    });

    it("exposes syncable=false for push-only connectors (slack)", () => {
      service.register([
        {
          name: "SlackPlugin",
          module: class SlackModule {},
          connector: {
            type: "slack",
            serviceToken: "SlackConnectorService",
            module: class SlackModule {},
            fieldDefs: [],
            syncable: false,
          },
        },
      ]);
      expect(service.getConnectorPlugin("slack")?.syncable).toBe(false);
    });
  });
});
