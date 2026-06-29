'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip
} from 'recharts';
import { formatDate, formatCurrency } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';
import { ChartContainer } from '@/components/ui/ChartContainer';

interface ChartData {
  day: string;
  total: number;
  profit?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-3)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '0.75rem 1rem',
      boxShadow: 'var(--shadow-lg)',
      minWidth: 160,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem', fontWeight: 600 }}>
        {label}
      </div>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', gap: '1rem',
          fontSize: '0.8125rem', fontWeight: 700,
          color: entry.color,
          marginBottom: i < payload.length - 1 ? '0.25rem' : 0,
        }}>
          <span style={{ fontWeight: 500, color: 'var(--muted-foreground)' }}>{entry.name}</span>
          <span>{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardCharts({ data }: { data: ChartData[] }) {
  const formattedData = data.map(item => ({
    day: formatDate(item.day, { showTime: false }),
    Revenue: item.total,
    Profit: item.profit || 0,
  }));

  return (
    <div className="card" style={{ padding: 'var(--space-md)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--primary-subtle)',
            border: '1px solid rgba(212,175,55,0.15)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <BarChart3 size={16} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Sales & Profit Trend</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Last 7 days performance</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--primary)' }} />
            <span style={{ color: 'var(--muted-foreground)' }}>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)' }} />
            <span style={{ color: 'var(--muted-foreground)' }}>Profit</span>
          </div>
        </div>
      </div>

      <ChartContainer height={280}>
        <ComposedChart data={formattedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="day"
            stroke="var(--muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            stroke="var(--muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)' }}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar
            dataKey="Revenue"
            fill="var(--primary)"
            radius={[5, 5, 0, 0]}
            barSize={28}
            opacity={0.9}
          />
          <Line
            type="monotone"
            dataKey="Profit"
            stroke="var(--success)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--success)', strokeWidth: 2, stroke: 'var(--surface)' }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
