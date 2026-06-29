'use client';

import { ArrowUpRight, DollarSign, Package, ShoppingCart, Users, Activity, TrendingUp, Gem, BarChart3, Clock, Zap, AlertTriangle, TrendingDown } from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';
import { EmptyState } from '@/components/ui/EmptyState';
import DateTimeWidget from '@/components/DateTimeWidget';
import ChequeAlertsWidget from '@/components/ChequeAlertsWidget';
import EndOfMonthBackupAlert from '@/components/EndOfMonthBackupAlert';
import { useDashboardStats } from '@/hooks/useDashboard';
import { useQuery } from '@tanstack/react-query';
import { getSalesTrend } from '@/app/actions/reports';
import { getTopSellingItems, getRecentActivity } from '@/app/actions/analytics';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import Link from 'next/link';

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const { data: trend } = useQuery({
    queryKey: ['dashboard', 'trend'],
    queryFn: getSalesTrend,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30,
  });

  const { data: topSelling } = useQuery({
    queryKey: ['dashboard', 'topSelling'],
    queryFn: () => getTopSellingItems(5),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });

  const { data: activities } = useQuery({
    queryKey: ['dashboard', 'activities'],
    queryFn: () => getRecentActivity(5),
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 10,
  });

  if (statsLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton skeleton-title" style={{ width: 200 }} />
            <div className="skeleton skeleton-text" style={{ width: 280 }} />
          </div>
          <div className="skeleton" style={{ width: 180, height: 56, borderRadius: 'var(--radius-lg)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
        <Gem size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <p>No data available</p>
      </div>
    );
  }

  const hasLowStock = (stats.lowStock || 0) > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: 36, height: 36, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} color="var(--primary)" />
            </div>
            <h1 className="page-title">Dashboard</h1>
          </div>
          <p className="page-subtitle">Real-time overview of your gemstone business</p>
        </div>
        <DateTimeWidget />
      </header>

      <EndOfMonthBackupAlert />

      {/* Low Stock Alert Banner */}
      {hasLowStock && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1.25rem',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 'var(--radius-lg)',
          gap: '1rem', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--warning)' }}>
                {stats.lowStock} product{stats.lowStock !== 1 ? 's' : ''} running low on stock
              </div>
              {stats.lowStockItems && stats.lowStockItems.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                  {stats.lowStockItems.slice(0, 3).map((p: any) => p.name).join(', ')}
                  {stats.lowStockItems.length > 3 ? ` +${stats.lowStockItems.length - 3} more` : ''}
                </div>
              )}
            </div>
          </div>
          <Link href="/inventory-management" className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)', flexShrink: 0 }}>
            View Inventory
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        {[
          { href: '/pos', label: 'New Sale', icon: ShoppingCart, color: 'var(--primary)', bg: 'var(--primary-subtle)', border: 'rgba(212,175,55,0.25)' },
          { href: '/inventory-management?tab=products', label: 'Add Product', icon: Package, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
          { href: '/customers/new', label: 'Add Customer', icon: Users, color: 'var(--success)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
          { href: '/reports', label: 'Reports', icon: BarChart3, color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
        ].map((action) => (
          <Link key={action.href} href={action.href} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: action.bg, border: `1px solid ${action.border}`,
            borderRadius: 'var(--radius-full)',
            color: action.color, fontSize: '0.8125rem', fontWeight: 700,
            textDecoration: 'none', transition: 'all var(--transition-fast)',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
          >
            <action.icon size={14} />
            {action.label}
          </Link>
        ))}
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }} className="stagger-container">
        <div className="stagger-item">
          <StatCard title="Today's Revenue" value={formatCurrency(stats.todaySales || 0)} subtitle={`All time: ${formatCurrency(stats.totalSales || 0)}`} icon={DollarSign} trend="Today" trendUp={true} variant="blue" />
        </div>
        <div className="stagger-item">
          <StatCard title="Orders Today" value={(stats.todayOrders || 0).toString()} subtitle={`Total: ${stats.orderCount || 0} orders`} icon={ShoppingCart} trend="Today" trendUp={true} variant="green" />
        </div>
        <div className="stagger-item">
          <StatCard
            title="Total Profit"
            value={formatCurrency(Math.abs(stats.totalProfit || 0))}
            subtitle={`${Math.abs(stats.profitMargin || 0).toFixed(1)}% margin`}
            icon={(stats.totalProfit || 0) >= 0 ? TrendingUp : TrendingDown}
            trend={(stats.totalProfit || 0) >= 0 ? 'Profit' : 'Loss'}
            trendUp={(stats.totalProfit || 0) >= 0}
            variant="purple"
          />
        </div>
        <div className="stagger-item">
          <StatCard
            title="Products"
            value={(stats.productCount || 0).toString()}
            subtitle={hasLowStock ? `${stats.lowStock} low stock` : 'All stocked'}
            icon={Gem}
            trend={hasLowStock ? 'Alert' : 'Good'}
            trendUp={!hasLowStock}
            variant={hasLowStock ? 'orange' : 'gold'}
          />
        </div>
        {(stats.pendingCheques || 0) > 0 && (
          <div className="stagger-item">
            <StatCard
              title="Pending Cheques"
              value={(stats.pendingCheques || 0).toString()}
              subtitle={(stats.todayDueCheques || 0) > 0 ? `${stats.todayDueCheques} due today` : 'No cheques due today'}
              icon={Activity}
              trend={(stats.todayDueCheques || 0) > 0 ? 'Due Today' : 'Pending'}
              trendUp={false}
              variant="rose"
            />
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', 
        gap: '1.5rem', 
        alignItems: 'start' 
      }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          <DashboardCharts data={trend || []} />

          {/* Recent Sales */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 32, height: 32, background: 'rgba(59,130,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={16} color="var(--info)" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent Sales</h3>
              </div>
              <Link href="/sales" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8125rem' }}>
                View All <ArrowUpRight size={13} />
              </Link>
            </div>
            {stats.recentSales && stats.recentSales.length > 0 ? (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSales.map((sale: any) => (
                      <tr key={sale.id}>
                        <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.8125rem' }}>{sale.invoice_number}</td>
                        <td style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>{formatDate(sale.date)}</td>
                        <td style={{ fontSize: '0.8125rem' }}>{sale.customer_name || <span style={{ color: 'var(--muted)' }}>Walk-in</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>{formatCurrency(sale.total_amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge badge-${sale.payment_status === 'paid' || sale.payment_status === 'completed' ? 'success' : sale.payment_status === 'partial' ? 'warning' : 'error'}`}>
                            {sale.payment_status || 'paid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ShoppingCart} title="No Recent Sales" description="Sales will appear here once transactions are made." />
            )}
          </div>

          {/* Low Stock Items */}
          {hasLowStock && stats.lowStockItems && stats.lowStockItems.length > 0 && (
            <div className="card" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 32, height: 32, background: 'rgba(245,158,11,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={16} color="var(--warning)" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Low Stock Alert</h3>
                </div>
                <Link href="/inventory-management" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8125rem', color: 'var(--warning)' }}>
                  Manage <ArrowUpRight size={13} />
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stats.lowStockItems.map((item: any) => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    background: 'rgba(245,158,11,0.05)',
                    border: '1px solid rgba(245,158,11,0.15)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.stock === 0 ? 'var(--destructive)' : 'var(--warning)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        {item.barcode && <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{item.barcode}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.875rem', color: item.stock === 0 ? 'var(--destructive)' : 'var(--warning)' }}>
                        {item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
                      </div>
                      {item.reorder_level > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>Reorder at {item.reorder_level}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ChequeAlertsWidget />

          {/* Top Selling */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 32, height: 32, background: 'rgba(212,175,55,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} color="var(--primary)" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Top Selling</h3>
            </div>
            {topSelling && topSelling.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topSelling.map((item: any, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.625rem',
                    background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                    transition: 'all var(--transition-fast)',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.2)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <div style={{ width: 22, height: 22, background: 'var(--primary-subtle)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.625rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {idx + 1}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{item.name}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{item.total_qty} sold</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--success)', flexShrink: 0 }}>{formatCurrency(item.total_revenue)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title="No Sales Yet" description="Top products will appear here." />
            )}
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} color="var(--accent-purple)" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Activity</h3>
            </div>
            {activities && activities.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {activities.map((activity: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.625rem', padding: '0.5rem 0', borderBottom: idx < activities.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 26, height: 26, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Activity size={12} color="var(--primary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.1rem' }}>{activity.action}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.description}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--muted)', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={9} /> {formatDate(activity.timestamp, { showTime: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Activity} title="No Activity" description="Recent activities will appear here." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
