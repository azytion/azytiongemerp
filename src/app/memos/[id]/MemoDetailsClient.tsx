'use client';

import { useState } from 'react';
import { Memo, returnMemoItems } from '@/app/actions/memos';
import { ArrowLeft, Printer, RefreshCcw, HandCoins, Download, Info, User, Calendar } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { generateConsignmentMemoPDF, downloadPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { getSettings } from '@/app/actions/settings';
import { formatCurrency } from '@/lib/utils';
import { useConfirm } from '@/components/ConfirmDialog';

export default function MemoDetailsClient({ memo }: { memo: Memo & { customer_email: string, customer_phone: string } }) {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [returning, setReturning] = useState(false);
  const [partialReturnData, setPartialReturnData] = useState<Record<number, { quantity?: number, weight?: number }>>({});
  const [showPartialInputs, setShowPartialInputs] = useState(false);
  const { confirm } = useConfirm();

  const handleSelect = (itemId: number) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleReturn = async () => {
    if (selectedItems.length === 0) return;
    const confirmMsg = showPartialInputs
      ? 'Process partial returns for selected items?'
      : `Return ${selectedItems.length} item(s) fully to stock?`;
    if (!await confirm({ title: 'Return Memo Items', message: confirmMsg, type: 'warning' })) return;

    setReturning(true);
    const itemsToReturn = selectedItems.map(id => {
      const item = memo.items?.find(i => i.id === id);
      const partial = partialReturnData[id];
      return {
        itemId: id,
        quantity: showPartialInputs ? (partial?.quantity ?? 0) : (item?.quantity || 0),
        carat_weight: showPartialInputs ? (partial?.weight ?? 0) : (item?.carat_weight || 0),
      };
    });

    if (showPartialInputs) {
      const invalid = itemsToReturn.find(i => (i.quantity || 0) <= 0 && (i.carat_weight || 0) <= 0);
      if (invalid) {
        toast.error('Please enter a valid amount to return for all selected items.');
        setReturning(false);
        return;
      }
    }

    const res = await returnMemoItems(memo.id, itemsToReturn);
    setReturning(false);
    if (res.success) {
      toast.success('Return processed successfully');
      setSelectedItems([]);
      setPartialReturnData({});
      setShowPartialInputs(false);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to process return');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const settings = await getSettings();
      const companyInfo = buildCompanyInfo(settings);
      const doc = generateConsignmentMemoPDF(memo, companyInfo);
      downloadPDF(doc, `Memo_${memo.memo_number}.pdf`);
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrintPDF = async () => {
    try {
      const settings = await getSettings();
      const companyInfo = buildCompanyInfo(settings);
      const doc = generateConsignmentMemoPDF(memo, companyInfo);
      // Open PDF in new tab with print dialog
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl as unknown as string, '_blank');
      if (win) win.onload = () => win.print();
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const totalValue = memo.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
  const statusColor = getStatusColor(memo.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">

      {/* Header */}
      <header className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
          <Link href="/memos" className="btn btn-secondary btn-sm" style={{ padding: '0.5rem', flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Memo #{memo.memo_number}
              </h1>
              <span className={`badge badge-${statusColor}`} style={{ fontSize: '0.75rem' }}>
                {memo.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              {new Date(memo.date_out).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleDownloadPDF} className="btn btn-secondary btn-sm">
            <Download size={14} /> PDF
          </button>
          <button onClick={handlePrintPDF} className="btn btn-secondary btn-sm">
            <Printer size={14} /> Print
          </button>

          {memo.status !== 'returned' && memo.status !== 'sold' && (
            <>
              <button
                onClick={() => setShowPartialInputs(!showPartialInputs)}
                className={`btn btn-sm ${showPartialInputs ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Info size={14} />
                {showPartialInputs ? 'Full Return Mode' : 'Partial Return Mode'}
              </button>
              <button
                onClick={handleReturn}
                disabled={selectedItems.length === 0 || returning}
                className="btn btn-sm"
                style={{
                  background: selectedItems.length > 0 ? 'rgba(245,158,11,0.1)' : 'var(--surface-2)',
                  border: `1px solid ${selectedItems.length > 0 ? 'rgba(245,158,11,0.4)' : 'var(--border-strong)'}`,
                  color: selectedItems.length > 0 ? 'var(--warning)' : 'var(--muted-foreground)',
                }}
              >
                <RefreshCcw size={14} />
                {returning ? 'Processing...' : `Return (${selectedItems.length})`}
              </button>
              <button
                onClick={() => {
                  if (selectedItems.length === 0) return;
                  router.push(`/pos?memoId=${memo.id}&items=${selectedItems.join(',')}`);
                }}
                disabled={selectedItems.length === 0}
                className="btn btn-primary btn-sm"
              >
                <HandCoins size={14} /> Sell ({selectedItems.length})
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Grid — responsive */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)',
        gap: '1.5rem',
        alignItems: 'start',
      }}
        className="memo-grid"
      >
        {/* Left: Items Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Consignment Items</h3>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                {memo.items?.length || 0} item(s)
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th className="no-print" style={{ width: 40 }}></th>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Cts</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memo.items?.map((item) => (
                    <tr key={item.id} style={{ opacity: item.status === 'returned' ? 0.55 : 1 }}>
                      <td className="no-print" style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                        {item.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleSelect(item.id)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.product_name}</div>
                        {item.sku && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                            {item.sku}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600 }}>{item.quantity}</div>
                        {item.returned_qty > 0 && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--success)' }}>Ret: {item.returned_qty}</div>
                        )}
                        {showPartialInputs && selectedItems.includes(item.id) && (
                          <input
                            type="number"
                            style={{ width: 56, padding: '0.2rem 0.375rem', marginTop: '0.375rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--input)', color: 'var(--foreground)', textAlign: 'center' }}
                            placeholder="Qty"
                            value={partialReturnData[item.id]?.quantity || ''}
                            onChange={e => setPartialReturnData({ ...partialReturnData, [item.id]: { ...partialReturnData[item.id], quantity: Number(e.target.value) } })}
                          />
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{item.carat_weight?.toFixed(2) || '—'}</div>
                        {item.returned_weight > 0 && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--success)' }}>Ret: {item.returned_weight.toFixed(2)}</div>
                        )}
                        {showPartialInputs && selectedItems.includes(item.id) && item.carat_weight > 0 && (
                          <input
                            type="number"
                            step="0.01"
                            style={{ width: 72, padding: '0.2rem 0.375rem', marginTop: '0.375rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--input)', color: 'var(--foreground)', textAlign: 'right' }}
                            placeholder="Cts"
                            value={partialReturnData[item.id]?.weight || ''}
                            onChange={e => setPartialReturnData({ ...partialReturnData, [item.id]: { ...partialReturnData[item.id], weight: Number(e.target.value) } })}
                          />
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.8125rem' }}>
                        {item.price_per_carat ? `${formatCurrency(item.price_per_carat)}/ct` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(item.total_price)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge badge-${getStatusColor(item.status)}`} style={{ fontSize: '0.6875rem' }}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-strong)' }}>
                    <td colSpan={5} style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                      Total Value:
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
                      {formatCurrency(totalValue)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {memo.notes && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.625rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Notes / Terms
              </h3>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--foreground-2)' }}>
                {memo.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Customer */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ width: 28, height: 28, background: 'rgba(59,130,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} color="var(--info)" />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>Customer</h3>
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
              {memo.customer_name || <span style={{ color: 'var(--muted)' }}>Walk-in</span>}
            </div>
            {memo.customer_phone && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>
                📞 {memo.customer_phone}
              </div>
            )}
            {memo.customer_email && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                ✉️ {memo.customer_email}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ width: 28, height: 28, background: 'rgba(212,175,55,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={14} color="var(--primary)" />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>Timeline</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Date Out</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  {new Date(memo.date_out).toLocaleDateString()}
                </span>
              </div>
              {memo.date_due && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Due Date</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--warning)' }}>
                    {new Date(memo.date_due).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="gem-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
              Total Value
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.03em' }}>
              {formatCurrency(totalValue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              {memo.items?.length || 0} items · {memo.items?.filter(i => i.status === 'pending').length || 0} pending
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'warning';
    case 'partial': return 'info';
    case 'returned': return 'muted';
    case 'sold': return 'success';
    default: return 'muted';
  }
}
