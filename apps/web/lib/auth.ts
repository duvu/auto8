const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  name: string;
}

let cachedUser: AuthUser | null | undefined = undefined; // undefined = not yet fetched

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id: string; email: string; name: string; role: string };
    return { id: data.id, email: data.email, name: data.name, role: data.role };
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (cachedUser !== undefined) return cachedUser;
  cachedUser = await fetchMe();
  return cachedUser;
}

export function clearUserCache(): void {
  cachedUser = undefined;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Invalid email or password.");
  }

  cachedUser = undefined; // clear cache so next getAuthUser() fetches fresh
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore errors on logout
  }
  cachedUser = null;
}

export async function isLoggedIn(): Promise<boolean> {
  const user = await getAuthUser();
  return user !== null;
}
