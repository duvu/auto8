-- Sprint 4: Channels & Integration
-- Add WhatsApp and Telegram to RfqSourceType enum
ALTER TYPE "RfqSourceType" ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE "RfqSourceType" ADD VALUE IF NOT EXISTS 'telegram';

-- Add reply tracking fields to RfqIntake
ALTER TABLE "RfqIntake" ADD COLUMN IF NOT EXISTS "isReply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RfqIntake" ADD COLUMN IF NOT EXISTS "replyToRfqId" TEXT;
ALTER TABLE "RfqIntake" ADD CONSTRAINT "RfqIntake_replyToRfqId_fkey"
  FOREIGN KEY ("replyToRfqId") REFERENCES "Rfq"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Create WebhookEndpoint table
CREATE TABLE "WebhookEndpoint" (
  id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY (id)
);

-- Create WebhookDelivery table
CREATE TABLE "WebhookDelivery" (
  id TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  "responseStatus" INTEGER,
  "lastError" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY (id),
  CONSTRAINT "WebhookDelivery_endpointId_fkey"
    FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"(id) ON DELETE CASCADE
);
