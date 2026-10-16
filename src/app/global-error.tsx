'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);

    // Chunk load failures after a new deployment → hard-reload once to fetch fresh chunks
    const isChunkError =
      error.message?.includes('Failed to load chunk') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError';

    if (isChunkError) {
      const key = 'chunk_reload_attempted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  }, [error]);

  const isChunkError =
    error.message?.includes('Failed to load chunk') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('ChunkLoadError') ||
    error.name === 'ChunkLoadError';

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
                ? 'The app was updated. Please reload to get the latest version.'
                : (error.message || 'A critical error occurred. Please reload the application.')}
            </p>
            <button
              type="button"
              onClick={() => {
                if (isChunkError) {
                  sessionStorage.removeItem('chunk_reload_attempted');
                  window.location.reload();
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
              {isChunkError ? 'Reload Page' : 'Try again'}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
