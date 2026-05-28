import Link from "next/link";
import type { ReactNode } from "react";

import type { AuthUser } from "../lib/auth";
import { logout } from "../lib/auth";

interface WorkspaceShellProps {
  title: string;
  description: string;
  authUser: AuthUser | null;
  children: ReactNode;
}

export function WorkspaceShell({
  title,
  description,
  authUser,
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
          <div className="badge-row">
            {authUser ? (
              <>
                <span className="badge dark">{authUser.role}</span>
                <button
                  className="button-ghost"
                  type="button"
                  onClick={() => {
                    void logout().then(() => {
                      window.location.href = "/login";
                    });
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link className="button-ghost" href="/login">Log in</Link>
            )}
          </div>
        </div>
        {authUser ? (
          <div className="badge-row">
            <span className="badge dark">{authUser.role}</span>
            <Link href="/catalogue" className="button-ghost">Catalogue</Link>
            <Link href="/jobs" className="button-ghost">Jobs</Link>
            {authUser.role === "admin" && (
              <Link href="/connectors" className="button-ghost">Connectors</Link>
            )}
            {authUser.role === "admin" && (
              <Link href="/users" className="button-ghost">Manage Users</Link>
            )}
            {authUser.role === "admin" && (
              <Link href="/settings" className="button-ghost">Settings</Link>
            )}
          </div>
        ) : null}
      </section>
      {children}
    </main>
  );
}
