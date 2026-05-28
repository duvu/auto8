/*
  Warnings:

  - Made the column `rawPayload` on table `RfqIntake` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RfqIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "slackWorkspaceId" TEXT,
    "slackWorkspaceName" TEXT,
    "slackChannelId" TEXT,
    "slackChannelName" TEXT,
    "slackSubmitterId" TEXT,
    "slackSubmitterName" TEXT,
    "slackSubmitterEmail" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RfqIntake" ("body", "createdAt", "gmailMessageId", "gmailThreadId", "id", "rawPayload", "receivedAt", "senderEmail", "senderName", "slackChannelId", "slackChannelName", "slackSubmitterEmail", "slackSubmitterId", "slackSubmitterName", "slackWorkspaceId", "slackWorkspaceName", "sourceLabel", "sourceType", "subject") SELECT "body", "createdAt", "gmailMessageId", "gmailThreadId", "id", "rawPayload", "receivedAt", "senderEmail", "senderName", "slackChannelId", "slackChannelName", "slackSubmitterEmail", "slackSubmitterId", "slackSubmitterName", "slackWorkspaceId", "slackWorkspaceName", "sourceLabel", "sourceType", "subject" FROM "RfqIntake";
DROP TABLE "RfqIntake";
ALTER TABLE "new_RfqIntake" RENAME TO "RfqIntake";
CREATE UNIQUE INDEX "RfqIntake_gmailMessageId_key" ON "RfqIntake"("gmailMessageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
