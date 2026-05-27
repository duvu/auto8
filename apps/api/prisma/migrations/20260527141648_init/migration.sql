-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('quote_operator', 'sales_approver', 'admin');

-- CreateEnum
CREATE TYPE "public"."QuoteStatus" AS ENUM ('draft', 'pending_approval', 'approved');

-- CreateEnum
CREATE TYPE "public"."RfqWorkflowState" AS ENUM ('new', 'draft', 'pending_approval', 'approved');

-- CreateEnum
CREATE TYPE "public"."RfqSourceType" AS ENUM ('email', 'slack');

-- CreateEnum
CREATE TYPE "public"."QuoteEmailStatus" AS ENUM ('draft', 'sent', 'error');

-- CreateEnum
CREATE TYPE "public"."QuoteEmailSendStatus" AS ENUM ('sent', 'error');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RfqIntake" (
    "id" TEXT NOT NULL,
    "sourceType" "public"."RfqSourceType" NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "slackWorkspaceId" TEXT,
    "slackWorkspaceName" TEXT,
    "slackChannelId" TEXT,
    "slackChannelName" TEXT,
    "slackSubmitterId" TEXT,
    "slackSubmitterName" TEXT,
    "slackSubmitterEmail" TEXT,
    "slackMessageId" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "isRfq" BOOLEAN NOT NULL DEFAULT true,
    "classificationScore" DOUBLE PRECISION,
    "classificationReason" TEXT,
    "rfqPipelineStatus" TEXT NOT NULL DEFAULT 'new',
    "attachmentContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rfq" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "workflowState" "public"."RfqWorkflowState" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "intakeId" TEXT NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RfqExtractedItem" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "partNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confidenceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqExtractedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Quote" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCompany" TEXT NOT NULL,
    "notes" TEXT,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION,
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "validityDays" INTEGER,
    "status" "public"."QuoteStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rfqId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteLineItem" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT NOT NULL,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IngestionRun" (
    "id" TEXT NOT NULL,
    "connectorName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteEmail" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" "public"."QuoteEmailStatus" NOT NULL DEFAULT 'draft',
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteEmailSend" (
    "id" TEXT NOT NULL,
    "quoteEmailId" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "status" "public"."QuoteEmailSendStatus" NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteStatusEvent" (
    "id" TEXT NOT NULL,
    "status" "public"."QuoteStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "QuoteStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiRequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "actorId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductCatalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "catalogueId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "unit" TEXT,
    "basePrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RfqAttachment" (
    "id" TEXT NOT NULL,
    "rfqIntakeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "parsedText" TEXT,
    "parseStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RfqExtractedCustomer" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "customerCompany" TEXT,
    "customerContact" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "deliveryLocation" TEXT,
    "requestedDeadline" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqExtractedCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RfqItemMatch" (
    "id" TEXT NOT NULL,
    "rfqExtractedItemId" TEXT NOT NULL,
    "productId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overrideDescription" TEXT,
    "overrideUnitPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqItemMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RfqIntake_slackMessageId_key" ON "public"."RfqIntake"("slackMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqIntake_gmailMessageId_key" ON "public"."RfqIntake"("gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_reference_key" ON "public"."Rfq"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_intakeId_key" ON "public"."Rfq"("intakeId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_rfqId_key" ON "public"."Quote"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteEmail_quoteId_key" ON "public"."QuoteEmail"("quoteId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "public"."AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "public"."AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_createdAt_idx" ON "public"."ApiRequestLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "public"."Product"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "RfqExtractedCustomer_rfqId_key" ON "public"."RfqExtractedCustomer"("rfqId");

-- AddForeignKey
ALTER TABLE "public"."Rfq" ADD CONSTRAINT "Rfq_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "public"."RfqIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RfqExtractedItem" ADD CONSTRAINT "RfqExtractedItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "public"."Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "public"."Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteEmail" ADD CONSTRAINT "QuoteEmail_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteEmailSend" ADD CONSTRAINT "QuoteEmailSend_quoteEmailId_fkey" FOREIGN KEY ("quoteEmailId") REFERENCES "public"."QuoteEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteEmailSend" ADD CONSTRAINT "QuoteEmailSend_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteStatusEvent" ADD CONSTRAINT "QuoteStatusEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteStatusEvent" ADD CONSTRAINT "QuoteStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "public"."ProductCatalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RfqAttachment" ADD CONSTRAINT "RfqAttachment_rfqIntakeId_fkey" FOREIGN KEY ("rfqIntakeId") REFERENCES "public"."RfqIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RfqExtractedCustomer" ADD CONSTRAINT "RfqExtractedCustomer_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "public"."Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RfqItemMatch" ADD CONSTRAINT "RfqItemMatch_rfqExtractedItemId_fkey" FOREIGN KEY ("rfqExtractedItemId") REFERENCES "public"."RfqExtractedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RfqItemMatch" ADD CONSTRAINT "RfqItemMatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
