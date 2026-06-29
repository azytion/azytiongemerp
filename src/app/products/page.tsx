'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deleteProduct, getProducts, getProductStats, Product } from '@/app/actions/products';
import { getCategories } from '@/app/actions/categories';
import {
  Search, Loader2, Eye, Package, DollarSign, Gem,
  AlertTriangle, Plus, Award, FileText, FileSpreadsheet, X, CheckSquare, Trash2
} from 'lucide-react';
import { ProductDetailsModal } from '@/components/ProductDetailsModal';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import Link from 'next/link';
import { localDB } from '@/lib/db/LocalDB';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StaleBanner from '@/components/StaleBanner';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

type SortOption = 'name' | 'price-asc' | 'price-desc' | 'stock';

async function getProductsWithCache(search: string, categoryFilter: number | null, page: number) {
    if (navigator.onLine) {
        try {
            const res = await getProducts(search, categoryFilter || undefined, page, 100);
            // Cache all products on first unfiltered load
            if (!search && !categoryFilter && page === 1) {
                const full = await getProducts('', undefined, 1, 2000);
                if (full?.data) { await localDB.products.clear(); await localDB.products.bulkPut(full.data as any); }
            }
            return { ...res, isStale: false };
        } catch { /* fall through */ }
    }
    // Offline fallback
    let all = await localDB.products.toArray();
    if (search) { const q = search.toLowerCase(); all = all.filter(p => p.name?.toLowerCase().includes(q) || p.barcode?.includes(q)); }
    if (categoryFilter) all = all.filter(p => p.category_id === categoryFilter);
    const pageSize = 100;
    const offset = (page - 1) * pageSize;
    return { data: all.slice(offset, offset + pageSize), total: all.length, page, pageSize, totalPages: Math.ceil(all.length / pageSize), isStale: true };
}

async function getCategoriesWithCache() {
    if (navigator.onLine) {
        try {
            const res = await getCategories('', 1, 100);
            if (res?.data) { await localDB.categories.clear(); await localDB.categories.bulkPut(res.data as any); }
            return res;
        } catch { /* fall through */ }
    }
    const cats = await localDB.categories.toArray();
    return { data: cats, total: cats.length, page: 1, pageSize: 100, totalPages: 1 };
}

export default function ProductsPage() {
  const isOnline = useOnlineStatus();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const { confirm } = useConfirm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search, page, categoryFilter, isOnline],
    queryFn: () => getProductsWithCache(search, categoryFilter, page),
    retry: 1,
  });

  const { data: statsData } = useQuery({
    queryKey: ['product-stats', search, categoryFilter],
    queryFn: () => getProductStats(search, categoryFilter || undefined),
    enabled: isOnline,
  });

  const { data: categoriesResult } = useQuery({
    queryKey: ['categories', isOnline],
    queryFn: getCategoriesWithCache,
  });

  const isStale = (data as any)?.isStale === true;
  const categories = categoriesResult?.data || [];

  const sortedProducts = useMemo(() => {
    if (!data?.data) return [];
    const products = [...data.data];
    switch (sortBy) {
      case 'name':       return products.sort((a, b) => a.name.localeCompare(b.name));
      case 'price-asc':  return products.sort((a, b) => a.selling_price - b.selling_price);
      case 'price-desc': return products.sort((a, b) => b.selling_price - a.selling_price);
      case 'stock':      return products.sort((a, b) => b.stock - a.stock);
      default:           return products;
    }
  }, [data?.data, sortBy]);

  const stats = statsData || { total: 0, totalValue: 0, inStock: 0, lowStock: 0 };
  const allPageIds = sortedProducts.map(p => p.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allPageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allPageIds])]);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  const handleViewProduct = async (product: Product) => {
    setSelectedProduct(null);
    setIsModalOpen(true);
    try {
      const { getProduct } = await import('@/app/actions/products');
      const full = await getProduct(product.id);
      if (full) setSelectedProduct(full);
    } catch (e) { console.error(e); }
  };

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      const { generateOfferLetterPDF, downloadPDF, buildCompanyInfo } = await import('@/lib/pdf-generator');
      const { getSettings } = await import('@/app/actions/settings');
      const settings = await getSettings();
      // Export selected products, or ALL if nothing selected
      let selected: typeof sortedProducts;
      if (someSelected) {
        selected = sortedProducts.filter(p => selectedIds.includes(p.id));
        const missingIds = selectedIds.filter(id => !selected.find(p => p.id === id));
        if (missingIds.length > 0) {
          const allRes = await getProducts(search, categoryFilter || undefined, 1, 9999);
          selected = [...selected, ...allRes.data.filter(p => missingIds.includes(p.id))];
        }
      } else {
        const allRes = await getProducts(search, categoryFilter || undefined, 1, 9999);
        selected = allRes.data;
      }
      const doc = generateOfferLetterPDF(selected, buildCompanyInfo(settings), settings.currency_symbol || settings.currency_code || '$');
      downloadPDF(doc, `Products_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { console.error(e); } finally { setExportingPDF(false); }
  }

  function handleExportExcel() {
    const toExport = someSelected
      ? sortedProducts.filter(p => selectedIds.includes(p.id))
      : sortedProducts;
    const rows = toExport.map(p => ({
      Barcode: p.barcode || '',
      Name: p.name,
      Category: p.category_name || p.category || '',
      'Cost Price': formatCurrency(p.cost_price),
      'Selling Price': formatCurrency(p.selling_price),
      Stock: p.stock,
      'Carat Weight': p.gem_details?.carat_weight || '',
      Shape: p.gem_details?.shape || '',
      Color: p.gem_details?.color || '',
      Clarity: p.gem_details?.clarity || '',
      Origin: p.gem_details?.origin || '',
    }));
    void downloadRowsAsXlsx(rows, 'Products', `Products_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  async function handleBulkDelete() {
    if (!someSelected) return;
    const ok = await confirm({
      title: 'Delete Selected Products',
      message: `Permanently delete ${selectedIds.length} selected product${selectedIds.length === 1 ? '' : 's'}?`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!ok) return;

    setDeletingSelected(true);
    const results = await Promise.all(selectedIds.map(id => deleteProduct(id)));
    const failed = results.filter((res: any) => res && res.success === false);
    setDeletingSelected(false);
    setSelectedIds([]);
    await refetch();
    if (failed.length) toast.error(`${failed.length} product${failed.length === 1 ? '' : 's'} could not be deleted`);
    else toast.success('Selected products deleted');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
      {isStale && <StaleBanner message="Viewing cached products" />}
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: 36, height: 36, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gem size={18} color="var(--primary)" />
            </div>
            <h1 className="page-title">Products Catalog</h1>
          </div>
          <p className="page-subtitle">Browse and manage your premium gemstone collection</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/certificates" className="btn btn-secondary btn-sm"><Award size={15} /> Certificates</Link>
          <Link href="/inventory-management?tab=products" className="btn btn-primary btn-sm"><Plus size={15} /> Add Product</Link>
        </div>
      </header>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }} className="stagger-container">
        {[
          { label: 'Total Items', value: stats.total.toString(), icon: Package, color: 'var(--primary)', bg: 'var(--primary-subtle)', border: 'rgba(212,175,55,0.15)' },
          { label: 'In Stock', value: stats.inStock.toString(), icon: Gem, color: 'var(--success)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
          { label: 'Total Value', value: formatCurrency(stats.totalValue), icon: DollarSign, color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)' },
          { label: 'Low Stock', value: stats.lowStock.toString(), icon: AlertTriangle, color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
        ].map((s, i) => (
          <div key={i} className="card stagger-item" style={{ padding: '1.25rem', border: `1px solid ${s.border}`, background: s.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{s.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
              <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Bulk Actions */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200, maxWidth: 340 }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name or barcode..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={categoryFilter || ''} onChange={e => { setCategoryFilter(e.target.value ? Number(e.target.value) : null); setPage(1); }} style={{ height: '2.5rem', minWidth: 140, borderRadius: 'var(--radius-full)', paddingRight: '2rem' }}>
          <option value="">All Categories</option>
          {categories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} style={{ height: '2.5rem', minWidth: 140, borderRadius: 'var(--radius-full)', paddingRight: '2rem' }}>
          <option value="name">Sort: Name A-Z</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="stock">Stock Level</option>
        </select>
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          {someSelected && (
            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
              <X size={14} /> Clear ({selectedIds.length})
            </button>
          )}
          {someSelected && (
            <button onClick={handleBulkDelete} disabled={deletingSelected} className="btn btn-destructive btn-sm">
              <Trash2 size={14} /> {deletingSelected ? 'Deleting...' : `Delete (${selectedIds.length})`}
            </button>
          )}
          <button onClick={handleExportPDF} disabled={exportingPDF} className="btn btn-secondary btn-sm" title={someSelected ? `Export ${selectedIds.length} selected as PDF` : 'Export all products as PDF'}>
            {exportingPDF ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            PDF{someSelected ? ` (${selectedIds.length})` : ''}
          </button>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm" title="Export to Excel">
            <FileSpreadsheet size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {someSelected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
          <CheckSquare size={15} color="var(--primary)" />
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''} selected</span>
          <button onClick={handleBulkDelete} disabled={deletingSelected} className="btn btn-destructive btn-sm" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
            <Trash2 size={13} /> {deletingSelected ? 'Deleting...' : 'Delete Selected'}
          </button>
          <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>Deselect All</button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        </div>
      ) : !sortedProducts.length ? (
        <EmptyState icon={Package} title="No Products Found" description={search ? 'Try adjusting your search terms' : 'Start by adding products in Inventory Management'} />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} title="Select all on this page" />
                </th>
                <th>Product</th>
                <th>Category</th>
                <th>Gem Details</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map(product => (
                <ProductRow
                  key={product.id}
                  product={product as any}
                  onView={handleViewProduct}
                  selected={selectedIds.includes(product.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={selectedProduct} />

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} totalItems={data.total} pageSize={100} />
      )}
    </div>
  );
}

function ProductRow({ product, onView, selected, onToggle }: { product: Product; onView: (p: Product) => void; selected: boolean; onToggle: (id: number) => void }) {
  const gem = product.gem_details;
  const isLowStock = product.stock > 0 && product.stock <= (product.reorder_level || 5);
  const gemColor = gem?.color && gem.color !== 'null' ? gem.color : null;
  const gemClarity = gem?.clarity && gem.clarity !== 'null' ? gem.clarity : null;
  const gemCarat = gem?.carat_weight && gem.carat_weight > 0 ? gem.carat_weight : null;

  return (
    <tr style={{ background: selected ? 'rgba(212,175,55,0.05)' : undefined }}>
      <td onClick={e => e.stopPropagation()} style={{ width: 40 }}>
        <input type="checkbox" checked={selected} onChange={() => onToggle(product.id)} style={{ cursor: 'pointer' }} />
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 44, height: 44,
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {product.image_url ? (
              <img
                src={product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`}
                alt={product.name}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(0)', transition: 'filter 0.3s' }}
                onLoad={e => { (e.currentTarget as HTMLImageElement).style.filter = 'blur(0)'; }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div style={{ display: product.image_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <Gem size={18} color="var(--primary)" style={{ opacity: 0.5 }} />
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)' }}>{product.name}</div>
            {product.barcode && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginTop: '0.125rem' }}>
                {product.barcode}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
          {product.category_name || product.category || '—'}
        </span>
      </td>
      <td>
        {gem ? (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {gemCarat && (
              <span className="gem-badge" style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem' }}>
                {gemCarat}ct
              </span>
            )}
            {gemColor && (
              <span style={{
                fontSize: '0.6875rem', padding: '0.125rem 0.5rem',
                background: 'rgba(59,130,246,0.1)', color: 'var(--info)',
                border: '1px solid rgba(59,130,246,0.2)', borderRadius: 99,
                fontWeight: 600,
              }}>
                {gemColor}
              </span>
            )}
            {gemClarity && (
              <span style={{
                fontSize: '0.6875rem', padding: '0.125rem 0.5rem',
                background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                border: '1px solid rgba(139,92,246,0.35)', borderRadius: 99,
                fontWeight: 700,
              }}>
                {gemClarity}
              </span>
            )}
            {!gemCarat && !gemColor && !gemClarity && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>—</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>—</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
          {formatCurrency(product.selling_price)}
        </div>
        {product.pricing_method === 'per_carat' && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>per carat</div>
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isLowStock ? 'var(--warning)' : 'var(--foreground)' }}>
          {product.stock}
          <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginLeft: 3 }}>
            {product.pricing_method === 'per_carat' ? 'ct' : 'pcs'}
          </span>
        </div>
      </td>
      <td style={{ textAlign: 'center' }}>
        {product.stock <= 0 ? (
          <span className="badge badge-error">Out of Stock</span>
        ) : isLowStock ? (
          <span className="badge badge-warning">Low Stock</span>
        ) : (
          <span className="badge badge-success">In Stock</span>
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        <button
          onClick={() => onView(product)}
          className="btn btn-secondary btn-sm"
          style={{ gap: '0.375rem' }}
        >
          <Eye size={13} />
          View
        </button>
      </td>
    </tr>
  );
}




