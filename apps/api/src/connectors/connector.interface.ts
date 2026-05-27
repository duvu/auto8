export type NormalizedRfqIntake = {
  sourceType: "email" | "slack";
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

export type ConnectorSyncSummary = {
  imported: number;
  skipped: number;
  failed: number;
  importedReferences: string[];
  errors: string[];
};

export interface ConnectorService {
  isConfigured(): boolean;
}
