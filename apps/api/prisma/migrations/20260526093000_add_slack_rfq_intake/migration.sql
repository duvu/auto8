PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "RfqIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "rawPayload" TEXT,
    "slackWorkspaceId" TEXT,
    "slackWorkspaceName" TEXT,
    "slackChannelId" TEXT,
    "slackChannelName" TEXT,
    "slackSubmitterId" TEXT,
    "slackSubmitterName" TEXT,
    "slackSubmitterEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "RfqIntake" (
    "id",
    "sourceType",
    "sourceLabel",
    "senderEmail",
    "senderName",
    "subject",
    "body",
    "receivedAt",
    "rawPayload",
    "slackWorkspaceId",
    "slackWorkspaceName",
    "slackChannelId",
    "slackChannelName",
    "slackSubmitterId",
    "slackSubmitterName",
    "slackSubmitterEmail",
    "createdAt"
)
SELECT
    "id",
    'email',
    'Email',
    "fromEmail",
    "fromName",
    "subject",
    "body",
    "receivedAt",
    "rawPayload",
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    "createdAt"
FROM "RfqEmail";

CREATE TABLE "new_Rfq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "workflowState" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "intakeId" TEXT NOT NULL,
    CONSTRAINT "Rfq_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "RfqIntake" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Rfq" ("id", "reference", "workflowState", "createdAt", "updatedAt", "intakeId")
SELECT "id", "reference", "workflowState", "createdAt", "updatedAt", "emailId"
FROM "Rfq";

DROP TABLE "Rfq";
ALTER TABLE "new_Rfq" RENAME TO "Rfq";
DROP TABLE "RfqEmail";

CREATE UNIQUE INDEX "Rfq_reference_key" ON "Rfq"("reference");
CREATE UNIQUE INDEX "Rfq_intakeId_key" ON "Rfq"("intakeId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
