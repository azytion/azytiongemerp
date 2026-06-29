'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

export default function DateTimeWidget() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '0.25rem',
      padding: '0.75rem 1.125rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      minWidth: 200,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '1.1875rem',
        fontWeight: 700,
        color: 'var(--foreground)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
      }}>
        <Clock size={17} color="var(--primary)" />
        {timeStr}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontSize: '0.8125rem',
        color: 'var(--muted-foreground)',
      }}>
        <Calendar size={13} />
        {dateStr}
      </div>
    </div>
  );
}
