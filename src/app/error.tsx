'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);

    // Chunk load failures (e.g., after a new deployment) → hard-reload once to fetch fresh chunks
    const isChunkError =
      error.message?.includes('Failed to load chunk') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError';

    if (isChunkError) {
      // Avoid reload loops: only auto-reload once per session
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
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          width: '100%',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
          }}
        >
          <AlertTriangle size={28} color="var(--destructive)" />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {isChunkError ? 'Page Reload Required' : 'Something went wrong'}
        </h2>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {isChunkError
            ? 'The app was updated. Please reload to get the latest version.'
            : (error.message || 'An unexpected error occurred while loading this page.')}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (isChunkError) {
              sessionStorage.removeItem('chunk_reload_attempted');
              window.location.reload();
            } else {
              reset();
            }
          }}
        >
          <RefreshCw size={16} />
          {isChunkError ? 'Reload Page' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
