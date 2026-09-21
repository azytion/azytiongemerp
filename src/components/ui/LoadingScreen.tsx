/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';

export default function LoadingScreen() {
  const [appName, setAppName] = useState('Azytion GemERP');
  const logoSrc = '/azytion-brand-logo-512.png';

  useEffect(() => {
    fetch('/api/settings/app')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.app_name) setAppName(d.app_name);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'var(--background)',
      color: 'var(--foreground)',
      gap: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60vw', height: '60vw',
        maxWidth: 600, maxHeight: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{
        width: 96, height: 96,
        borderRadius: 24,
        background: 'var(--primary-subtle)',
        border: '2px solid rgba(212,175,55,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-gold-lg)',
        animation: 'pulse 2.5s ease-in-out infinite',
        position: 'relative',
        zIndex: 1,
      }}>
        <img
          src={logoSrc}
          alt={appName}
          style={{ width: 60, height: 60, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.4))' }}
        />
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          marginBottom: '0.5rem',
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {appName}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--primary)',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <span>Initializing System...</span>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 3,
        background: 'linear-gradient(90deg, transparent, var(--primary), var(--primary-light), var(--primary), transparent)',
        backgroundSize: '200% 100%',
        animation: 'goldShimmer 2s linear infinite',
      }} />
    </div>
  );
}
