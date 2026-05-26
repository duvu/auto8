export const USER_ROLES = ["quote_operator", "sales_approver"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUOTE_STATUSES = ["draft", "pending_approval", "approved"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const RFQ_WORKFLOW_STATES = ["new", "draft", "pending_approval", "approved"] as const;
export type RfqWorkflowState = (typeof RFQ_WORKFLOW_STATES)[number];

export interface IntakeEmailInput {
  fromEmail: string;
  fromName?: string;
  subject: string;
  body: string;
  receivedAt: string;
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
  senderEmail: string;
  senderName: string | null;
  subject: string;
  receivedAt: string;
  workflowState: RfqWorkflowState;
}

export interface RfqDetailView extends RfqListItemView {
  body: string;
  quote: QuoteView | null;
  history: WorkflowEventView[];
}
