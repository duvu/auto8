-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RfqEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "workflowState" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "emailId" TEXT NOT NULL,
    CONSTRAINT "Rfq_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "RfqEmail" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerCompany" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "rfqId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT NOT NULL,
    CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT NOT NULL,
    "actorId" TEXT,
    CONSTRAINT "QuoteStatusEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_reference_key" ON "Rfq"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_emailId_key" ON "Rfq"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_rfqId_key" ON "Quote"("rfqId");
