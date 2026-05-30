"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { AuthUser } from "../lib/auth";
import { logout } from "../lib/auth";
import { LanguageSwitcher } from "./language-switcher";

interface WorkspaceShellProps {
  title: string;
  description: string;
  authUser: AuthUser | null;
  children: ReactNode;
  section?: string;
}

export function WorkspaceShell({
  title,
  description,
  authUser,
  children,
  section = "RFQs"
}: WorkspaceShellProps) {
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const navLinks = authUser ? (
    <>
      <Link
        href="/catalogue"
        className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
        onClick={() => setMenuOpen(false)}
      >
        {t("catalogue")}
      </Link>
      <Link
        href="/customers"
        className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
        onClick={() => setMenuOpen(false)}
      >
        {t("customers")}
      </Link>
      <Link
        href="/jobs"
        className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
        onClick={() => setMenuOpen(false)}
      >
        {t("jobs")}
      </Link>
      {authUser.role === "admin" && (
        <>
          <Link
            href="/connectors"
            className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {t("connectors")}
          </Link>
          <Link
            href="/users"
            className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {t("users")}
          </Link>
          <Link
            href="/quote-templates"
            className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {t("templates")}
          </Link>
          <Link
            href="/setup"
            className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {t("setup")}
          </Link>
          <Link
            href="/webhooks"
            className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {t("webhooks")}
          </Link>
          <Link
            href="/settings"
            className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {t("settings")}
          </Link>
        </>
      )}
      <span className="badge dark ml-2">{authUser.role}</span>
      <button
        type="button"
        className="ml-2 text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
        onClick={() => {
          void logout().then(() => {
            window.location.href = "/login";
          });
        }}
      >
        {t("logout")}
      </button>
    </>
  ) : (
    <Link
      href="/login"
      className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
      onClick={() => setMenuOpen(false)}
    >
      {t("login")}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4" ref={menuRef}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-ink text-sm tracking-tight">auto8</span>
          <span className="text-muted text-sm">/</span>
          <span className="text-sm text-muted">{section}</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks}
          <div className="ml-3 pl-3 border-l border-border">
            <LanguageSwitcher />
          </div>
        </nav>

        {/* Hamburger button (mobile only) */}
        <button
          type="button"
          className="md:hidden p-2 rounded-md text-muted hover:text-ink hover:bg-accent-soft transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 right-0 z-40 bg-surface border-b border-border shadow-lg md:hidden">
            <nav className="flex flex-col gap-1 px-4 py-3">
              {navLinks}
              <div className="mt-2 pt-2 border-t border-border">
                <LanguageSwitcher />
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main content — fluid width, responsive padding */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="text-sm text-muted mt-1">{description}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
