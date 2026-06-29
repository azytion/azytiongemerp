export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="skeleton skeleton-title" style={{ width: 220 }} />
          <div className="skeleton skeleton-text" style={{ width: 300 }} />
        </div>
        <div className="skeleton" style={{ width: 180, height: 52, borderRadius: 'var(--radius-lg)' }} />
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-xl)' }} />
        ))}
      </div>

      {/* Main content skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-lg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    </div>
  );
}
