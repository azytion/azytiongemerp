'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, BarChart3 } from 'lucide-react';
import DateRangePresets from './DateRangePresets';

interface Tab {
  id: string;
  label: string;
  subTabs?: Tab[];
}

interface DateRange {
  start: string;
  end: string;
}

interface ReportLayoutProps {
  tabs: Tab[];
  children: (activeTab: string, activeSubTab: string | null, dateRange: DateRange | undefined, search: string) => React.ReactNode;
}

export default function ReportLayout({ tabs, children }: ReportLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const subParam = searchParams.get('sub');
  const activeTab = tabParam || tabs[0]?.id || '';
  const currentTabDef = tabs.find(t => t.id === activeTab);
  const activeSubTab = subParam ?? currentTabDef?.subTabs?.[0]?.id ?? null;
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterType, setFilterType] = useState<'all' | 'custom'>('all');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const past = new Date(); past.setDate(past.getDate() - 30);
    const fmt = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    return { start: fmt(past), end: fmt(now) };
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', activeTab);
      if (activeSubTab) params.set('sub', activeSubTab); else params.delete('sub');
      if (search) params.set('q', search); else params.delete('q');
      router.push(`/reports?${params.toString()}`, { scroll: false });
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const updateUrl = (tabId: string, subTabId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    if (subTabId) params.set('sub', subTabId); else params.delete('sub');
    if (search) params.set('q', search); else params.delete('q');
    router.push(`/reports?${params.toString()}`, { scroll: false });
  };

  const handleTabChange = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    const subTabId = tab?.subTabs?.[0]?.id || null;
    updateUrl(tabId, subTabId);
  };

  const handleSubTabChange = (subTabId: string) => {
    updateUrl(activeTab, subTabId);
  };

  const currentTab = currentTabDef;
  const effectiveDateRange = filterType === 'all' ? undefined : dateRange;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BarChart3 size={18} color="var(--info)" />
            </div>
            <h1 className="page-title">Reports</h1>
          </div>
          <p className="page-subtitle">Comprehensive business analytics and insights</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>

          <DateRangePresets
            onSelect={(range) => {
              if (range) { setDateRange(range); setFilterType('custom'); }
              else setFilterType('all');
            }}
            onFilterTypeChange={setFilterType}
          />
        </div>
      </header>

      {/* Main Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          background: 'var(--surface-2)',
          scrollbarWidth: 'none',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '0.875rem 1.125rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.8375rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontFamily: 'var(--font-sans)',
                transition: 'all var(--transition-fast)',
                marginBottom: -1,
              }}
              onMouseEnter={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
              onMouseLeave={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'; }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub Tabs */}
        {currentTab?.subTabs && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexWrap: 'wrap',
          }}>
            {currentTab.subTabs.map(subTab => (
              <button
                key={subTab.id}
                onClick={() => handleSubTabChange(subTab.id)}
                style={{
                  padding: '0.375rem 0.875rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: activeSubTab === subTab.id ? 'var(--primary)' : 'transparent',
                  color: activeSubTab === subTab.id ? '#000' : 'var(--muted-foreground)',
                  borderColor: activeSubTab === subTab.id ? 'var(--primary)' : 'var(--border-strong)',
                }}
              >
                {subTab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {children(activeTab, activeSubTab, effectiveDateRange as DateRange, search)}
        </div>
      </div>
    </div>
  );
}

