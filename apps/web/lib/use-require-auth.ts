"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { AuthUser } from "./auth";
import { getAuthUser } from "./auth";

/**
 * Hook that enforces authentication (and optionally role) on a page.
 * - Returns null while the auth state is resolving (page should render nothing).
 * - Redirects to /login if no user is found.
 * - Returns the AuthUser when authenticated (and role matches if required).
 *
 * @param requiredRole - If provided, the user must have exactly this role.
 *                       If the user lacks the role, the hook returns a sentinel
 *                       `{ forbidden: true }` so the page can render a 403 message.
 */
export type RequireAuthResult =
  | { user: AuthUser; forbidden: false }
  | { user: null; forbidden: true }
  | null; // still loading

export function useRequireAuth(requiredRole?: string): RequireAuthResult {
  const [result, setResult] = useState<RequireAuthResult>(null);
  const router = useRouter();

  useEffect(() => {
    void getAuthUser().then((authUser) => {
      if (!authUser) {
        router.replace("/login");
        return;
      }
      if (requiredRole && authUser.role !== "admin" && authUser.role !== requiredRole) {
        setResult({ user: null, forbidden: true });
        return;
      }
      setResult({ user: authUser, forbidden: false });
    });
  }, [requiredRole, router]);

  return result;
}
