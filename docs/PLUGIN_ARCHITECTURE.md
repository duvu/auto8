# Plugin Architecture

auto8 uses a manifest-based plugin system for extending inbound channel connectors, background job handlers, and outbound webhook events — without touching central infrastructure files.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Plugin Anatomy](#plugin-anatomy)
3. [Plugin Types](#plugin-types)
4. [How the Registry Works](#how-the-registry-works)
5. [Existing Plugins](#existing-plugins)
6. [How to Add a Connector Plugin](#how-to-add-a-connector-plugin)
7. [How to Add a Job-Handler Plugin](#how-to-add-a-job-handler-plugin)
8. [Shared Type Contracts](#shared-type-contracts)
9. [Verification](#verification)

---

## Core Concepts

A **plugin** is a NestJS module plus a plain `PluginManifest` object that declares what the module provides:

- A **connector** — handles inbound messages from an external channel (Gmail, Slack, Zalo, etc.)
- **Job handlers** — background jobs this module processes (e.g. `rfq_extract`, `webhook_deliver`)
- **Webhook events** — outbound events this module emits (e.g. `rfq.created`, `quote.approved`)

These declarations are structural metadata only — they do not wire anything at runtime by themselves. Their purpose is:

1. Let `PluginRegistryModule` import the module class into the NestJS DI graph
2. Let `ConnectorRegistryService` resolve the right service at call time
3. Let `verify:contracts` confirm that every declared type is actually implemented

---

## Plugin Anatomy

### The manifest object

```ts
// apps/api/src/zalo/zalo.plugin.ts
import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";
import type { PluginManifest } from "../plugin-registry/plugin.interfaces";
import { ZaloModule } from "./zalo.module";

export const ZaloPlugin: PluginManifest = {
  name: "zalo",
  module: ZaloModule,
  connector: {
    type: "zalo",
    serviceToken: "ZaloConnectorService",
    module: ZaloModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["zalo"],
  },
  jobHandlers: [],
  webhookEvents: [],
};
```

### The manifest interfaces

```ts
// apps/api/src/plugin-registry/plugin.interfaces.ts

interface ConnectorPlugin {
  type: ConnectorType;        // must match CONNECTOR_TYPES in @auto8/shared
  serviceToken: string;       // NestJS provider token — must match the class name
  module: Type<unknown>;      // the NestJS module class
  fieldDefs: ConnectorFieldDef[]; // credential fields rendered by the UI form
}

interface JobHandlerDeclaration {
  type: string;        // must match the string passed to JobsService.registerHandler()
  description: string; // human label — used by verify:contracts
}

interface PluginManifest {
  name: string;                          // human label — unique across plugins
  module: Type<unknown>;                 // the NestJS module class to be imported
  connector?: ConnectorPlugin;           // present when this plugin handles a channel
  jobHandlers?: JobHandlerDeclaration[]; // present when this module registers job handlers
  webhookEvents?: string[];              // present when this module emits webhook events
}
```

### Registration in AppModule

```ts
// apps/api/src/app.module.ts
PluginRegistryModule.register([
  GmailPlugin,
  SlackPlugin,
  OutlookPlugin,
  WhatsappPlugin,
  TelegramPlugin,
  ZaloPlugin,
  WebhooksPlugin,
  RfqsPlugin,
  QuotesPlugin,
])
```

This is the **only** central file that needs to change when adding a new plugin.

---

## Plugin Types

### 1. Connector plugin

A connector plugin handles inbound messages from an external messaging channel and converts them into `RfqIntake` records via `RfqIntakeService`.

**Required pieces:**
- A NestJS module class (`XxxModule`)
- A service that implements `ConnectorService` (`XxxConnectorService`)
- A controller that receives webhooks or a `sync()` method for polling
- A `PluginManifest` with a `connector` field
- A `ConnectorFieldDef` entry in `CONNECTOR_FIELD_DEFS` in `@auto8/shared`
- A value in the `RfqSourceType` Prisma enum and `RFQ_SOURCE_TYPES` in `@auto8/shared`
- A value in `CONNECTOR_TYPES` in `@auto8/shared`

**The `ConnectorService` interface:**

```ts
// apps/api/src/connectors/connector.interface.ts
interface ConnectorService {
  isConfigured(): boolean;
  sync(connector: Connector): Promise<ConnectorSyncSummary>;
  testConnector(connector: Connector): Promise<ConnectorTestResult>;
}
```

- `isConfigured()` — return `false` for DB-only connectors (credentials stored in `connector.credentialsJson`); return `true` only for env-var-based legacy connectors
- `sync()` — pull-based connectors implement this; push-only connectors return a no-op summary
- `testConnector()` — validate credentials against the external API; return `{ ok: true }` or `{ ok: false, error: "..." }`

**Push-only vs pull connectors:**

| Connector | Auth | Sync method |
|---|---|---|
| Gmail | OAuth2 | Pull — `sync()` fetches unread |
| Outlook | OAuth2 | Pull — `sync()` fetches unread |
| Slack | HMAC signing secret | Push — webhook receiver |
| WhatsApp | HMAC via `X-Hub-Signature-256` | Push — webhook receiver |
| Telegram | Secret-in-URL | Push — webhook receiver |
| Zalo | HMAC via `mac` field | Push — webhook receiver |

Push-only connectors must return a no-op from `sync()`. `ConnectorRegistryService.syncNow()` will reject push-only types with a 422 before calling `sync()` — but the implementation should be safe to call anyway.

**Credentials pattern:**

Credentials are stored as JSON in `connector.credentialsJson` (encrypted at rest). Parse them in your service:

```ts
const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
const appSecret = creds["appSecret"] ?? "";
```

Never read credentials from environment variables for DB-registered connectors. The `connector.credentialsJson` field is the source of truth.

**Deduplication pattern:**

Use `slackMessageId` (despite the name, reused for all channel message IDs) to prevent duplicate intake:

```ts
const dedupeKey = `zalo_${connector.id}_${messageId}`;
const existing = await this.prisma.rfqIntake.findFirst({
  where: { slackMessageId: dedupeKey },
  select: { id: true },
});
if (existing) return { ok: true };
```

**Normalized intake pattern:**

All connectors convert their channel-specific payload to `NormalizedRfqIntake` before handing off to `RfqIntakeService.createRfqFromIntake()`:

```ts
const intake: NormalizedRfqIntake = {
  sourceType: "zalo",
  sourceLabel: connector.label,
  senderEmail: null,
  senderName: senderId,
  subject: `Zalo message from ${senderId}`,
  body: messageText,
  receivedAt: new Date().toISOString(),
  rawPayload: JSON.stringify(body),
  slackMessageId: dedupeKey,
  connectorId: connector.id,
};
await this.rfqIntakeService.createRfqFromIntake(intake);
```

---

### 2. Job-handler plugin

A job-handler plugin declares and registers background jobs processed by the `JobsService` CRON loop (every 5 seconds).

**Required pieces:**
- A service that calls `JobsService.registerHandler()` in its `onModuleInit()`
- A `PluginManifest` with `jobHandlers` listing the types it registers

**Self-registration pattern:**

```ts
@Injectable()
export class WebhookDeliveryService implements OnModuleInit {
  constructor(private readonly jobsService: JobsService) {}

  onModuleInit(): void {
    this.jobsService.registerHandler("webhook_deliver", async (payload) => {
      // handle the job
    });
  }
}
```

The handler receives `payload: Record<string, unknown>` — cast the fields you need:

```ts
const endpointId = payload["endpointId"] as string;
```

**Enqueue from anywhere:**

```ts
await this.jobsService.enqueue("webhook_deliver", {
  endpointId: endpoint.id,
  event: "rfq.created",
  payload: { rfqId: "..." },
});
```

`JobType` is `string` — no central union to update when adding new job types. The declared `type` in `jobHandlers` must match the string passed to `registerHandler()` exactly. `verify:contracts` checks this.

---

### 3. Webhook-event plugin

A plugin that emits outbound webhook events declares them in `webhookEvents`. This is **declarative only** — it does not wire anything. It exists so `verify:contracts` can enumerate all known events.

**Emitting events at runtime:**

```ts
// inject WebhookEmitterService and call:
await this.webhookEmitter.emit("rfq.created", { rfqId: rfq.id });
```

`WebhookEmitterService` queries all enabled `WebhookEndpoint` records that subscribe to the event and enqueues a `webhook_deliver` job for each one. The `webhookEvents` declaration in the manifest is metadata only — any string can be emitted at any time.

---

## How the Registry Works

### Startup sequence

```
AppModule initializes
    ↓
PluginRegistryModule.register([...plugins]) called
    → DynamicModule returned with:
        imports: [ZaloModule, GmailModule, ..., WebhooksModule, RfqsModule, QuotesModule]
        providers: [PluginRegistryService]
        exports: [PluginRegistryService]
    ↓
NestJS bootstraps all plugin modules (DI graph constructed)
    ↓
PluginRegistryModule.onModuleInit()
    → registry.register([...manifests])
        → for each manifest with connector:
            connectorPlugins.set(type, plugin)
        → collects webhookEvents[]
    → registry.validate()
        → logs declared jobHandlers for discoverability
    ↓
Each plugin module's own onModuleInit() runs
    → e.g. WebhookDeliveryService.registerHandler("webhook_deliver", ...)
    → e.g. RfqExtractionService.registerHandler("rfq_extract", ...)
```

### Runtime connector dispatch

```
POST /connectors/:id/test
    ↓
ConnectorRegistryService.testConnector(id)
    ↓
resolveConnectorService(connector.type)
    ↓
PluginRegistryService.getConnectorPlugin("zalo")
    → returns: { type: "zalo", serviceToken: "ZaloConnectorService", ... }
    ↓
ModuleRef.get("ZaloConnectorService", { strict: false })
    → returns: live ZaloConnectorService instance from NestJS DI
    ↓
service.testConnector(connector)
```

`ModuleRef.get(token, { strict: false })` searches the entire NestJS module graph for a provider matching the token. The token is the **class name as a string** — which is the default NestJS injection token when a class is listed in `providers: [ZaloConnectorService]`.

The registry never imports the service class directly. This is intentional — it means `connector-registry` has zero compile-time dependency on any connector implementation.

### Global availability

`PluginRegistryModule` is decorated `@Global()`. Once registered in `AppModule`, `PluginRegistryService` is injectable everywhere in the application without each module needing to import `PluginRegistryModule` explicitly.

---

## Existing Plugins

| File | Type | Declares |
|---|---|---|
| `gmail/gmail.plugin.ts` | Connector | `type: "gmail"`, `serviceToken: "GmailConnectorService"` |
| `slack/slack.plugin.ts` | Connector | `type: "slack"`, `serviceToken: "SlackConnectorService"` |
| `outlook/outlook.plugin.ts` | Connector | `type: "outlook"`, `serviceToken: "OutlookConnectorService"` |
| `whatsapp/whatsapp.plugin.ts` | Connector | `type: "whatsapp"`, `serviceToken: "WhatsappConnectorService"` |
| `telegram/telegram.plugin.ts` | Connector | `type: "telegram"`, `serviceToken: "TelegramConnectorService"` |
| `zalo/zalo.plugin.ts` | Connector | `type: "zalo"`, `serviceToken: "ZaloConnectorService"` |
| `rfqs/rfqs.plugin.ts` | Job + Event | `rfq_extract`, `attachment_parse` / `rfq.created` |
| `quotes/quotes.plugin.ts` | Job + Event | `sheet_export` / `quote.approved`, `quote.sent` |
| `webhooks/webhooks.plugin.ts` | Job | `webhook_deliver` |

---

## How to Add a Connector Plugin

Use this checklist. Steps are ordered — earlier steps are prerequisites for later ones.

### Step 1 — Shared types

In `packages/shared/src/index.ts`:

1. Add the new type to `CONNECTOR_TYPES`:
   ```ts
   export const CONNECTOR_TYPES = ["gmail", "slack", ..., "line"] as const;
   ```

2. Add the new type to `RFQ_SOURCE_TYPES`:
   ```ts
   export const RFQ_SOURCE_TYPES = [..., "line"] as const;
   ```

3. Add a `ConnectorFieldDef` entry to `CONNECTOR_FIELD_DEFS`:
   ```ts
   line: {
     channelAccessToken: {
       label: "Channel Access Token",
       placeholder: "Paste your Line channel access token",
       description: "Found in Line Developer Console → Messaging API → Channel access token",
       secret: true,
       required: true,
     },
     channelSecret: {
       label: "Channel Secret",
       placeholder: "Paste your Line channel secret",
       description: "Found in Line Developer Console → Basic settings → Channel secret",
       secret: true,
       required: true,
     },
   },
   ```

### Step 2 — Database migration

Add the new source type to the Prisma enum and apply it:

```sql
ALTER TYPE "RfqSourceType" ADD VALUE 'line';
```

Apply to the running container:
```bash
docker exec auto8-postgres-1 psql -U auto8 -d auto8 -c "ALTER TYPE \"RfqSourceType\" ADD VALUE 'line';"
```

Save the SQL in `apps/api/prisma/migrations/<timestamp>_add_line_connector/migration.sql` and update `apps/api/prisma/schema.prisma`.

Regenerate the Prisma client:
```bash
npm run db:generate
```

### Step 3 — Module files

Create `apps/api/src/line/`:

```
line/
  dto/
    line-webhook.dto.ts     # payload type definitions
  line-connector.service.ts # implements ConnectorService
  line.controller.ts        # webhook receiver
  line.module.ts            # NestJS module
  line.plugin.ts            # PluginManifest
```

**`line.module.ts`:**
```ts
@Module({
  imports: [PrismaModule, RfqsModule],
  controllers: [LineController],
  providers: [LineConnectorService],
  exports: [LineConnectorService],
})
export class LineModule {}
```

The module must **export** the service so `ModuleRef.get()` can resolve it across the module graph.

**`line-connector.service.ts`:**
```ts
@Injectable()
export class LineConnectorService implements ConnectorService {
  isConfigured(): boolean { return false; }

  async sync(_connector: Connector): Promise<ConnectorSyncSummary> {
    return { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    // call Line API to verify token
    try {
      const res = await fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${creds["channelAccessToken"]}` },
      });
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
```

**`line.plugin.ts`:**
```ts
import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";
import type { PluginManifest } from "../plugin-registry/plugin.interfaces";
import { LineModule } from "./line.module";

export const LinePlugin: PluginManifest = {
  name: "line",
  module: LineModule,
  connector: {
    type: "line",
    serviceToken: "LineConnectorService",
    module: LineModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["line"],
  },
  jobHandlers: [],
  webhookEvents: [],
};
```

### Step 4 — Register in AppModule

```ts
// apps/api/src/app.module.ts
import { LinePlugin } from "./line/line.plugin";

PluginRegistryModule.register([
  ...,
  LinePlugin,
])
```

That is the only change to a central file.

### Step 5 — Verify

```bash
npm run typecheck
npm run build
npm run verify:contracts
```

All three must pass with zero errors.

---

## How to Add a Job-Handler Plugin

If your new module processes background jobs but is **not** a connector:

1. In your service, implement `OnModuleInit` and call `registerHandler`:
   ```ts
   onModuleInit(): void {
     this.jobsService.registerHandler("my_job_type", async (payload) => {
       const itemId = payload["itemId"] as string;
       await this.processItem(itemId);
     });
   }
   ```

2. In your plugin manifest, declare the job handler:
   ```ts
   export const MyPlugin: PluginManifest = {
     name: "my-feature",
     module: MyModule,
     jobHandlers: [
       { type: "my_job_type", description: "Process items for my feature" },
     ],
   };
   ```

3. Enqueue jobs from any service:
   ```ts
   await this.jobsService.enqueue("my_job_type", { itemId: "123" });
   ```

The `type` string in `jobHandlers` must exactly match the string in `registerHandler()`. `verify:contracts` does not currently cross-check these at runtime, but the declaration serves as documentation and will be validated in future contract checks.

---

## Shared Type Contracts

All cross-layer types live in `packages/shared/src/index.ts`. The ownership rule is:

> **If a type is used in more than one of `apps/api`, `apps/web`, or `packages/shared` — it belongs in `packages/shared`.**

For connector plugins specifically, these shared types are mandatory:

| What | Where in shared | Used by |
|---|---|---|
| Connector type string | `CONNECTOR_TYPES` | Registry, UI form, verify:contracts |
| Source type string | `RFQ_SOURCE_TYPES` | Prisma enum, intake service |
| Credential field definitions | `CONNECTOR_FIELD_DEFS[type]` | UI form, verify:contracts |
| `ConnectorView` | interface | API response, frontend |
| `ConnectorTestResult` | interface | `testConnector()` return type |
| `ConnectorSyncSummary` | interface | `sync()` return type |

Never redeclare these interfaces locally in `apps/api` or `apps/web`. `verify:contracts` will fail if you do.

---

## Verification

Run these three commands before committing any plugin work:

```bash
npm run typecheck        # zero type errors across api + web + shared
npm run build            # all packages compile and all Next.js pages render
npm run verify:contracts # all cross-layer contract checks pass
```

`verify:contracts` checks (relevant to plugins):
- Every `CONNECTOR_TYPES` entry has a `CONNECTOR_FIELD_DEFS` entry
- Every `CONNECTOR_TYPES` entry has a plugin manifest file at `apps/api/src/<type>/<type>.plugin.ts`
- Every connector plugin's `serviceToken` is present in the manifest file
- `app.module.ts` calls `PluginRegistryModule.register()` and includes every connector's `XxxPlugin` export
- No local duplicate interfaces that shadow shared types
