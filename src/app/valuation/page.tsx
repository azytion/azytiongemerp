'use client';

import { useQuery } from '@tanstack/react-query';
import { getInventoryValuation } from '@/app/actions/analytics';
import { getTopSellingItems } from '@/app/actions/analytics';
import { getProducts } from '@/app/actions/products';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, DollarSign, Package, Gem, BarChart3, PieChart, ArrowUpRight, Loader2 } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';

const CHART_COLORS = ['#D4AF37', '#3B82F6', '#10B981', '#A78BFA', '#F59E0B', '#22D3EE', '#F472B6', '#34D399'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-3)', border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
      boxShadow: 'var(--shadow-lg)', fontSize: '0.8125rem',
    }}>
      {label && <div style={{ color: 'var(--muted-foreground)', marginBottom: '0.375rem', fontWeight: 600 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function ValuationPage() {
  const { data: valuation, isLoading: valLoading } = useQuery({
    queryKey: ['valuation'],
    queryFn: getInventoryValuation,
    staleTime: 1000 * 60,
  });

  const { data: topSelling, isLoading: topLoading } = useQuery({
    queryKey: ['top-selling-valuation'],
    queryFn: () => getTopSellingItems(10),
    staleTime: 1000 * 60,
  });

  const { data: productsData, isLoading: prodLoading } = useQuery({
    queryKey: ['products-valuation'],
    queryFn: () => getProducts('', undefined, 1, 200),
    staleTime: 1000 * 60,
  });

  const isLoading = valLoading || topLoading || prodLoading;

  // Category breakdown from products
  const categoryBreakdown = (() => {
    if (!productsData?.data) return [];
    const map: Record<string, { name: string; value: number; count: number }> = {};
    productsData.data.forEach((p: any) => {
      const cat = p.category_name || 'Uncategorized';
      if (!map[cat]) map[cat] = { name: cat, value: 0, count: 0 };
      map[cat].value += p.selling_price * p.stock;
      map[cat].count += 1;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  })();

  const topSellingChart = (topSelling || []).slice(0, 8).map((item: any) => ({
    name: item.name?.length > 16 ? item.name.substring(0, 16) + '…' : item.name,
    Revenue: item.total_revenue,
    Qty: item.total_qty,
  }));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Loader2 size={36} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  const potentialMargin = valuation && valuation.retailValue > 0
    ? ((valuation.potentialProfit / valuation.retailValue) * 100).toFixed(1)
    : '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'var(--primary-subtle)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={18} color="var(--primary)" />
            </div>
            <h1 className="page-title">Inventory Valuation</h1>
          </div>
          <p className="page-subtitle">Real-time gemstone inventory value and analytics</p>
        </div>
      </header>

      {/* KPI Cards */}
      {valuation && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}
          className="stagger-container">
          {[
            {
              label: 'Total Products', value: valuation.totalItems?.toString() || '0',
              icon: Package, color: 'var(--primary)', bg: 'var(--primary-subtle)', border: 'rgba(212,175,55,0.15)',
            },
            {
              label: 'Total Stock Units', value: valuation.totalStock?.toString() || '0',
              icon: Gem, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)',
            },
            {
              label: 'Cost Value (Asset)', value: formatCurrency(valuation.costValue || 0),
              icon: DollarSign, color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)',
            },
            {
              label: 'Retail Value', value: formatCurrency(valuation.retailValue || 0),
              icon: TrendingUp, color: 'var(--success)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)',
            },
            {
              label: 'Potential Profit', value: formatCurrency(valuation.potentialProfit || 0),
              icon: ArrowUpRight, color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)',
              sub: `${potentialMargin}% margin`,
            },
          ].map((kpi, i) => (
            <div key={i} className="card stagger-item" style={{
              padding: '1.25rem',
              border: `1px solid ${kpi.border}`,
              background: kpi.bg,
              transition: 'all var(--transition)',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                    {kpi.value}
                  </div>
                  {kpi.sub && (
                    <div style={{ fontSize: '0.75rem', color: kpi.color, fontWeight: 600, marginTop: '0.25rem' }}>
                      {kpi.sub}
                    </div>
                  )}
                </div>
                <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <kpi.icon size={18} color={kpi.color} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '1.5rem' }}>
        {/* Category Breakdown Pie */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <div style={{ width: 30, height: 30, background: 'var(--primary-subtle)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PieChart size={15} color="var(--primary)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Value by Category</h3>
          </div>
          {categoryBreakdown.length > 0 ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ChartContainer height={200}>
                  <RechartsPie>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RechartsPie>
                </ChartContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                {categoryBreakdown.slice(0, 6).map((cat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
              No category data
            </div>
          )}
        </div>

        {/* Top Selling Bar Chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <div style={{ width: 30, height: 30, background: 'rgba(59,130,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={15} color="var(--info)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Top Selling Revenue</h3>
          </div>
          {topSellingChart.length > 0 ? (
            <ChartContainer height={200}>
                <BarChart data={topSellingChart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
            </ChartContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
              No sales data
            </div>
          )}
        </div>
      </div>

      {/* Top Products Table */}
      {topSelling && topSelling.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: 28, height: 28, background: 'var(--primary-subtle)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gem size={14} color="var(--primary)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Top Performing Products</h3>
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Units Sold</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue</th>
                  <th style={{ textAlign: 'right' }}>Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {topSelling.slice(0, 10).map((item: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: i < 3 ? 'var(--primary-subtle)' : 'var(--surface-2)',
                        border: `1px solid ${i < 3 ? 'rgba(212,175,55,0.2)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6875rem', fontWeight: 800,
                        color: i < 3 ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}>
                        {i + 1}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.total_qty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      {formatCurrency(item.total_revenue)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted-foreground)' }}>
                      {item.total_qty > 0 ? formatCurrency(item.total_revenue / item.total_qty) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
