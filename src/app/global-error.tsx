'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.message?.includes('Failed to load chunk') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('ChunkLoadError') ||
    error.name === 'ChunkLoadError';

  const purgeAndReload = async (manual = false) => {
    try {
      if (manual) {
        sessionStorage.removeItem('chunk_reload_at');
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_bust', String(Date.now()));
    window.location.replace(url.toString());
  };

  useEffect(() => {
    console.error('Global application error:', error);

    if (isChunkError) {
      const key = 'chunk_reload_at';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (!last || Date.now() - last > 60000) {
        sessionStorage.setItem(key, String(Date.now()));
        purgeAndReload(false);
      }
    }
  }, [error, isChunkError]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', color: '#f5f5f5' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
              {isChunkError ? 'Page Reload Required' : 'Application Error'}
            </h1>
            <p style={{ color: '#a3a3a3', marginBottom: '1.5rem' }}>
              {isChunkError
                ? 'A new version of the app was published. Click below to refresh your browser cache.'
                : (error.message || 'A critical error occurred. Please reload the application.')}
            </p>
            <button
              type="button"
              onClick={() => {
                if (isChunkError) {
                  purgeAndReload(true);
                } else {
                  reset();
                }
              }}
              style={{
                padding: '0.625rem 1.25rem',
                background: '#D4AF37',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isChunkError ? 'Refresh & Clear Cache' : 'Try again'}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
