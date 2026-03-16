import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Inbox, Settings, GraduationCap, LogOut, User, ChevronLeft, ChevronRight, BookOpen, LayoutDashboard, GitMerge, CalendarDays } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/inbox', icon: Inbox, label: 'Inbox' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/settings/rulebook', icon: BookOpen, label: 'Rulebook' },
  { path: '/settings/routing', icon: GitMerge, label: 'Routing Rules' },
  { path: '/settings/calendar', icon: CalendarDays, label: 'Calendar' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentUser, logout, getOffice } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const office = currentUser ? getOffice(currentUser.officeId) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}
        style={{ background: 'hsl(var(--sidebar-bg))', borderRight: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3 gap-2.5" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" style={{ width: 18, height: 18 }} />
          </div>
          {!collapsed && <span className="font-bold text-sm" style={{ color: 'hsl(var(--sidebar-fg))' }}>CampusReply</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active =
              location.pathname === path ||
              (path === '/inbox' && location.pathname.startsWith('/ticket'));
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? 'text-primary-foreground' : 'hover:opacity-80'
                }`}
                style={{
                  background: active ? 'hsl(var(--sidebar-active-bg))' : 'transparent',
                  color: active ? 'hsl(var(--sidebar-fg))' : 'hsl(var(--sidebar-muted))',
                }}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-2 space-y-1" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
          {!collapsed && currentUser && (
            <div className="px-2 py-2 rounded-md" style={{ background: 'hsl(var(--sidebar-border))' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: 'hsl(var(--sidebar-fg))' }}>{currentUser.name}</div>
                  <div className="text-xs truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>{office?.name}</div>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors hover:opacity-80"
            style={{ color: 'hsl(var(--sidebar-muted))' }}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-md transition-colors hover:opacity-80"
            style={{ color: 'hsl(var(--sidebar-muted))' }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
          <h1 className="font-semibold text-foreground text-sm">
            {location.pathname === '/dashboard' && 'Dashboard'}
            {location.pathname === '/inbox' && 'Inbox'}
            {location.pathname.startsWith('/ticket/') && 'Ticket Detail'}
            {location.pathname === '/settings' && 'Settings'}
            {location.pathname === '/settings/rulebook' && 'Rulebook & Responsibility Layers'}
            {location.pathname === '/settings/routing' && 'Routing Rules'}
            {location.pathname === '/settings/calendar' && 'Calendar Integration'}
          </h1>
          {office && (
            <span className="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded-full">
              {office.name}
            </span>
          )}
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
