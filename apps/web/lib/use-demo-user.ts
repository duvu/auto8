"use client";

import { useEffect, useMemo, useState } from "react";

import type { UserSummary } from "@auto8/shared";

const storageKey = "auto8-selected-user-id";

export function useDemoUser(users: UserSummary[]) {
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (!users.length) {
      return;
    }

    const savedUserId = window.localStorage.getItem(storageKey);
    const nextUserId = savedUserId && users.some((user) => user.id === savedUserId) ? savedUserId : users[0].id;
    setSelectedUserId((current) => current || nextUserId);
  }, [users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  function selectUser(nextUserId: string) {
    setSelectedUserId(nextUserId);
    window.localStorage.setItem(storageKey, nextUserId);
  }

  return {
    selectedUserId,
    selectedUser,
    selectUser
  };
}
