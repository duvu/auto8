import type { Connector } from "@prisma/client";

import type { ConnectorSyncSummary, ConnectorTestResult } from "@auto8/shared";

export type NormalizedRfqIntake = {
  sourceType: "email" | "slack" | "outlook";
  sourceLabel: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string;
  body: string;
  receivedAt: string;
  rawPayload: string;
  slackWorkspaceId?: string | null;
  slackWorkspaceName?: string | null;
  slackChannelId?: string | null;
  slackChannelName?: string | null;
  slackSubmitterId?: string | null;
  slackSubmitterName?: string | null;
  slackSubmitterEmail?: string | null;
  slackMessageId?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  outlookMessageId?: string | null;
  isRfq?: boolean;
  classificationScore?: number | null;
  classificationReason?: string | null;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }>;
  connectorId?: string | null;
};

export interface ConnectorService {
  isConfigured(): boolean;
  sync(connector: Connector): Promise<ConnectorSyncSummary>;
  testConnector(connector: Connector): Promise<ConnectorTestResult>;
}
