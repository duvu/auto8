-- AlterEnum
ALTER TYPE "public"."QuoteStatus" ADD VALUE 'revised';

-- AlterTable
ALTER TABLE "public"."Quote" ADD COLUMN     "parentQuoteId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."Rfq" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "expectedResponseBy" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."SlaConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultResponseHours" INTEGER NOT NULL DEFAULT 24,
    "warningThresholdHours" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Rfq" ADD CONSTRAINT "Rfq_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_parentQuoteId_fkey" FOREIGN KEY ("parentQuoteId") REFERENCES "public"."Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
