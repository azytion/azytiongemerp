'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  height: number;
  children: ReactElement;
  minWidth?: number;
}

/**
 * Recharts ResponsiveContainer needs a parent with measurable dimensions.
 * Percentage heights inside flex layouts often resolve to -1; use explicit pixel height instead.
 */
export function ChartContainer({ height, children, minWidth = 200 }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(Math.floor(rect.width), minWidth);
      const measuredHeight = Math.max(Math.floor(rect.height), height);
      if (width > 0 && measuredHeight > 0) {
        setSize((prev) =>
          prev.width === width && prev.height === measuredHeight ? prev : { width, height: measuredHeight }
        );
      }
    };

    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [height, minWidth]);

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        height,
        minWidth: 0,
        minHeight: height,
        position: 'relative',
      }}
    >
      {size.width > 0 && size.height > 0 ? (
        <ResponsiveContainer width={size.width} height={size.height} debounce={50}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div style={{ width: '100%', height, minHeight: height }} aria-hidden />
      )}
    </div>
  );
}
