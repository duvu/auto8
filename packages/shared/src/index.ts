export const USER_ROLES = ["quote_operator", "sales_approver"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUOTE_STATUSES = ["draft", "pending_approval", "approved"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const RFQ_WORKFLOW_STATES = ["new", "draft", "pending_approval", "approved"] as const;
export type RfqWorkflowState = (typeof RFQ_WORKFLOW_STATES)[number];

export const RFQ_SOURCE_TYPES = ["email", "slack"] as const;
export type RfqSourceType = (typeof RFQ_SOURCE_TYPES)[number];

export interface IntakeEmailInput {
  fromEmail: string;
  fromName?: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export interface SlackRfqIntakeInput {
  workspaceId: string;
  workspaceName?: string;
  channelId: string;
  channelName?: string;
  submitterId: string;
  submitterName?: string;
  submitterEmail?: string;
  subject: string;
  body: string;
  submittedAt: string;
}

export interface QuoteLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface SaveQuoteInput {
  customerName: string;
  customerCompany: string;
  notes?: string;
  lineItems: QuoteLineItemInput[];
}

export interface WorkflowEventView {
  id: string;
  status: QuoteStatus;
  actorName: string | null;
  actorRole: UserRole | null;
  createdAt: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface QuoteLineItemView extends QuoteLineItemInput {
  id: string;
}

export interface QuoteView {
  id: string;
  customerName: string;
  customerCompany: string;
  notes: string | null;
  status: QuoteStatus;
  createdById: string;
  approvedById: string | null;
  lineItems: QuoteLineItemView[];
}

export interface RfqListItemView {
  id: string;
  reference: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string;
  receivedAt: string;
  workflowState: RfqWorkflowState;
  sourceType: RfqSourceType;
  sourceLabel: string;
}

export interface RfqDetailView extends RfqListItemView {
  body: string;
  slackWorkspaceId: string | null;
  slackWorkspaceName: string | null;
  slackChannelId: string | null;
  slackChannelName: string | null;
  slackSubmitterId: string | null;
  slackSubmitterName: string | null;
  slackSubmitterEmail: string | null;
  quote: QuoteView | null;
  history: WorkflowEventView[];
}
