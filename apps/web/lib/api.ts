import type { IntakeEmailInput, RfqDetailView, RfqListItemView, SaveQuoteInput, UserSummary } from "@auto8/shared";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function buildUrl(path: string) {
  return `${apiBaseUrl}/api${path}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    error?: string;
  };

  const message = Array.isArray(body.message) ? body.message.join(", ") : body.message ?? body.error ?? "Request failed.";
  throw new Error(message);
}

async function request<T>(path: string, init?: RequestInit, userId?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (userId) {
    headers.set("x-user-id", userId);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
    cache: "no-store"
  });

  return parseJson<T>(response);
}

export function fetchUsers() {
  return request<UserSummary[]>("/users");
}

export function fetchRfqs() {
  return request<RfqListItemView[]>("/rfqs");
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

export function saveDraftQuote(rfqId: string, input: SaveQuoteInput, userId: string) {
  return request<RfqDetailView>(`/rfqs/${rfqId}/quote`, {
    method: "PUT",
    body: JSON.stringify(input)
  }, userId);
}

export function submitQuote(quoteId: string, userId: string) {
  return request<RfqDetailView>(`/quotes/${quoteId}/submit`, {
    method: "POST",
    body: JSON.stringify({})
  }, userId);
}

export function approveQuote(quoteId: string, userId: string) {
  return request<RfqDetailView>(`/quotes/${quoteId}/approve`, {
    method: "POST",
    body: JSON.stringify({})
  }, userId);
}
