export const USER_ROLES = ["quote_operator", "sales_approver", "admin"] as const;
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
  messageId?: string;
  subject: string;
  body: string;
  submittedAt: string;
}

export interface QuoteLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  productId?: string;
}

export interface SaveQuoteInput {
  customerName: string;
  customerCompany: string;
  notes?: string;
  discount?: number;
  tax?: number;
  grandTotal?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
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

export interface QuoteLineItemView {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number | null;
  productId: string | null;
}

export interface QuoteView {
  id: string;
  customerName: string;
  customerCompany: string;
  notes: string | null;
  discount: number;
  tax: number;
  grandTotal: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  validityDays: number | null;
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
  isRfq: boolean;
  classificationScore: number | null;
  rfqPipelineStatus: string;
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
  emailSummary: RfqEmailSummary | null;
}

export interface QuoteEmailSendView {
  id: string;
  status: 'sent' | 'error';
  sentAt: string;
  sentByUserId: string | null;
  recipientEmail: string;
  errorMessage: string | null;
}

export interface QuoteEmailDraftView {
  id: string;
  quoteId: string;
  subject: string;
  body: string;
  recipientEmail: string;
  status: 'draft' | 'sent' | 'error';
  autoSend: boolean;
  sends: QuoteEmailSendView[];
  createdAt: string;
  updatedAt: string;
}

export interface SendQuoteEmailInput {
  // no fields — triggers send of current draft
}

export interface UpdateQuoteEmailInput {
  subject?: string;
  body?: string;
  recipientEmail?: string;
}

export interface ApproveQuoteInput {
  autoSend?: boolean;
}

export interface RfqEmailSummary {
  totalSent: number;
  totalErrors: number;
  lastSentAt: string | null;
}

export interface AuditLogView {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  before: unknown | null;
  after: unknown | null;
  createdAt: string;
}

export interface ApiRequestLogView {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  actorId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogQueryParams {
  resourceType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface IngestionRunView {
  id: string;
  connectorName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  imported: number;
  skipped: number;
  failed: number;
  status: 'success' | 'error';
  errorMessage: string | null;
  createdAt: string;
}

export interface IngestionRunStats {
  connectorName: string;
  totalRuns: number;
  totalImported: number;
  totalSkipped: number;
  totalFailed: number;
  avgDurationMs: number;
  errorRatePercent: number;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | null;
}

export interface IngestionDayCount {
  date: string;
  imported: number;
}

export interface IngestionMetricsSummary {
  byConnector: IngestionRunStats[];
  dailyImports: IngestionDayCount[];
  connectors?: ConnectorView[];
}

export interface RfqExtractedItemView {
  id: string;
  rfqId: string;
  partNumber: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  confidenceReason: string | null;
  createdAt: string;
}

export interface ClassificationResult {
  isRfq: boolean;
  score: number;
  reason: string;
}

export interface GenerateQuoteResult {
  quote: QuoteView;
  isAiGenerated: true;
  model: string;
}

export interface UserView {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResult {
  message: string;
}

export interface AuthMeResult {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ProductView {
  id: string;
  productCode: string;
  productName: string;
  description: string | null;
  brand: string | null;
  unit: string | null;
  basePrice: number | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface RfqItemMatchView {
  id: string;
  rfqExtractedItemId: string;
  product: ProductView | null;
  score: number;
  status: string;
  overrideDescription: string | null;
  overrideUnitPrice: number | null;
  createdAt: string;
}

export interface BackgroundJobView {
  id: string;
  type: string;
  status: string;
  payload: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RfqExtractedCustomerView {
  id: string;
  rfqId: string;
  customerCompany: string | null;
  customerContact: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  deliveryLocation: string | null;
  requestedDeadline: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CatalogueUploadResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export const LLM_PROVIDER_KINDS = ["openai", "anthropic", "google", "ollama"] as const;
export type LlmProviderKind = (typeof LLM_PROVIDER_KINDS)[number];

export interface LlmSettingView {
  provider: LlmProviderKind;
  model: string;
  baseUrl: string | null;
  apiKeyMasked: string;
  isConfigured: boolean;
  updatedAt: string;
}

export interface UpdateLlmSettingInput {
  provider: LlmProviderKind;
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export interface LlmTestResult {
  ok: boolean;
  latencyMs?: number;
  response?: string;
  error?: string;
}
export const CONNECTOR_TYPES = ["gmail", "slack"] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export interface ConnectorView {
  id: string;
  type: ConnectorType;
  label: string;
  isEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  failureCount: number;
  createdAt: string;
}

export interface ConnectorTestResult {
  ok: boolean;
  detail?: string;
  error?: string;
}

export interface CreateConnectorInput {
  type: ConnectorType;
  label: string;
  credentials: Record<string, string>;
}

export interface UpdateConnectorInput {
  label?: string;
  isEnabled?: boolean;
  credentials?: Record<string, string>;
}
