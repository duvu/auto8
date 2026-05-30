import type { AuditLogQueryParams, AuditLogView, BackgroundJobView, CatalogueUploadResult, CatalogueEnrichmentSuggestionView, ConfirmEnrichmentInput, ConnectorSyncSummary, ConnectorTestResult, ConnectorView, CreateConnectorInput, CreateProductInput, CustomerView, EnrichmentPreviewResponse, GenerateQuoteResult, IngestionMetricsSummary, IngestionRunView, IntakeEmailInput, LlmSettingView, LlmTestResult, PaginatedResponse, ProductView, QuoteEmailDraftView, QuoteEmailSendView, QuoteTemplateView, RfqDetailView, RfqExtractedCustomerView, RfqExtractedItemView, RfqItemMatchView, RfqListItemView, RfqMatchGroupView, SaveQuoteInput, SetupStatusView, SlaConfigView, UpdateConnectorInput, UpdateLlmSettingInput, UpdateQuoteEmailInput, UpdateSlaConfigInput, UploadPreviewResult, UserView, QuoteDiffResult, ReviseQuoteResult } from "@auto8/shared";

import { logout } from "./auth";
import { API_BASE_URL } from "./config";

function buildUrl(path: string) {
  return `${API_BASE_URL}/api${path}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    await logout();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized. Please log in.");
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    error?: string;
  };

  const message = Array.isArray(body.message) ? body.message.join(", ") : body.message ?? body.error ?? "Request failed.";
  throw new Error(message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store"
  });

  return parseJson<T>(response);
}

export function fetchRfqs(isRfq?: boolean, pipelineStatus?: string, assignedToId?: string) {
  const qs = new URLSearchParams();
  if (isRfq !== undefined) qs.set("isRfq", String(isRfq));
  if (pipelineStatus) qs.set("pipelineStatus", pipelineStatus);
  if (assignedToId !== undefined) qs.set("assignedToId", assignedToId);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<RfqListItemView>>(`/rfqs${query}`);
}

export function fetchRfqDetail(rfqId: string) {
  return request<RfqDetailView>(`/rfqs/${rfqId}`);
}

export function createRfqFromEmail(input: IntakeEmailInput) {
  return request<RfqDetailView>("/rfqs/intake-email", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function generateQuote(rfqId: string) {
  return request<GenerateQuoteResult>(`/rfqs/${rfqId}/quote/generate`, { method: "POST" });
}

export function saveDraftQuote(rfqId: string, input: SaveQuoteInput) {
  return request<RfqDetailView>(`/rfqs/${rfqId}/quote`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function submitQuote(quoteId: string) {
  return request<RfqDetailView>(`/quotes/${quoteId}/submit`, { method: "POST" });
}

export function approveQuote(quoteId: string, autoSend?: boolean) {
  return request<RfqDetailView>(`/quotes/${quoteId}/approve`, {
    method: "POST",
    body: JSON.stringify({ autoSend: autoSend ?? false })
  });
}

export function getQuoteEmail(quoteId: string) {
  return request<QuoteEmailDraftView>(`/quotes/${quoteId}/email`);
}

export function updateQuoteEmail(quoteId: string, input: UpdateQuoteEmailInput) {
  return request<QuoteEmailDraftView>(`/quotes/${quoteId}/email`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function sendQuoteEmail(quoteId: string) {
  return request<QuoteEmailSendView>(`/quotes/${quoteId}/email/send`, {
    method: "POST"
  });
}

export function getAuditLogs(params: AuditLogQueryParams) {
  const qs = new URLSearchParams();
  if (params.resourceType) qs.set("resourceType", params.resourceType);
  if (params.actorId) qs.set("actorId", params.actorId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<AuditLogView>>(`/audit${query}`);
}

export function getResourceAuditLogs(resourceType: string, resourceId: string) {
  return request<AuditLogView[]>(`/audit/${resourceType}/${resourceId}`);
}

export function getIngestionRuns(params: { connectorName?: string; from?: string; to?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.connectorName) qs.set("connectorName", params.connectorName);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<IngestionRunView>>(`/connectors/runs${query}`);
}

export function getIngestionSummary() {
  return request<IngestionMetricsSummary>(`/connectors/runs/summary`);
}

export function getExtractedItems(rfqId: string) {
  return request<RfqExtractedItemView[]>(`/rfqs/${rfqId}/extracted-items`);
}

export function updateExtractedItem(rfqId: string, itemId: string, body: { description?: string; partNumber?: string; quantity?: number; unit?: string }) {
  return request<RfqExtractedItemView>(`/rfqs/${rfqId}/extracted-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getExtractedCustomer(rfqId: string) {
  return request<RfqExtractedCustomerView | null>(`/rfqs/${rfqId}/extracted-customer`);
}

// Matches
export function getMatches(rfqId: string) {
  return request<RfqMatchGroupView[]>(`/rfqs/${rfqId}/matches`);
}

export function updateMatch(rfqId: string, matchId: string, action: "accept" | "override", overrides?: { overrideDescription?: string; overrideUnitPrice?: number }) {
  return request<RfqItemMatchView>(`/rfqs/${rfqId}/matches/${matchId}`, {
    method: "PATCH",
    body: JSON.stringify({ action, ...overrides })
  });
}

export function createQuoteFromMatches(rfqId: string) {
  return request<RfqDetailView>(`/rfqs/${rfqId}/quote/from-matches`, { method: "POST" });
}

// User management
export function getUsers(page = 1, limit = 20) {
  return request<PaginatedResponse<UserView>>(`/users?page=${page}&limit=${limit}`);
}

export function createUser(data: { email: string; name: string; role: string; password: string }) {
  return request<UserView>("/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(id: string, data: { name?: string; role?: string; password?: string; isActive?: boolean }) {
  return request<UserView>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deactivateUser(id: string) {
  return request<UserView>(`/users/${id}`, { method: "DELETE" });
}

// Auth
export function authForgotPassword(email: string) {
  return request<void>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function authResetPassword(token: string, newPassword: string) {
  return request<void>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) });
}

// Product Catalogue
export function getProducts(q?: string, page?: number, limit?: number) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page) qs.set("page", String(page));
  if (limit) qs.set("limit", String(limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<ProductView>>(`/catalogue${query}`);
}

export function uploadCatalogue(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<CatalogueUploadResult>("/catalogue/upload", {
    method: "POST",
    body: formData,
  });
}

export function deleteProduct(id: string) {
  return request<void>(`/catalogue/${id}`, { method: "DELETE" });
}

export function createProduct(input: CreateProductInput) {
  return request<ProductView>("/catalogue", { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(id: string, input: CreateProductInput) {
  return request<ProductView>(`/catalogue/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function reactivateProduct(id: string) {
  return request<ProductView>(`/catalogue/${id}/reactivate`, { method: "POST" });
}

export async function exportCatalogue(): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/catalogue/export`, { credentials: "include" });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export function previewCatalogueUpload(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<UploadPreviewResult>("/catalogue/upload/preview", {
    method: "POST",
    body: formData,
  });
}

export function getProduct(id: string) {
  return request<ProductView>(`/catalogue/${id}`);
}

// Jobs
export function getJobs(params: { status?: string; type?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.page) qs.set("page", String(params.page));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<BackgroundJobView>>(`/jobs${query}`);
}

// Settings — LLM Provider
export function getLlmSetting() {
  return request<LlmSettingView>("/settings/llm");
}

export function updateLlmSetting(input: UpdateLlmSettingInput) {
  return request<LlmSettingView>("/settings/llm", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function testLlmConnection() {
  return request<LlmTestResult>("/settings/llm/test", { method: "POST" });
}

// Connector Registry
export function getConnectors() {
  return request<ConnectorView[]>("/connectors");
}

export function createConnector(input: CreateConnectorInput) {
  return request<ConnectorView>("/connectors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateConnector(id: string, input: UpdateConnectorInput) {
  return request<ConnectorView>(`/connectors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteConnector(id: string) {
  return request<void>(`/connectors/${id}`, { method: "DELETE" });
}

export function testConnector(id: string) {
  return request<ConnectorTestResult>(`/connectors/${id}/test`, { method: "POST" });
}

export function getConnector(id: string) {
  return request<ConnectorView>(`/connectors/${id}`);
}

export function getConnectorRuns(id: string, page = 1, limit = 10) {
  return request<PaginatedResponse<IngestionRunView>>(`/connectors/${id}/runs?page=${page}&limit=${limit}`);
}

export function syncConnectorNow(id: string) {
  return request<ConnectorSyncSummary>(`/connectors/${id}/sync`, { method: "POST" });
}

export function getOAuth2Providers() {
  return request<{ gmail: boolean; outlook: boolean; slack: boolean }>("/connectors/oauth2/providers");
}

export async function startOAuth2Flow(provider: "gmail" | "outlook" | "slack"): Promise<void> {
  const { authorizationUrl } = await request<{ authorizationUrl: string }>(`/connectors/oauth2/start?provider=${provider}`);
  window.location.href = authorizationUrl;
}

// Customers
export function getCustomers(q?: string, page?: number, limit?: number) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page) qs.set("page", String(page));
  if (limit) qs.set("limit", String(limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<CustomerView>>(`/customers${query}`);
}

export function getCustomer(id: string) {
  return request<CustomerView>(`/customers/${id}`);
}

export function createCustomer(data: { companyName: string; contactName?: string; email?: string; phone?: string; address?: string; notes?: string }) {
  return request<CustomerView>("/customers", { method: "POST", body: JSON.stringify(data) });
}

export function updateCustomer(id: string, data: { companyName?: string; contactName?: string; email?: string; phone?: string; address?: string; notes?: string }) {
  return request<CustomerView>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteCustomer(id: string) {
  return request<void>(`/customers/${id}`, { method: "DELETE" });
}

export function mergeCustomers(primaryId: string, mergeIds: string[]) {
  return request<CustomerView>(`/customers/${primaryId}/merge`, { method: "POST", body: JSON.stringify({ mergeIds }) });
}

export function saveCustomerFromRfq(rfqId: string) {
  return request<CustomerView>(`/rfqs/${rfqId}/extracted-customer/save`, { method: "POST" });
}

// Quote Templates
export function getQuoteTemplates(q?: string, page?: number, limit?: number) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page) qs.set("page", String(page));
  if (limit) qs.set("limit", String(limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<QuoteTemplateView>>(`/quote-templates${query}`);
}

export function getQuoteTemplate(id: string) {
  return request<QuoteTemplateView>(`/quote-templates/${id}`);
}

export function createQuoteTemplate(data: {
  name: string;
  description?: string;
  headerNotes?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  currency?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; sortOrder: number; productId?: string }>;
}) {
  return request<QuoteTemplateView>("/quote-templates", { method: "POST", body: JSON.stringify(data) });
}

export function updateQuoteTemplate(id: string, data: {
  name?: string;
  description?: string;
  headerNotes?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  currency?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; sortOrder: number; productId?: string }>;
}) {
  return request<QuoteTemplateView>(`/quote-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteQuoteTemplate(id: string) {
  return request<void>(`/quote-templates/${id}`, { method: "DELETE" });
}

// Catalogue markup
export function updateProductMarkup(id: string, defaultMarkup: number) {
  return request<ProductView>(`/catalogue/${id}/markup`, { method: "PATCH", body: JSON.stringify({ defaultMarkup }) });
}

export function reviseQuote(rfqId: string, quoteId: string) {
  return request<ReviseQuoteResult>(`/rfqs/${rfqId}/quote/${quoteId}/revise`, { method: "POST" });
}

export function getQuoteRevisions(rfqId: string) {
  return request<Array<{ id: string; version: number; status: string; createdAt: string; parentQuoteId: string | null }>>(`/rfqs/${rfqId}/quote/revisions`);
}

export function getQuoteDiff(rfqId: string) {
  return request<QuoteDiffResult>(`/rfqs/${rfqId}/quote/diff`);
}

export function assignRfq(rfqId: string, assignedToId: string | null) {
  return request<{ ok: boolean }>(`/rfqs/${rfqId}/assign`, { method: "PATCH", body: JSON.stringify({ assignedToId }) });
}

export function getSlaConfig() {
  return request<SlaConfigView>("/sla-config");
}

export function updateSlaConfig(input: UpdateSlaConfigInput) {
  return request<SlaConfigView>("/sla-config", { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchRfqsWithAssignment(isRfq?: boolean, pipelineStatus?: string, assignedToId?: string) {
  const qs = new URLSearchParams();
  if (isRfq !== undefined) qs.set("isRfq", String(isRfq));
  if (pipelineStatus) qs.set("pipelineStatus", pipelineStatus);
  if (assignedToId !== undefined) qs.set("assignedToId", assignedToId);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<PaginatedResponse<RfqListItemView>>(`/rfqs${query}`);
}

export function triggerCatalogueEnrichment(catalogueId: string) {
  return request<{ ok: boolean; jobEnqueued: boolean }>(`/catalogue/${catalogueId}/enrich`, { method: "POST" });
}

export function getEnrichmentPreview(catalogueId: string) {
  return request<EnrichmentPreviewResponse>(`/catalogue/${catalogueId}/enrichment-preview`);
}

export function confirmEnrichment(catalogueId: string, input: ConfirmEnrichmentInput) {
  return request<{ confirmed: number }>(`/catalogue/${catalogueId}/enrichment-confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function backfillEmbeddings() {
  return request<{ ok: boolean; message: string }>("/catalogue/backfill-embeddings", { method: "POST" });
}

export function getSetupStatus() {
  return request<SetupStatusView>("/setup/status");
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isEnabled: boolean;
  createdAt: string;
}

export async function listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  return request<WebhookEndpoint[]>("/webhooks/endpoints");
}

export async function createWebhookEndpoint(input: { url: string; events: string[]; secret?: string }): Promise<WebhookEndpoint> {
  return request<WebhookEndpoint>("/webhooks/endpoints", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  return request<void>(`/webhooks/endpoints/${id}`, {
    method: "DELETE",
  });
}

export async function testWebhookEndpoint(id: string): Promise<{ ok: boolean; error?: string }> {
  return request<{ ok: boolean; error?: string }>(`/webhooks/endpoints/${id}/test`, {
    method: "POST",
  });
}

export async function getRfqReplies(rfqId: string): Promise<Array<{
  id: string;
  subject: string | null;
  senderName: string | null;
  body: string | null;
  receivedAt: string;
}>> {
  return request<Array<{
    id: string;
    subject: string | null;
    senderName: string | null;
    body: string | null;
    receivedAt: string;
  }>>(`/rfqs/${rfqId}/replies`);
}
