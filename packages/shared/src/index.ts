/**
 * Contract Ownership Policy
 * --------------------------
 * This file is the single source of truth for all cross-layer contracts in auto8.
 *
 * ADD types/constants here when:
 *   - Both apps/api and apps/web need to reference the same value (enums, view shapes, DTOs)
 *   - A value is used in more than one package
 *
 * KEEP types local when:
 *   - A type is only used inside one module and never serialized to/from the API boundary
 *   - An internal Prisma query shape or NestJS-only decorator param
 *
 * NEVER duplicate a type from this file inside apps/api or apps/web — import it instead.
 */

export const USER_ROLES = ["quote_operator", "sales_approver", "admin", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUOTE_STATUSES = ["draft", "pending_approval", "approved", "revised", "customer_accepted", "customer_rejected", "revision_requested"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const RFQ_WORKFLOW_STATES = ["new", "draft", "pending_approval", "approved"] as const;
export type RfqWorkflowState = (typeof RFQ_WORKFLOW_STATES)[number];

export const RFQ_SOURCE_TYPES = ["email", "slack", "outlook", "whatsapp", "telegram", "zalo"] as const;
export type RfqSourceType = (typeof RFQ_SOURCE_TYPES)[number];

export const VALID_PIPELINE_STATUSES = [
  "new",
  "classified",
  "needs_review",
  "ready_for_quote",
  "quote_draft_created",
  "quote_submitted",
  "approved",
  "sent",
  "closed",
] as const;
export type RfqPipelineStatus = (typeof VALID_PIPELINE_STATUSES)[number];

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
  /** Unit price in dollars (Float, e.g. 10.99) */
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
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  lineItems: QuoteLineItemInput[];
  /** ISO 4217 currency code, e.g. "USD", "EUR", "VND" */
  currency?: string;
  /** Exchange rate relative to base currency (default 1.0) */
  exchangeRate?: number;
  /** Pre-populated from a QuoteTemplate */
  templateId?: string;
  /** Link to a saved Customer in the address book */
  customerId?: string;
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
  /** Unit price in dollars (Float, e.g. 10.99) */
  unitPrice: number;
  discount: number;
  subtotal: number;
  productId: string | null;
  /** Suggested sell price = basePrice × (1 + defaultMarkup/100) */
  suggestedPrice: number | null;
}

export interface QuoteView {
  id: string;
  customerName: string;
  customerCompany: string;
  notes: string | null;
  discount: number;
  tax: number;
  grandTotal: number | null;
  currency: string;
  exchangeRate: number;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  validityDays: number | null;
  version: number;
  parentQuoteId: string | null;
  status: QuoteStatus;
  createdById: string;
  approvedById: string | null;
  customerId: string | null;
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
  assignedToId: string | null;
  assignedToName: string | null;
  expectedResponseBy: string | null;
  slaBreached: boolean;
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
  defaultMarkup: number;
  isActive: boolean;
  categoryTags: string[];
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

export interface RfqMatchGroupView {
  extractedItem: RfqExtractedItemView;
  matches: RfqItemMatchView[];
}

export interface BackgroundJobView {
  id: string;
  type: string;
  status: string;
  payload: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  nextRunAt?: string | null;
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

export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "VND", "SGD", "AUD", "CAD", "CHF",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface CustomerView {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  quoteCount?: number;
}

export interface QuoteTemplateLineItemView {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
  productId: string | null;
}

export interface QuoteTemplateView {
  id: string;
  name: string;
  description: string | null;
  headerNotes: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  validityDays: number | null;
  currency: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lineItems: QuoteTemplateLineItemView[];
}

export const LLM_PROVIDER_KINDS = ["openai", "anthropic", "google", "ollama"] as const;
export type LlmProviderKind = (typeof LLM_PROVIDER_KINDS)[number];

export interface SlaConfigView {
  defaultResponseHours: number;
  warningThresholdHours: number;
  updatedAt: string;
}

export interface UpdateSlaConfigInput {
  defaultResponseHours?: number;
  warningThresholdHours?: number;
}

export interface QuoteDiffItem {
  field: string;
  before: unknown;
  after: unknown;
}

export interface QuoteDiffResult {
  quoteId: string;
  parentQuoteId: string;
  version: number;
  diffs: QuoteDiffItem[];
}

export interface ReviseQuoteResult {
  newQuoteId: string;
  version: number;
  rfqId: string;
}

export interface AssignRfqInput {
  assignedToId: string | null;
}

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
export const CONNECTOR_TYPES = ["gmail", "slack", "outlook", "whatsapp", "telegram", "zalo"] as const;
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

export interface ConnectorSyncSummary {
  imported: number;
  skipped: number;
  failed: number;
  importedReferences: string[];
  errors: string[];
}

export interface CreateProductInput {
  productCode: string;
  productName: string;
  description?: string;
  brand?: string;
  unit?: string;
  basePrice?: number;
  currency?: string;
  defaultMarkup?: number;
}

export interface UploadPreviewRow {
  row: number;
  productCode: string;
  productName: string;
  action: "create" | "update" | "skip";
  reason?: string;
}

export interface UploadPreviewResult {
  rows: UploadPreviewRow[];
  createCount: number;
  updateCount: number;
  skipCount: number;
}

export interface CatalogueEnrichmentSuggestionView {
  id: string;
  catalogueId: string;
  productCode: string;
  suggestions: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export interface EnrichmentPreviewResponse {
  catalogueId: string;
  pending: CatalogueEnrichmentSuggestionView[];
  total: number;
}

export interface ConfirmEnrichmentInput {
  suggestionIds: string[];
}

export interface SetupStatusView {
  llmConfigured: boolean;
  catalogueLoaded: boolean;
  connectorConfigured: boolean;
  teamMembersAdded: boolean;
  completed: boolean;
}

export * from "./quote-calc";

export interface ConnectorFieldDef {
  key: string;
  label: string;
  placeholder: string;
  description: string;
  secret: boolean;
  required: boolean;
  hint?: string;
}

export const CONNECTOR_FIELD_DEFS: Record<ConnectorType, ConnectorFieldDef[]> = {
  gmail: [
    { key: "clientId", label: "Client ID", placeholder: "1234567890-abc.apps.googleusercontent.com", description: "OAuth2 client ID from Google Cloud Console", secret: false, required: true },
    { key: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-…", description: "OAuth2 client secret from Google Cloud Console", secret: true, required: true },
    { key: "refreshToken", label: "Refresh Token", placeholder: "1//0g…", description: "Long-lived refresh token from OAuth2 consent flow", secret: true, required: true },
    { key: "query", label: "Search Query", placeholder: "is:unread subject:RFQ", description: "Gmail search filter for incoming RFQ emails (optional)", secret: false, required: false },
    { key: "maxResults", label: "Max Results", placeholder: "50", description: "Maximum emails to fetch per sync cycle (optional)", secret: false, required: false },
  ],
  slack: [
    { key: "botToken", label: "Bot Token", placeholder: "xoxb-…", description: "Slack bot token from your app's OAuth & Permissions page", secret: true, required: true, hint: "Must start with xoxb-" },
    { key: "signingSecret", label: "Signing Secret", placeholder: "abc123…", description: "Slack signing secret for verifying webhook payloads", secret: true, required: true },
    { key: "workspaceId", label: "Workspace ID", placeholder: "T0123456789", description: "Slack workspace (team) ID starting with T", secret: false, required: true },
  ],
  outlook: [
    { key: "clientId", label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", description: "Azure app registration client ID", secret: false, required: true },
    { key: "clientSecret", label: "Client Secret", placeholder: "abc~xyz…", description: "Azure app registration client secret", secret: true, required: true },
    { key: "refreshToken", label: "Refresh Token", placeholder: "0.AXXX…", description: "Microsoft OAuth2 refresh token", secret: true, required: true },
    { key: "tenantId", label: "Tenant ID", placeholder: "common", description: "Azure tenant ID — use 'common' for personal accounts", secret: false, required: false },
    { key: "maxResults", label: "Max Results", placeholder: "50", description: "Maximum emails to fetch per sync cycle (optional)", secret: false, required: false },
    { key: "markAsRead", label: "Mark as Read", placeholder: "true", description: "Mark emails as read after importing (optional)", secret: false, required: false },
  ],
  whatsapp: [
    { key: "appSecret", label: "App Secret", placeholder: "abc123…", description: "Meta app secret for HMAC-SHA256 signature verification", secret: true, required: true },
    { key: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890", description: "WhatsApp Business phone number ID from Meta Developer Console", secret: false, required: true },
    { key: "accessToken", label: "Access Token", placeholder: "EAAxxxxxx…", description: "Meta permanent access token for sending (optional for receive-only)", secret: true, required: false },
    { key: "verifyToken", label: "Verify Token", placeholder: "my-verify-token", description: "Token used to verify the webhook URL during Meta setup", secret: false, required: true },
  ],
  telegram: [
    { key: "botToken", label: "Bot Token", placeholder: "1234567890:AAFxxxxxx", description: "Telegram bot token from @BotFather", secret: true, required: true },
    { key: "secret", label: "Webhook Secret", placeholder: "my-webhook-secret", description: "Secret token appended to the webhook URL for authentication", secret: false, required: true },
  ],
  zalo: [
    { key: "appId", label: "App ID", placeholder: "1234567890123456789", description: "Zalo OA app ID from Zalo Developer Console", secret: false, required: true },
    { key: "appSecret", label: "App Secret", placeholder: "abc123…", description: "Zalo OA app secret for HMAC-SHA256 verification", secret: true, required: true },
    { key: "verifyToken", label: "Verify Token", placeholder: "my-verify-token", description: "Token used to verify the webhook callback URL", secret: false, required: true },
    { key: "oaAccessToken", label: "OA Access Token", placeholder: "v3_xxx…", description: "OA access token — required only for testConnector; optional for receive-only", secret: true, required: false },
  ],
};

export interface TestConnectorCredentialsInput {
  type: ConnectorType;
  credentials: Record<string, string>;
}

export interface RfqVolumePoint {
  date: string;
  count: number;
  sourceType: string;
}

export interface WinRateResult {
  accepted: number;
  rejected: number;
  winRate: number;
}

export interface ResponseTimeResult {
  avgHours: number;
  p50Hours: number;
  p90Hours: number;
}

export interface TopCustomerView {
  customerId: string;
  companyName: string;
  totalQuotes: number;
  grandTotal: number;
  winRate: number;
}

export interface ConnectorStatsView {
  connectorId: string;
  label: string;
  type: string;
  intakeCount: number;
  lastSyncAt: string | null;
  recentFailures: number;
}

export interface WorkspaceView {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface WebhookEndpointView {
  id: string;
  url: string;
  events: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortalQuoteView {
  reference: string;
  customerName: string;
  customerCompany: string;
  lineItems: {
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
    currency: string;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  currency: string;
  validUntil: string | null;
  notes: string | null;
}

export interface ShareLinkResult {
  url: string;
  token: string;
}

export interface RfqReplyView {
  id: string;
  subject: string | null;
  senderName: string | null;
  body: string | null;
  receivedAt: string;
}
