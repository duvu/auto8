"use client";

import { useEffect, useState } from "react";

import type { AuthUser } from "./auth";
import { getAuthUser } from "./auth";

export function useAuthUser(): AuthUser | null {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    void getAuthUser().then(setAuthUser);
  }, []);
  return authUser;
}
