-- Add Gmail provenance fields to RfqIntake
ALTER TABLE "RfqIntake" ADD COLUMN "gmailMessageId" TEXT;
ALTER TABLE "RfqIntake" ADD COLUMN "gmailThreadId" TEXT;
CREATE UNIQUE INDEX "RfqIntake_gmailMessageId_key" ON "RfqIntake"("gmailMessageId");
