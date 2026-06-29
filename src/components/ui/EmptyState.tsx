import { LucideIcon } from 'lucide-react';
import React from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3.5rem 2rem',
      textAlign: 'center',
      border: '1px dashed var(--border-strong)',
      borderRadius: 'var(--radius-xl)',
      background: 'rgba(255,255,255,0.01)',
      minHeight: 280,
    }}>
      <div style={{
        width: 72, height: 72,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <Icon size={32} color="var(--muted)" style={{ opacity: 0.6 }} />
      </div>
      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
        {title}
      </h3>
      <p style={{
        color: 'var(--muted-foreground)',
        fontSize: '0.875rem',
        marginBottom: action ? '1.5rem' : 0,
        maxWidth: 360,
        lineHeight: 1.6,
      }}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
