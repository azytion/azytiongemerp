'use client';

import { useSidebar } from './SidebarProvider';

export function MainContent({ children, hasSession }: { children: React.ReactNode; hasSession: boolean }) {
  const { isCollapsed, isMobile, openMobileSidebar } = useSidebar();

  return (
    <main
      className={hasSession ? 'main-content main-content--with-session' : 'main-content'}
      style={{
        flex: 1,
        padding: hasSession
          ? (isMobile ? 'calc(var(--mobile-header-height) + 1rem) 0.875rem 1rem' : '2rem')
          : '0',
        marginLeft: hasSession && !isMobile ? (isCollapsed ? '0' : 'var(--sidebar-width, 256px)') : '0',
        minWidth: 0,
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: '100vh',
        background: 'var(--background)',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Mobile Header Toggle */}
      {hasSession && isMobile && (
        <div className="mobile-header">
          <button
            type="button"
            onClick={openMobileSidebar}
            className="mobile-header-menu-btn"
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
            ZATION GemERP
          </div>
        </div>
      )}

      {/* Animated background effects */}
      {hasSession && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          {/* Top-right gold orb */}
          <div style={{
            position: 'absolute',
            top: '-15%',
            right: '-10%',
            width: '50vw',
            height: '50vw',
            maxWidth: 700,
            maxHeight: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 65%)',
            animation: 'bgOrb1 18s ease-in-out infinite',
          }} />
          {/* Bottom-left blue orb */}
          <div style={{
            position: 'absolute',
            bottom: '-20%',
            left: '-5%',
            width: '45vw',
            height: '45vw',
            maxWidth: 600,
            maxHeight: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)',
            animation: 'bgOrb2 22s ease-in-out infinite',
          }} />
          {/* Center subtle grid */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
          }} />
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </main>
  );
}
