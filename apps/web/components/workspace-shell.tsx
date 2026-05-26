import type { ReactNode } from "react";

import type { UserSummary } from "@auto8/shared";

interface WorkspaceShellProps {
  title: string;
  description: string;
  selectedUser: UserSummary | null;
  selectedUserId: string;
  users: UserSummary[];
  onUserChange: (userId: string) => void;
  children: ReactNode;
}

export function WorkspaceShell({
  title,
  description,
  selectedUser,
  selectedUserId,
  users,
  onUserChange,
  children
}: WorkspaceShellProps) {
  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / MVP1</div>
        <div className="panel-header">
          <div className="stack">
            <h1>{title}</h1>
            <p className="panel-subtitle">{description}</p>
          </div>
          <label>
            Acting User
            <select value={selectedUserId} onChange={(event) => onUserChange(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedUser ? (
          <div className="badge-row">
            <span className="badge dark">{selectedUser.name}</span>
            <span className={`badge ${selectedUser.role === "sales_approver" ? "success" : ""}`}>{selectedUser.role}</span>
            <span className="badge dark">{selectedUser.email}</span>
          </div>
        ) : null}
      </section>
      {children}
    </main>
  );
}
