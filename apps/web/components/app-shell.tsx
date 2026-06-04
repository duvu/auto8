'use client';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
    labelKey: 'operations',
    links: [
      { href: '/rfqs', tKey: 'rfqs', icon: '📋' },
      { href: '/customers', tKey: 'customers', icon: '👥' },
      { href: '/catalogue', tKey: 'catalogue', icon: '📦' },
      { href: '/quote-templates', tKey: 'templates', icon: '📄' },
    ],
  },
  {
    labelKey: 'settings',
    links: [
      { href: '/connectors', tKey: 'connectors', icon: '🔌' },
      { href: '/webhooks', tKey: 'webhooks', icon: '🔔' },
      { href: '/settings/workspace', tKey: 'workspace', icon: '⚙️' },
    ],
    adminOnly: false,
  },
];

const ADMIN_NAV = [
  { href: '/users', tKey: 'users', icon: '👤' },
  { href: '/analytics', tKey: 'analytics', icon: '📊' },
  { href: '/billing', tKey: 'billing', icon: '💳' },
  { href: '/setup', tKey: 'setup', icon: '🚀' },
  { href: '/audit', tKey: 'auditLog', icon: '🔍' },
  { href: '/jobs', tKey: 'jobs', icon: '⚙️' },
];

export function AppShell({ children, title, breadcrumbs, actions }: AppShellProps) {
  const auth = useRequireAuth();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState('en');
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    if (match) setCurrentLocale(match[1]);
  }, []);

  function switchLocale(locale: string) {
    document.cookie = `locale=${locale}; path=/; max-age=31536000`;
    setCurrentLocale(locale);
    router.refresh();
  }

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
          <div key={section.labelKey} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#b8c8d8] px-2 mb-1">{t(section.labelKey as Parameters<typeof t>[0])}</p>
            {section.links.map(link => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link key={link.href} href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                    active ? 'bg-[#c9612c] text-white' : 'text-white hover:bg-white/15'
                  }`}>
                  <span>{link.icon}</span>{t(link.tKey as Parameters<typeof t>[0])}
                </Link>
              );
            })}
          </div>
        ))}
        {isAdmin && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#b8c8d8] px-2 mb-1">{t('admin')}</p>
            {ADMIN_NAV.map(link => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                    active ? 'bg-[#c9612c] text-white' : 'text-white hover:bg-white/15'
                  }`}>
                  <span>{link.icon}</span>{t(link.tKey as Parameters<typeof t>[0])}
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
        <div className="mt-3 flex items-center gap-1">
          {(['en', 'vi', 'zh'] as const).map(locale => (
            <button key={locale} onClick={() => switchLocale(locale)}
              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                currentLocale === locale ? 'bg-[#c9612c] text-white' : 'text-[#b8c8d8] hover:text-white'
              }`}>
              {locale.toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={() => void logout().then(() => { window.location.href = '/login'; })}
          className="mt-2 text-xs text-[#b8c8d8] hover:text-white transition-colors">
          {t('logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen overflow-hidden flex md:grid" style={{ gridTemplateColumns: '220px 1fr', gridTemplateRows: '1fr' }}>
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col h-full overflow-hidden" style={{ background: 'var(--sidebar-bg, #1e1e2e)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <div className={`md:hidden fixed inset-0 z-50 flex transition-opacity duration-200 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <div className={`relative z-10 flex flex-col w-64 h-full transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: 'var(--sidebar-bg, #1e1e2e)' }}>
          <SidebarContent />
        </div>
      </div>

      {/* Right column: toolbar + content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top toolbar */}
        <header className="flex-shrink-0 h-14 flex items-center gap-4 px-4 sm:px-6 bg-white border-b border-[#e5e7eb] z-20">
          {/* Hamburger (mobile) */}
          <button className="md:hidden p-1.5 rounded-md text-[#6b7280] hover:bg-gray-100 flex-shrink-0"
            onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb / title */}
          <div className="flex items-center gap-2 min-w-0">
            {breadcrumbs?.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2 flex-shrink-0">
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
                className="w-full text-sm border border-[#e5e7eb] rounded-lg px-3 py-1.5 pl-8 focus:outline-none focus:ring-2 focus:ring-[#c9612c]/30 focus:border-[#c9612c]" />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Actions slot */}
          {actions && <div className="flex items-center gap-2 ml-auto flex-shrink-0">{actions}</div>}

          {/* User menu */}
          <div className="relative ml-auto flex-shrink-0" ref={userMenuRef}>
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
                  className="block px-3 py-2 text-sm text-[#111827] hover:bg-gray-50">{t('settings')}</Link>
                <button onClick={() => void logout().then(() => { window.location.href = '/login'; })}
                  className="w-full text-left px-3 py-2 text-sm text-[#dc2626] hover:bg-gray-50">{t('logout')}</button>
              </div>
            )}
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-4 sm:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav (visible only on <md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#e5e7eb] flex items-stretch h-16 safe-area-inset-bottom">
        {[
          { href: '/rfqs', icon: '📋', tKey: 'rfqs' },
          { href: '/customers', icon: '👥', tKey: 'customers' },
          { href: '/catalogue', icon: '📦', tKey: 'catalogue' },
          { href: '/connectors', icon: '🔌', tKey: 'connectors' },
          { href: '/analytics', icon: '📊', tKey: 'analytics', adminOnly: true },
          { href: '/settings/workspace', icon: '⚙️', tKey: 'settings', nonAdmin: true },
        ]
          .filter(link => {
            if ('adminOnly' in link && link.adminOnly) return isAdmin;
            if ('nonAdmin' in link && link.nonAdmin) return !isAdmin;
            return true;
          })
          .slice(0, 5)
          .map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                  active ? 'text-[#c9612c]' : 'text-[#6b7280] hover:text-[#111827]'
                }`}>
                <span className="text-lg leading-none">{link.icon}</span>
                <span>{t(link.tKey as Parameters<typeof t>[0])}</span>
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
