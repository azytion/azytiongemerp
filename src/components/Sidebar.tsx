'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, FileText, Settings,
  LogOut, DollarSign, Sparkles, Shield, ChevronLeft, ChevronRight,
  BarChart3, ClipboardList, Gem, Users,
  Boxes, Award, TrendingUp, X
} from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { useSidebar } from './SidebarProvider';

type SidebarProps = {
  session: { role?: string; username?: string; [key: string]: any } | null;
  settings?: Record<string, string>;
};

type NavItem = { href: string; label: string; icon: React.ElementType; roles: string[]; badge?: string };
type NavSection = { label: string; items: NavItem[] };

export default function Sidebar({ session, settings: initialSettings }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, isMobile, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebar();
  const [companyName, setCompanyName] = useState('Azytion GemERP');
  const [featureSettings, setFeatureSettings] = useState<Record<string, string>>(initialSettings || {});

  useEffect(() => {
    fetch('/api/settings/company_name')
      .then(r => r.json())
      .then(d => { if (d.value) setCompanyName(d.value); })
      .catch(() => {});
    fetch('/api/settings/app')
      .then(r => r.json())
      .then(d => {
        if (d.app_name) setCompanyName(d.app_name);
      })
      .catch(() => {});
    fetch('/api/settings/features')
      .then(r => r.json())
      .then(d => { if (d) setFeatureSettings(prev => ({ ...prev, ...d })); })
      .catch(() => {});
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) closeMobileSidebar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!session) return null;

  const role = (session.role as string) || 'guest';
  const username = (session.username as string) || 'Guest';
  const isSuperAdmin = role === 'super_admin';
  const feat = (key: string) => isSuperAdmin || featureSettings[key] !== 'false';

  const sections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { href: '/super-admin', label: 'SaaS Controls', icon: Shield, roles: ['super_admin'] },
        { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'super_admin'] },
        ...(feat('feature_ai_enabled') ? [{ href: '/ai', label: 'AI Assistant', icon: Sparkles, roles: ['admin', 'manager', 'super_admin'] as string[] }] : []),
      ]
    },
    {
      label: 'Sales',
      items: [
        { href: '/pos', label: 'POS Terminal', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier', 'super_admin'] },
        { href: '/sales', label: 'Sales History', icon: FileText, roles: ['admin', 'manager', 'cashier', 'super_admin'] },
        { href: '/contacts', label: 'Contacts', icon: Users, roles: ['admin', 'manager', 'super_admin'] },
        ...(feat('feature_memos_enabled') ? [{ href: '/memos', label: 'Consignments', icon: ClipboardList, roles: ['admin', 'manager', 'super_admin'] as string[] }] : []),
      ]
    },
    {
      label: 'Inventory',
      items: [
        { href: '/products', label: 'Products', icon: Gem, roles: ['admin', 'manager', 'cashier', 'super_admin'] },
        ...(feat('feature_certificates_enabled') ? [{ href: '/certificates', label: 'Certificates', icon: Award, roles: ['admin', 'manager', 'super_admin'] as string[] }] : []),
        { href: '/inventory-management', label: 'Inventory Mgmt', icon: Boxes, roles: ['admin', 'manager', 'super_admin'] },
      ]
    },
    {
      label: 'Finance',
      items: [
        { href: '/finance', label: 'Finance', icon: DollarSign, roles: ['admin', 'super_admin'] },
        ...(feat('feature_valuation_enabled') ? [{ href: '/valuation', label: 'Valuation', icon: TrendingUp, roles: ['admin', 'manager', 'super_admin'] as string[] }] : []),
        { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager', 'super_admin'] },
      ]
    },
    {
      label: 'System',
      items: [
        { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'super_admin'] },
      ]
    }
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    const base = href.split('?')[0];
    return pathname === base || pathname.startsWith(base + '/');
  };

  const roleInitial = username.charAt(0).toUpperCase();
  const roleGradient = role === 'admin' || role === 'super_admin'
    ? 'linear-gradient(135deg, #F0D060 0%, #D4AF37 100%)'
    : role === 'manager'
    ? 'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)'
    : 'linear-gradient(135deg, #34D399 0%, #059669 100%)';

  // On mobile: drawer mode (slides in from left, with overlay)
  // On desktop: fixed sidebar with collapse toggle
  const sidebarVisible = isMobile ? isMobileOpen : !isCollapsed;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && isMobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className="sidebar"
        style={{
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: isMobile ? 200 : 50,
        }}
      >
        {/* Logo / Header */}
        <div className="logo-container">
          <img
            src="/azytion-brand-logo-512.png"
            alt="Logo"
            style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 800, fontSize: '1.0625rem',
              color: 'var(--foreground)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '-0.02em',
            }}>
              {companyName}
            </div>
          </div>
          {/* Close button on mobile */}
          {isMobile && (
            <button
              type="button"
              onClick={closeMobileSidebar}
              aria-label="Close menu"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--muted-foreground)',
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="nav">
          {sections.map((section) => {
            const visibleItems = section.items.filter(item => item.roles.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} style={{ marginBottom: '0.25rem' }}>
                <div className="nav-section-label">{section.label}</div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
                      <Icon size={16} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.8375rem' }}>{item.label}</span>
                      {item.badge && (
                        <span style={{ background: 'var(--primary)', color: '#000', fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', borderRadius: 99 }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.625rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: roleGradient, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              {roleInitial}
            </div>
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--foreground)' }}>
                {username}
              </div>
              <div style={{ fontSize: '0.625rem', color: role === 'admin' || role === 'super_admin' ? 'var(--primary)' : 'var(--muted-foreground)', textTransform: 'capitalize', fontWeight: 600, letterSpacing: '0.04em' }}>
                {role.replace('_', ' ')}
              </div>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', background: 'transparent', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius)', color: 'var(--destructive)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.2)'; }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Desktop collapse toggle button — hidden on mobile via CSS */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
        className={`sidebar-toggle-btn ${isCollapsed ? 'collapsed' : ''}`}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </>
  );
}
