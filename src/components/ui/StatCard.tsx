'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'indigo' | 'gold' | 'teal' | 'rose' | 'cyan';
  footerIcon?: LucideIcon;
  trend?: string;
  trendIcon?: LucideIcon;
  trendUp?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  footerIcon: FooterIcon,
  trend,
  trendIcon: TrendIcon,
  trendUp,
  onClick,
}) => {
  const valueRef = useRef<HTMLHeadingElement>(null);
  const [fontSize, setFontSize] = useState('1.875rem');

  useEffect(() => {
    const adjust = () => {
      const el = valueRef.current;
      if (!el) return;
      const container = el.parentElement;
      if (!container) return;
      let size = 30;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > container.clientWidth && size > 16) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      setFontSize(`${size}px`);
    };
    adjust();
    window.addEventListener('resize', adjust);
    return () => window.removeEventListener('resize', adjust);
  }, [value]);

  const TrendIconComp = trendUp !== undefined
    ? (trendUp ? TrendingUp : TrendingDown)
    : TrendIcon;

  return (
    <div
      className={`stat-card stat-card-${variant} stat-card-hover`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Background Icon */}
      <div className="background-icon">
        <Icon size={90} />
      </div>

      {/* Top Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 'clamp(0.625rem, 1.5vw, 0.6875rem)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          opacity: 0.85,
          lineHeight: 1.4,
        }}>
          {title}
        </div>
        <div style={{
          width: 36, height: 36,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          backdropFilter: 'blur(4px)',
        }}>
          <Icon size={18} />
        </div>
      </div>

      {/* Value */}
      <div style={{ position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <h3
          ref={valueRef}
          style={{
            fontSize,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {value}
        </h3>
      </div>

      {/* Footer */}
      {(subtitle || trend) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          paddingTop: '0.625rem',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          position: 'relative',
          zIndex: 1,
        }}>
          {trend && TrendIconComp && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.75rem', fontWeight: 700, opacity: 0.9,
            }}>
              <TrendIconComp size={13} />
              <span>{trend}</span>
            </div>
          )}
          {subtitle && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.75rem', opacity: 0.75, marginLeft: 'auto',
            }}>
              {FooterIcon && <FooterIcon size={12} />}
              <span>{subtitle}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
