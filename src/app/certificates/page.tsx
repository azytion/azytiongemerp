'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCertifiedProducts } from '@/app/actions/products';
import { Search, Award, Gem, FileCheck, ExternalLink, Filter, RefreshCw, Eye, FileSpreadsheet, FileDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

type CertifiedGem = {
  id: number;
  name: string;
  barcode: string | null;
  selling_price: number;
  stock: number;
  category_name: string | null;
  pricing_method: string;
  gem_details: {
    id: number;
    carat_weight: number;
    dimensions: string | null;
    shape: string | null;
    color: string | null;
    clarity: string | null;
    cut_grade: string | null;
    origin: string | null;
    treatment: string | null;
    certificate_provider: string | null;
    certificate_number: string | null;
    certificate_url: string | null;
    lot_origin_weight: number | null;
  };
};

const _CERT_PROVIDERS = ['GIA', 'IGI', 'AGS', 'HRD', 'EGL', 'SSEF', 'Gübelin', 'AGL', 'Other'];

const providerColors: Record<string, { bg: string; text: string; border: string }> = {
  GIA:     { bg: 'rgba(26,86,219,0.1)',  text: '#1a56db', border: 'rgba(26,86,219,0.25)' },
  IGI:     { bg: 'rgba(14,159,110,0.1)', text: '#0e9f6e', border: 'rgba(14,159,110,0.25)' },
  AGS:     { bg: 'rgba(126,58,242,0.1)', text: '#7e3af2', border: 'rgba(126,58,242,0.25)' },
  HRD:     { bg: 'rgba(227,160,8,0.1)',  text: '#e3a008', border: 'rgba(227,160,8,0.25)' },
  EGL:     { bg: 'rgba(224,36,36,0.1)',  text: '#e02424', border: 'rgba(224,36,36,0.25)' },
  SSEF:    { bg: 'rgba(6,148,162,0.1)',  text: '#0694a2', border: 'rgba(6,148,162,0.25)' },
  Gübelin: { bg: 'rgba(144,97,249,0.1)', text: '#9061f9', border: 'rgba(144,97,249,0.25)' },
  AGL:     { bg: 'rgba(255,90,31,0.1)',  text: '#ff5a1f', border: 'rgba(255,90,31,0.25)' },
  Other:   { bg: 'rgba(107,114,128,0.1)',text: '#6b7280', border: 'rgba(107,114,128,0.25)' },
};

const getProviderStyle = (provider: string | null) =>
  providerColors[provider || ''] || providerColors.Other;

export default function CertificatesPage() {
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const PAGE_SIZE = 24;

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ['certified-products', search, page, providerFilter],
    queryFn: () => getCertifiedProducts(search, providerFilter, page, PAGE_SIZE),
    staleTime: 1000 * 30,
  });

  const certifiedGems = (result?.data || []) as CertifiedGem[];
  const totalFiltered = result?.total || 0;
  const totalPages = result?.totalPages || 1;
  const totalValue = result?.totalValue || 0;

  // All providers from current page — for filter dropdown we need all, fetch without filter
  const { data: allResult } = useQuery({
    queryKey: ['certified-products-all-providers'],
    queryFn: () => getCertifiedProducts('', '', 1, 9999),
    staleTime: 1000 * 60 * 5,
  });
  const allProviders = [...new Set((allResult?.data || []).map((g: any) => g.gem_details?.certificate_provider).filter(Boolean))];

  const stats = {
    total: allResult?.total || totalFiltered,
    providers: allProviders.length,
    totalValue,
    withUrl: certifiedGems.filter(g => g.gem_details.certificate_url).length,
  };

  async function handleExportPDF() {
    try {
      const { generateGenericReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
      const { getSettings } = await import('@/app/actions/settings');
      const settings = await getSettings();
      const sym = settings.currency_symbol || settings.currency_code || '$';
      // Fetch all certified products for export (not just current page)
      const allCerts = await getCertifiedProducts(search, providerFilter, 1, 9999);
      const rows = allCerts.data.map(g => {
        const gem = (g as any).gem_details;
        return [
          g.name,
          gem?.certificate_provider || '—',
          gem?.certificate_number || '—',
          gem?.carat_weight ? `${gem.carat_weight} ct` : '—',
          gem?.shape || '—',
          gem?.color || '—',
          gem?.clarity || '—',
          gem?.origin || '—',
          `${sym} ${Number(g.selling_price).toFixed(2)}`,
        ];
      });
      const doc = generateGenericReportPDF(
        'Certificate Tracker',
        [
          { label: 'Product' }, { label: 'Provider' }, { label: 'Certificate #' },
          { label: 'Carat', align: 'right' as const }, { label: 'Shape' }, { label: 'Color' },
          { label: 'Clarity' }, { label: 'Origin' }, { label: 'Price', align: 'right' as const },
        ],
        rows,
        buildCompanyInfo(settings),
        `${providerFilter ? `Provider: ${providerFilter} | ` : ''}Generated: ${new Date().toLocaleDateString()}`
      );
      downloadPDF(doc, `Certificates_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { console.error(e); }
  }

  async function handleExportExcel() {
    const { getSettings } = await import('@/app/actions/settings');
    const settings = await getSettings();
    const sym = settings.currency_symbol || settings.currency_code || '$';
    const allCerts = await getCertifiedProducts(search, providerFilter, 1, 9999);
    const rows = allCerts.data.map(g => {
      const gem = (g as any).gem_details;
      return {
        Product: g.name,
        Barcode: g.barcode || '',
        Provider: gem?.certificate_provider || '',
        'Certificate #': gem?.certificate_number || '',
        'Carat Weight': gem?.carat_weight || '',
        Shape: gem?.shape || '',
        Color: gem?.color || '',
        Clarity: gem?.clarity || '',
        Origin: gem?.origin || '',
        Treatment: gem?.treatment || '',
        Price: `${sym} ${Number(g.selling_price).toFixed(2)}`,
        'Cert URL': gem?.certificate_url || '',
      };
    });
    void downloadRowsAsXlsx(rows, 'Certificates', `Certificates_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: 36, height: 36, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} color="var(--primary)" />
            </div>
            <h1 className="page-title">Certificate Tracker</h1>
          </div>
          <p className="page-subtitle">Track gemstone certificates from GIA, IGI, AGS, HRD and other labs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm"><FileSpreadsheet size={14} /> Excel</button>
          <button onClick={handleExportPDF} className="btn btn-secondary btn-sm"><FileDown size={14} /> PDF</button>
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setViewMode(v => v === 'grid' ? 'table' : 'grid')} className="btn btn-secondary btn-sm">
            {viewMode === 'grid' ? <Eye size={14} /> : <Gem size={14} />}
            {viewMode === 'grid' ? 'Table View' : 'Card View'}
          </button>
        </div>
      </header>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}
        className="stagger-container">
        {[
          { label: 'Certified Gems', value: stats.total.toString(), icon: Gem, color: 'var(--primary)', bg: 'var(--primary-subtle)', border: 'rgba(212,175,55,0.15)' },
          { label: 'Lab Providers', value: stats.providers.toString(), icon: Award, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
          { label: 'Certified Value', value: formatCurrency(stats.totalValue), icon: FileCheck, color: 'var(--success)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
          { label: 'Digital Certs', value: stats.withUrl.toString(), icon: ExternalLink, color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)' },
        ].map((s, i) => (
          <div key={i} className="card stagger-item" style={{ padding: '1.125rem', border: `1px solid ${s.border}`, background: s.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>{s.label}</div>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
              <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={16} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name or certificate number..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--muted-foreground)" />
          <select value={providerFilter} onChange={e => { setProviderFilter(e.target.value); setPage(1); }}
            style={{ height: '2.5rem', minWidth: 140, borderRadius: 'var(--radius-full)', paddingRight: '2rem' }}>
            <option value="">All Providers</option>
            {allProviders.map(p => <option key={p} value={p!}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-xl)' }} />)}
        </div>
      ) : certifiedGems.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No Certified Gems Found"
          description={search || providerFilter
            ? 'No gems match your current filters.'
            : 'Add certificate details to gemstone products in their Gem Details section to track them here.'}
        />
      ) : viewMode === 'grid' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {certifiedGems.map(gem => <CertCard key={gem.id} gem={gem} />)}
          </div>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalFiltered} pageSize={PAGE_SIZE} />
          )}
        </>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Provider</th>
                  <th>Certificate #</th>
                  <th>Carat</th>
                  <th>Shape</th>
                  <th>Color</th>
                  <th>Clarity</th>
                  <th>Origin</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'center' }}>Cert Link</th>
                </tr>
              </thead>
              <tbody>
                {certifiedGems.map(gem => {
                  const cert = gem.gem_details;
                  const ps = getProviderStyle(cert.certificate_provider);
                  return (
                    <tr key={gem.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{gem.name}</div>
                        {gem.barcode && <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{gem.barcode}</div>}
                      </td>
                      <td>
                        {cert.certificate_provider ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.625rem', background: ps.bg, color: ps.text, border: `1px solid ${ps.border}`, borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>
                            {cert.certificate_provider}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{cert.certificate_number || '—'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{cert.carat_weight ? `${cert.carat_weight} ct` : '—'}</td>
                      <td>{cert.shape || '—'}</td>
                      <td>{cert.color || '—'}</td>
                      <td>{cert.clarity || '—'}</td>
                      <td>{cert.origin || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(gem.selling_price)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {cert.certificate_url ? (
                          <a href={cert.certificate_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                            <ExternalLink size={13} />
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalFiltered} pageSize={PAGE_SIZE} />
          )}
        </>
      )}
    </div>
  );
}

function CertCard({ gem }: { gem: CertifiedGem }) {
  const cert = gem.gem_details;
  const ps = getProviderStyle(cert.certificate_provider);

  const specs = [
    { label: 'Carat', value: cert.carat_weight ? `${cert.carat_weight} ct` : null },
    { label: 'Shape', value: cert.shape },
    { label: 'Color', value: cert.color },
    { label: 'Clarity', value: cert.clarity },
    { label: 'Cut', value: cert.cut_grade },
    { label: 'Origin', value: cert.origin },
    { label: 'Treatment', value: cert.treatment },
    { label: 'Dimensions', value: cert.dimensions },
  ].filter(s => s.value);

  return (
    <div className="gem-card" style={{ transition: 'all var(--transition)', cursor: 'default' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-gold)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
    >
      {/* Provider + Link */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', background: ps.bg, border: `1px solid ${ps.border}`, borderRadius: 99, color: ps.text, fontSize: '0.75rem', fontWeight: 700 }}>
          <Award size={11} />
          {cert.certificate_provider || 'No Provider'}
        </span>
        {cert.certificate_url && (
          <a href={cert.certificate_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
            <ExternalLink size={13} /> View
          </a>
        )}
      </div>

      {/* Name */}
      <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 700 }}>{gem.name}</h4>
      {gem.barcode && <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginBottom: '0.75rem' }}>#{gem.barcode}</div>}

      {/* Certificate Number */}
      {cert.certificate_number && (
        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', letterSpacing: '0.04em', color: 'var(--foreground)' }}>
          {cert.certificate_number}
        </div>
      )}

      {/* Specs Grid */}
      {specs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', marginBottom: '0.875rem' }}>
          {specs.map((s, i) => (
            <div key={i} style={{ padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.5625rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.1rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
          {gem.category_name || 'Gemstone'} · {gem.stock} {gem.pricing_method === 'per_carat' ? 'ct' : 'pcs'}
        </div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
          {formatCurrency(gem.selling_price)}
        </div>
      </div>
    </div>
  );
}

