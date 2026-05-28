import type { AuditLogQueryParams, AuditLogView, BackgroundJobView, ConnectorTestResult, ConnectorView, CreateConnectorInput, GenerateQuoteResult, IngestionMetricsSummary, IngestionRunView, IntakeEmailInput, LlmSettingView, LlmTestResult, PaginatedResponse, ProductView, QuoteEmailDraftView, RfqDetailView, RfqExtractedCustomerView, RfqExtractedItemView, RfqItemMatchView, RfqListItemView, SaveQuoteInput, UpdateConnectorInput, UpdateLlmSettingInput, UpdateQuoteEmailInput, UserView, CatalogueUploadResult } from "@auto8/shared";

import { logout } from "./auth";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function buildUrl(path: string) {
  return `${apiBaseUrl}/api${path}`;
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

export function fetchUsers() {
  return request<PaginatedResponse<UserView>>("/users");
}

export function fetchRfqs(isRfq?: boolean, pipelineStatus?: string) {
  const qs = new URLSearchParams();
  if (isRfq !== undefined) qs.set("isRfq", String(isRfq));
  if (pipelineStatus) qs.set("pipelineStatus", pipelineStatus);
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
  return request<{ id: string; status: string; sentAt: string }>(`/quotes/${quoteId}/email/send`, {
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
  return request<Array<{ extractedItem: RfqExtractedItemView; matches: RfqItemMatchView[] }>>(`/rfqs/${rfqId}/matches`);
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
export function getUsers() {
  return request<PaginatedResponse<UserView>>("/users");
}

export function createUser(data: { email: string; name: string; role: string; password: string }) {
  return request<UserView>("/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(id: string, data: { name?: string; role?: string; password?: string; isActive?: boolean }) {
  return request<UserView>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteUser(id: string) {
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
