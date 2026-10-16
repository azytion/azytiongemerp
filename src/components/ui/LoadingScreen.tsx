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
      // Keep the startup screen branded even if the app stylesheet fails to load.
      background: '#0B132B',
      color: '#F8FAFC',
      fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
        background: 'rgba(212,175,55,0.08)',
        border: '2px solid rgba(212,175,55,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 16px 40px rgba(212,175,55,0.3), 0 4px 12px rgba(212,175,55,0.15)',
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
          background: 'linear-gradient(135deg, #F0D060 0%, #D4AF37 45%, #A67C00 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {appName}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#94A3B8', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#D4AF37',
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
        background: 'linear-gradient(90deg, transparent, #D4AF37, #E6C84A, #D4AF37, transparent)',
        backgroundSize: '200% 100%',
        animation: 'goldShimmer 2s linear infinite',
      }} />
    </div>
  );
}
