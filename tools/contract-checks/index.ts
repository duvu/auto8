#!/usr/bin/env node
/**
 * Contract drift checker for auto8.
 *
 * Validates that all cross-layer contracts stay in sync:
 *   1. Prisma enum values match shared package constants
 *   2. Every CONNECTOR_TYPES entry has CONNECTOR_FIELD_DEFS, backend routing, and frontend form support
 *   3. No local duplicate interfaces remain in apps/api or apps/web that shadow shared types
 *
 * Exit 0 on success, 1 on any drift detected.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../..");

let failures = 0;

function fail(message: string): void {
  console.error(`[FAIL] ${message}`);
  failures++;
}

function pass(message: string): void {
  console.log(`[PASS] ${message}`);
}

// ---------------------------------------------------------------------------
// 1. Shared constant values
// ---------------------------------------------------------------------------

const {
  USER_ROLES,
  QUOTE_STATUSES,
  RFQ_SOURCE_TYPES,
  CONNECTOR_TYPES,
  VALID_PIPELINE_STATUSES,
  CONNECTOR_FIELD_DEFS,
} = require(join(root, "packages/shared/dist/index.js"));

// ---------------------------------------------------------------------------
// 2. Prisma enum values via generated client
// ---------------------------------------------------------------------------

let prismaEnums: Record<string, string[]>;
try {
  const pc = require(join(root, "apps/api/node_modules/.prisma/client"));
  prismaEnums = {
    UserRole: Object.values(pc.UserRole as Record<string, string>),
    QuoteStatus: Object.values(pc.QuoteStatus as Record<string, string>),
    RfqSourceType: Object.values(pc.RfqSourceType as Record<string, string>),
  };
} catch {
  fail("Could not load @prisma/client — run `npm run db:generate` first");
  process.exit(1);
}

function checkEnumMatch(label: string, sharedValues: readonly string[], prismaValues: string[]): void {
  const missing = sharedValues.filter((v) => !prismaValues.includes(v));
  const extra = prismaValues.filter((v) => !sharedValues.includes(v));
  if (missing.length || extra.length) {
    if (missing.length) fail(`${label}: shared has values not in Prisma: ${missing.join(", ")}`);
    if (extra.length) fail(`${label}: Prisma has values not in shared: ${extra.join(", ")}`);
  } else {
    pass(`${label} matches between shared and Prisma`);
  }
}

checkEnumMatch("UserRole", USER_ROLES, prismaEnums.UserRole);
checkEnumMatch("QuoteStatus", QUOTE_STATUSES, prismaEnums.QuoteStatus);
checkEnumMatch("RfqSourceType", RFQ_SOURCE_TYPES, prismaEnums.RfqSourceType);

// ---------------------------------------------------------------------------
// 3. Connector type consistency
// ---------------------------------------------------------------------------

const connectorTypes: string[] = Array.from(CONNECTOR_TYPES as readonly string[]);

for (const t of connectorTypes) {
  if (!(CONNECTOR_FIELD_DEFS as Record<string, unknown>)[t]) {
    fail(`CONNECTOR_FIELD_DEFS is missing entry for connector type: ${t}`);
  } else {
    pass(`CONNECTOR_FIELD_DEFS has entry for ${t}`);
  }
}

// Verify connector-registry.service.ts has routing for all types
const registryServicePath = join(root, "apps/api/src/connector-registry/connector-registry.service.ts");
const registrySource = readFileSync(registryServicePath, "utf8");
for (const t of connectorTypes) {
  if (!registrySource.includes(`"${t}"`)) {
    fail(`connector-registry.service.ts has no reference to connector type "${t}"`);
  } else {
    pass(`connector-registry.service.ts references connector type "${t}"`);
  }
}

// Verify frontend connector form handles all types
const connectorNewPagePath = join(root, "apps/web/app/connectors/new/page.tsx");
if (existsSync(connectorNewPagePath)) {
  const pageSource = readFileSync(connectorNewPagePath, "utf8");
  for (const t of connectorTypes) {
    if (!pageSource.includes(t)) {
      fail(`connectors/new/page.tsx has no reference to connector type "${t}"`);
    } else {
      pass(`connectors/new/page.tsx references "${t}"`);
    }
  }
} else {
  fail(`connectors/new/page.tsx not found at expected path`);
}

// ---------------------------------------------------------------------------
// 4. Duplicate interface check — no local shadows of shared types
// ---------------------------------------------------------------------------

const BANNED_DUPLICATES = [
  "interface CustomerView",
  "interface WebhookEndpointView",
  "interface WorkspaceView",
  "interface RfqVolumePoint",
  "interface WinRateResult",
  "interface ResponseTimeResult",
  "interface TopCustomerView",
  "interface ConnectorStatsView",
  "interface PortalQuoteView",
  "interface ShareLinkResult",
  "interface RfqReplyView",
];

const searchDirs = [
  join(root, "apps/api/src"),
  join(root, "apps/web/src"),
  join(root, "apps/web/lib"),
  join(root, "apps/web/app"),
];

for (const banned of BANNED_DUPLICATES) {
  try {
    const result = execSync(
      `grep -rn "${banned}" ${searchDirs.join(" ")} --include="*.ts" --include="*.tsx" 2>/dev/null || true`,
      { encoding: "utf8" },
    ).trim();
    if (result) {
      fail(`Local duplicate of shared type found: ${banned}\n  ${result.split("\n").join("\n  ")}`);
    } else {
      pass(`No local duplicate of: ${banned}`);
    }
  } catch {
    pass(`No local duplicate of: ${banned}`);
  }
}

// ---------------------------------------------------------------------------
// 5. NestJS module structure — no duplicate provider declarations
// ---------------------------------------------------------------------------

const moduleFiles = [
  join(root, "apps/api/src/app.module.ts"),
  join(root, "apps/api/src/prisma/prisma.module.ts"),
  join(root, "apps/api/src/connector-registry/connector-registry.module.ts"),
  join(root, "apps/api/src/webhooks/webhooks.module.ts"),
  join(root, "apps/api/src/portal/portal.module.ts"),
  join(root, "apps/api/src/analytics/analytics.module.ts"),
  join(root, "apps/api/src/workspace/workspace.module.ts"),
];

// PrismaService must not be redeclared in feature module providers
for (const modFile of moduleFiles) {
  if (!existsSync(modFile)) {
    fail(`Expected module file not found: ${modFile}`);
    continue;
  }
  const src = readFileSync(modFile, "utf8");
  if (!modFile.includes("prisma.module") && src.match(/providers\s*:\s*\[[\s\S]*?PrismaService[\s\S]*?\]/)) {
    fail(`${modFile}: PrismaService re-declared in providers (should import PrismaModule instead)`);
  } else {
    pass(`${modFile.replace(root + "/", "")}: no duplicate PrismaService provider`);
  }
}

const prismaModuleSrc = readFileSync(join(root, "apps/api/src/prisma/prisma.module.ts"), "utf8");
if (!prismaModuleSrc.includes("PrismaService") || !prismaModuleSrc.includes("exports")) {
  fail("prisma.module.ts does not export PrismaService");
} else {
  pass("prisma.module.ts correctly declares and exports PrismaService");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("");
if (failures === 0) {
  console.log("All contract checks passed.");
  process.exit(0);
} else {
  console.error(`${failures} contract check(s) failed.`);
  process.exit(1);
}
