'use client';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRequireAuth } from '../lib/use-require-auth';
import { logout } from '../lib/auth';

interface AppShellProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}

const NAV_SECTIONS = [
  {
    label: 'Operations',
    links: [
      { href: '/rfqs', label: 'RFQs', icon: '📋' },
      { href: '/customers', label: 'Customers', icon: '👥' },
      { href: '/catalogue', label: 'Catalogue', icon: '📦' },
      { href: '/quote-templates', label: 'Templates', icon: '📄' },
    ],
  },
  {
    label: 'Settings',
    links: [
      { href: '/connectors', label: 'Connectors', icon: '🔌' },
      { href: '/webhooks', label: 'Webhooks', icon: '🔔' },
      { href: '/settings/workspace', label: 'Workspace', icon: '⚙️' },
    ],
    adminOnly: false,
  },
];

const ADMIN_NAV = [
  { href: '/users', label: 'Users', icon: '👤' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/setup', label: 'Setup', icon: '🚀' },
  { href: '/audit', label: 'Audit Log', icon: '🔍' },
  { href: '/jobs', label: 'Jobs', icon: '⚙️' },
];

export function AppShell({ children, title, breadcrumbs, actions }: AppShellProps) {
  const auth = useRequireAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // '/' shortcut to focus search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  if (!auth) return null; // loading
  if (auth.forbidden) return (
    <div className="flex items-center justify-center h-screen text-[#6b7280]">
      <p>You don&apos;t have permission to view this page.</p>
    </div>
  );

  const user = auth.user;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const initials = user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <span className="text-lg font-bold text-white">auto8</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#b8c8d8] px-2 mb-1">{section.label}</p>
            {section.links.map(link => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link key={link.href} href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                    active ? 'bg-[#c9612c] text-white' : 'text-white hover:bg-white/15'
                  }`}>
                  <span>{link.icon}</span>{link.label}
                </Link>
              );
            })}
          </div>
        ))}
        {isAdmin && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#b8c8d8] px-2 mb-1">Admin</p>
            {ADMIN_NAV.map(link => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                    active ? 'bg-[#c9612c] text-white' : 'text-white hover:bg-white/15'
                  }`}>
                  <span>{link.icon}</span>{link.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User info at bottom */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-sm font-medium text-white">{user.name}</p>
        <p className="text-xs text-[#b8c8d8] capitalize">{user.role.replace('_', ' ')}</p>
        <button onClick={() => void logout().then(() => { window.location.href = '/login'; })}
          className="mt-2 text-xs text-[#b8c8d8] hover:text-white transition-colors">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen overflow-hidden grid" style={{ gridTemplateColumns: '220px 1fr', gridTemplateRows: '1fr' }}>
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col h-full overflow-hidden" style={{ background: 'var(--sidebar-bg, #1e1e2e)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col w-64 h-full" style={{ background: 'var(--sidebar-bg, #1e1e2e)' }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Right column: toolbar + content */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top toolbar */}
        <header className="flex-shrink-0 h-14 flex items-center gap-4 px-4 lg:px-6 bg-white border-b border-[#e5e7eb] z-20">
          {/* Hamburger (mobile) */}
          <button className="lg:hidden p-1.5 rounded-md text-[#6b7280] hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb / title */}
          <div className="flex items-center gap-2 min-w-0">
            {breadcrumbs?.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="text-sm text-[#6b7280] hover:text-[#111827]">{crumb.label}</Link>
                ) : (
                  <span className="text-sm text-[#111827] font-medium">{crumb.label}</span>
                )}
                {i < (breadcrumbs?.length ?? 0) - 1 && <span className="text-[#d1d5db] text-sm">/</span>}
              </span>
            ))}
            {!breadcrumbs && title && (
              <h1 className="text-base font-semibold text-[#111827] truncate">{title}</h1>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="relative">
              <input ref={searchRef} type="text" placeholder="Search… (/)"
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                className="w-full text-sm border border-[#e5e7eb] rounded-lg px-3 py-1.5 pl-8 focus:outline-none focus:ring-2 focus:ring-[#c9612c]/30 focus:border-[#c9612c]" />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Actions slot */}
          {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}

          {/* User menu */}
          <div className="relative ml-auto" ref={userMenuRef}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-8 h-8 rounded-full bg-[#c9612c] text-white text-xs font-bold flex items-center justify-center hover:bg-[#b85526] transition-colors">
              {initials}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-[#e5e7eb] shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-[#e5e7eb]">
                  <p className="text-sm font-medium text-[#111827]">{user.name}</p>
                  <p className="text-xs text-[#6b7280] capitalize">{user.role.replace('_', ' ')}</p>
                </div>
                <Link href="/settings/workspace" onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-[#111827] hover:bg-gray-50">Settings</Link>
                <button onClick={() => void logout().then(() => { window.location.href = '/login'; })}
                  className="w-full text-left px-3 py-2 text-sm text-[#dc2626] hover:bg-gray-50">Sign out</button>
              </div>
            )}
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
