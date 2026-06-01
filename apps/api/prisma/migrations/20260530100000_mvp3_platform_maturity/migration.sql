-- Workspace table
CREATE TABLE IF NOT EXISTS "Workspace" (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY (id)
);

-- Workspace unique index + default row
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"(slug);
INSERT INTO "Workspace" (id, name, slug, "createdAt", "updatedAt")
VALUES ('default', 'Default Workspace', 'default', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- workspaceId on all entities
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Connector" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "ProductCatalogue" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "QuoteTemplate" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT NOT NULL DEFAULT 'default';

-- FK constraints
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCatalogue" ADD CONSTRAINT "ProductCatalogue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- New enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'customer_accepted';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'customer_rejected';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'revision_requested';

-- QuoteStatusEvent note field
ALTER TABLE "QuoteStatusEvent" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- MagicLinkToken table
CREATE TABLE IF NOT EXISTS "MagicLinkToken" (
  id TEXT NOT NULL,
  token TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS "MagicLinkToken_token_key" ON "MagicLinkToken"(token);
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"(id) ON DELETE CASCADE ON UPDATE CASCADE;

SELECT 'Migration complete' AS status;
