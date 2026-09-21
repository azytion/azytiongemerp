'use client';

import { useState } from 'react';
import { Eye, RotateCcw, Download, Mail, ShoppingCart, Printer, FileSpreadsheet, X, FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { getSaleDetails } from '@/app/actions/sales';
import { processSalesReturn } from '@/app/actions/credit-notes';
import { getWhatsAppLink } from '@/app/actions/messaging';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Modal from './ui/Modal';

import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';
import { getSettings } from '@/app/actions/settings';
import { buildSalesInvoicePDFFromSaleRecord, downloadPDF } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import InputModal from './ui/InputModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { ExchangeRateSnapshot, formatExchangeFromSnapshot } from '@/lib/exchange-rates';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

function getSaleExchangeSnapshot(sale: any): ExchangeRateSnapshot | null {
    try {
        const details = typeof sale?.payment_details === 'string' ? JSON.parse(sale.payment_details) : sale?.payment_details;
        return details?.exchange_rate || null;
    } catch {
        return null;
    }
}

export default function SalesTable({
    salesResult,
    page,
    onPageChange
}: {
    salesResult: PaginatedResult<any>,
    page: number,
    onPageChange: (page: number) => void
}) {
    const sales = salesResult.data;
    const [viewingSale, setViewingSale] = useState<any | null>(null);
    const [refundQtys, setRefundQtys] = useState<{ [key: number]: number }>({});
    const [loading, setLoading] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [viewingSettings, setViewingSettings] = useState<any>(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState<{ open: boolean, type: 'whatsapp' }>({ open: false, type: 'whatsapp' });
    const [messagingLoading, setMessagingLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const _router = useRouter();
    const { confirm } = useConfirm();

    const allIds = sales.map((s: any) => s.id);
    const allSelected = allIds.length > 0 && allIds.every((id: number) => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    async function handleView(saleId: number) {
        setLoading(true);
        const [details, settings] = await Promise.all([
            getSaleDetails(saleId),
            getSettings()
        ]);
        setViewingSale(details);
        setViewingSettings(settings);
        setRefundQtys({}); // Reset
        setLoading(false);
    }

    function handleExportExcel() {
        const toExport = selectedIds.length > 0 ? sales.filter((s: any) => selectedIds.includes(s.id)) : sales;
        const rows = toExport.map((s: any) => ({
            Invoice: s.invoice_number,
            Date: formatDate(s.date, { showTime: true }),
            Customer: s.customer_id ? s.customer_name || 'Registered' : 'Walk-in',
            Broker: s.broker_name || 'None',
            Commission: formatCurrency(s.broker_commission || 0),
            Type: s.type,
            Payment: s.payment_method,
            Total: formatCurrency(s.total_amount),
            Profit: formatCurrency(s.profit || 0),
            Status: s.status,
        }));
        void downloadRowsAsXlsx(rows, 'Sales', `Sales_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    async function handleExportPDF() {
        const toExport = selectedIds.length > 0 ? sales.filter((s: any) => selectedIds.includes(s.id)) : sales;
        if (toExport.length === 0) return;
        try {
            const { generateSalesReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
            const settings = await getSettings();
            const sym = settings.currency_symbol || settings.currency_code || '$';

            const totalAmount = toExport.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
            const totalProfit = toExport.reduce((s: number, r: any) => s + (Number(r.profit) || 0), 0);
            const totalReturns = toExport.filter((r: any) => r.type === 'return').length;

            const doc = generateSalesReportPDF({
                generated_at: new Date().toISOString(),
                currency_symbol: sym,
                summary: {
                    total_sales: toExport.length,
                    total_amount: totalAmount,
                    total_profit: totalProfit,
                    total_returns: totalReturns,
                },
                rows: toExport.map((s: any) => ({
                    invoice_number: s.invoice_number,
                    date: s.date,
                    customer_name: s.customer_name || 'Walk-in',
                    payment_method: s.payment_method,
                    type: s.type || 'sale',
                    total_amount: Number(s.total_amount) || 0,
                    profit: Number(s.profit) || 0,
                    status: s.status,
                })),
            }, buildCompanyInfo(settings));

            downloadPDF(doc, `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) {
            console.error(e);
        }
    }

    function updateRefundQty(itemId: number, qty: number, max: number) {
        if (qty < 0) qty = 0;
        if (qty > max) qty = max;
        if (qty === 0) {
            const newItems = { ...refundQtys };
            delete newItems[itemId];
            setRefundQtys(newItems);
        } else {
            setRefundQtys({ ...refundQtys, [itemId]: qty });
        }
    }

    async function handleProcessRefund() {
        if (!viewingSale?.sale) return;
        if (Object.keys(refundQtys).length === 0) return;

        if (!await confirm({ title: 'Process Sales Return', message: 'Create a credit note and return selected items to stock?', type: 'warning' })) return;

        setLoading(true);
        try {
            const itemsToReturn = Object.entries(refundQtys)
                .filter(([, qty]) => qty > 0)
                .map(([itemId, qty]) => {
                    const item = viewingSale.items.find((i: any) => i.id === Number(itemId));
                    return {
                        product_id: item.product_id,
                        quantity: qty,
                        price: item.price,
                        discount: item.discount || 0,
                    };
                });

            if (itemsToReturn.length === 0) {
                toast.error('Please enter quantities to return');
                setLoading(false);
                return;
            }

            const res = await processSalesReturn(
                viewingSale.sale.id,
                itemsToReturn,
                'Customer Return'
            );

            if (res.success) {
                toast.success('Sales return processed — credit note created');
                setViewingSale(null);
                window.location.reload();
            } else {
                toast.error('Error: ' + res.error);
            }
        } catch (e: any) {
            toast.error('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    }
    async function handleEmailReceipt() {
        if (!viewingSale?.sale) return;

        const email = viewingSale.sale.customer_email;
        if (!email) {
            setIsEmailModalOpen(true);
            return;
        }

        executeEmailReceipt(email);
    }

    async function executeEmailReceipt(email: string) {
        if (!viewingSale?.sale || !email) return;

        setEmailSending(true);
        try {
            const settings = viewingSettings || await getSettings();
            const doc = buildSalesInvoicePDFFromSaleRecord(viewingSale.sale, viewingSale.items, settings);
            await sendPDFEmail(
                doc,
                email,
                `Invoice - ${viewingSale.sale.invoice_number}`,
                `Please find attached Invoice ${viewingSale.sale.invoice_number}.`,
                `Invoice-${viewingSale.sale.invoice_number}.pdf`,
                settings.company_name || 'Azytion GemERP'
            );
            toast.success('Invoice emailed successfully');
            setIsEmailModalOpen(false);
        } catch (error) {
            console.error('Email error:', error);
            toast.error('Failed to send invoice email');
        } finally {
            setEmailSending(false);
        }
    }

    async function handleWhatsAppReceipt() {
        if (!viewingSale?.sale) return;

        const phone = viewingSale.sale.customer_phone;
        if (!phone) {
            setIsPhoneModalOpen({ open: true, type: 'whatsapp' });
            return;
        }

        executeWhatsAppReceipt(phone);
    }

    async function executeWhatsAppReceipt(phone: string) {
        if (!viewingSale?.sale) return;
        setMessagingLoading(true);
        try {
            const res = await getWhatsAppLink(viewingSale.sale.id, phone);

            if (res.success && res.link) {
                window.open(res.link, '_blank');
                setIsPhoneModalOpen({ open: false, type: 'whatsapp' });
            } else {
                toast.error('Failed to generate WhatsApp link: ' + res.error);
            }

        } catch (e: any) {
            toast.error('Failed to generate WhatsApp link: ' + e.message);
        } finally {
            setMessagingLoading(false);
        }
    }



    async function handlePrintReceipt() {
        if (!viewingSale?.sale) return;

        const sale = viewingSale.sale;
        const items = viewingSale.items;
        const toastId = toast.loading('Preparing invoice...');

        try {
            const settings = viewingSettings || await getSettings();
            const doc = buildSalesInvoicePDFFromSaleRecord(sale, items, settings);
            toast.dismiss(toastId);
            // Open PDF in new tab for printing — more reliable than printPDF()
            const blobUrl = doc.output('bloburl');
            const win = window.open(blobUrl, '_blank');
            if (win) {
                win.addEventListener('load', () => {
                    try { win.print(); } catch { /* user can print manually */ }
                });
                toast.success('Invoice opened — use Ctrl+P to print');
            } else {
                // Fallback: download
                doc.save(`Invoice-${sale.invoice_number}.pdf`);
                toast.success('Invoice downloaded');
            }
        } catch (err: any) {
            toast.dismiss(toastId);
            console.error('Print Error:', err);
            toast.error('Failed to generate invoice: ' + (err?.message || 'Unknown error'));
        }
    }

    return (
        <>
            <div className="sales-table-shell">
                <div className="sales-table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                        {selectedIds.length > 0 ? (
                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{selectedIds.length} selected</span>
                        ) : (
                            <span>{salesResult.total} records</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {selectedIds.length > 0 && (
                            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
                                <X size={14} /> Clear
                            </button>
                        )}
                        <button onClick={handleExportPDF} className="btn btn-secondary btn-sm" style={{ gap: '0.375rem' }} title="Export selected sales as PDF">
                            <FileText size={14} /> PDF{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                        </button>
                        <button onClick={handleExportExcel} className="btn btn-secondary btn-sm" style={{ gap: '0.375rem' }}>
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                    </div>
                </div>

                <div className="table-wrapper sales-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                            </th>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th className="st-col-broker">Broker</th>
                            <th style={{ textAlign: 'center' }}>Method</th>
                            <th className="st-col-type" style={{ textAlign: 'center' }}>Type</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th className="st-col-profit" style={{ textAlign: 'right' }}>Profit</th>
                            <th className="st-col-margin" style={{ textAlign: 'right' }}>Margin</th>
                            <th className="st-col-status" style={{ textAlign: 'center' }}>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.length === 0 ? (
                            <tr>
                                <td colSpan={12} style={{ padding: 0 }}>
                                    <EmptyState
                                        icon={ShoppingCart}
                                        title="No Sales Found"
                                        description="Processed sales will appear here."
                                    />
                                </td>
                            </tr>
                        ) : (
                            sales.map((sale: any) => {
                                const profit = sale.profit || 0;
                                const margin = sale.total_amount > 0 ? (profit / sale.total_amount) * 100 : 0;
                                let marginColor = 'var(--foreground)';
                                if (margin >= 30) marginColor = 'var(--success)';
                                else if (margin >= 15) marginColor = '#f59e0b';
                                else marginColor = 'var(--destructive)';

                                return (
                                    <tr key={sale.id} style={{ opacity: sale.status === 'void' ? 0.5 : 1, background: selectedIds.includes(sale.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                        <td style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedIds.includes(sale.id)} onChange={() => toggleSelect(sale.id)} style={{ cursor: 'pointer' }} />
                                        </td>
                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{sale.invoice_number}</div>
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{formatDate(sale.date, { showTime: true })}</td>
                                        <td>
                                            {sale.customer_id ? (
                                                <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{sale.customer_name || 'Registered'}</span>
                                            ) : (
                                                <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Walk-in</span>
                                            )}
                                        </td>
                                        <td className="st-col-broker">
                                            {sale.broker_name ? (
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.8125rem' }}>{sale.broker_name}</div>
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{formatCurrency(sale.broker_commission || 0)}</div>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>{sale.payment_method}</span>
                                        </td>
                                        <td className="st-col-type" style={{ textAlign: 'center' }}>
                                            <span className={`badge ${sale.type === 'return' ? 'badge-error' : 'badge-muted'}`} style={{ fontSize: '0.6875rem' }}>
                                                {sale.type || 'sale'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>
                                            {formatCurrency(sale.total_amount)}
                                        </td>
                                        <td className="st-col-profit" style={{ textAlign: 'right', color: profit > 0 ? 'var(--success)' : (profit < 0 ? 'var(--destructive)' : 'var(--muted)'), fontWeight: 600, fontSize: '0.875rem' }}>
                                            {formatCurrency(profit)}
                                        </td>
                                        <td className="st-col-margin" style={{ textAlign: 'right', fontWeight: 700, color: marginColor, fontSize: '0.875rem' }}>
                                            {margin.toFixed(1)}%
                                        </td>
                                        <td className="st-col-status" style={{ textAlign: 'center' }}>
                                            <span className={`badge ${sale.status === 'completed' || sale.status === 'paid' ? 'badge-success' : sale.status === 'partial' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: '0.6875rem' }}>
                                                {sale.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button onClick={() => handleView(sale.id)} className="btn btn-ghost" style={{ padding: '0.25rem' }}>
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                </div>

                <Pagination
                    currentPage={page}
                    totalPages={salesResult.totalPages}
                    onPageChange={onPageChange}
                    totalItems={salesResult.total}
                    pageSize={salesResult.pageSize}
                />
            </div>

            <Modal
                isOpen={!!viewingSale}
                onClose={() => setViewingSale(null)}
                title={`Sale Details: ${viewingSale?.sale?.invoice_number}`}
                maxWidth="980px"
            >
                {viewingSale && (
                    <div className="sales-details-modal">
                        {/* Info cards grid */}
                        <div className="sales-details-grid">
                            <div className="sales-detail-card">
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Date</div>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatDate(viewingSale.sale.date, { showTime: true })}</div>
                            </div>
                            <div className="sales-detail-card">
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Customer</div>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{viewingSale.sale.customer_name || (viewingSale.sale.customer_id ? 'Registered' : 'Walk-in')}</div>
                            </div>
                            <div className="sales-detail-card">
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Broker</div>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: viewingSale.sale.broker_name ? 'var(--primary)' : 'inherit' }}>
                                    {viewingSale.sale.broker_name || '—'}
                                    {viewingSale.sale.broker_commission > 0 && <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}> ({formatCurrency(viewingSale.sale.broker_commission)})</span>}
                                </div>
                            </div>
                            <div className="sales-detail-card">
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Status</div>
                                <span className={`badge badge-${viewingSale.sale.status === 'completed' || viewingSale.sale.status === 'paid' ? 'success' : viewingSale.sale.status === 'partial' ? 'warning' : 'error'}`} style={{ fontSize: '0.6875rem' }}>
                                    {viewingSale.sale.status}
                                </span>
                            </div>
                            <div className="sales-detail-card sales-detail-card--total">
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Total</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{formatCurrency(viewingSale.sale.total_amount)}</div>
                                {(() => {
                                    const snapshot = getSaleExchangeSnapshot(viewingSale.sale);
                                    const converted = formatExchangeFromSnapshot(Number(viewingSale.sale.total_amount), snapshot);
                                    return converted ? (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                                            {converted.formatted} {converted.code}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <div className="sales-detail-card">
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Payment</div>
                                <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>{viewingSale.sale.payment_method}</span>
                            </div>
                        </div>

                        {/* Receipt action buttons row */}
                        <div className="sales-details-actions">
                            <button onClick={handlePrintReceipt} className="btn btn-secondary btn-sm" title="Print Invoice">
                                <Printer size={14} /> Print
                            </button>
                            <button
                                onClick={async () => {
                                    if (!viewingSale?.sale) return;
                                    const settings = viewingSettings || await getSettings();
                                    const doc = buildSalesInvoicePDFFromSaleRecord(viewingSale.sale, viewingSale.items, settings);
                                    downloadPDF(doc, `Invoice-${viewingSale.sale.invoice_number}.pdf`);
                                }}
                                className="btn btn-secondary btn-sm" title="Download Invoice PDF"
                            >
                                <Download size={14} /> Download
                            </button>
                            <button
                                onClick={handleWhatsAppReceipt}
                                disabled={messagingLoading}
                                className="btn btn-sm"
                                title="Send via WhatsApp"
                                style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396 0 12.032c0 2.12.556 4.189 1.613 6.041L0 24l6.105-1.602a11.803 11.803 0 005.937 1.597h.005c6.632 0 12.028-5.397 12.031-12.034a11.85 11.85 0 00-3.529-8.498z" />
                                </svg>
                                WhatsApp
                            </button>
                            <button onClick={handleEmailReceipt} disabled={emailSending} className="btn btn-secondary btn-sm" title="Email Receipt">
                                <Mail size={14} /> {emailSending ? 'Sending...' : 'Email'}
                            </button>
                        </div>

                        {/* Return panel — shown only for non-return sales */}
                        {viewingSale.sale.type !== 'return' && (
                            <div className="sales-return-panel">
                                <div>
                                    <strong>Process Return</strong>
                                    <span>Enter return quantities in the table below, then click Process Return.</span>
                                </div>
                                <button
                                    onClick={handleProcessRefund}
                                    className="btn btn-destructive btn-sm"
                                    disabled={loading || Object.keys(refundQtys).filter(k => (refundQtys as any)[k] > 0).length === 0}
                                >
                                    {loading ? 'Processing...' : <><RotateCcw size={14} /> Process Return</>}
                                </button>
                            </div>
                        )}

                        <div className="table-wrapper sales-details-items">
                            <table style={{ width: '100%', fontSize: '0.875rem' }}>
                                <colgroup>
                                    <col />
                                    <col style={{ width: '5.5rem' }} />
                                    <col style={{ width: '7.5rem' }} />
                                    <col style={{ width: '4.5rem' }} />
                                    <col style={{ width: '7rem' }} />
                                    <col style={{ width: '7.5rem' }} />
                                    {viewingSale.sale.type !== 'return' && <col style={{ width: '6.75rem' }} />}
                                </colgroup>
                                <thead style={{ background: 'var(--secondary)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem' }}>Product / Gem Details</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem' }}>Ct</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem' }}>Price</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem' }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem' }}>Disc</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem' }}>Total</th>
                                        {viewingSale.sale.type !== 'return' && <th style={{ textAlign: 'center', padding: '0.75rem' }}>Return Qty</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingSale.items.map((item: any, idx: number) => {
                                        const gemParts: string[] = [];
                                        if (item.shape) gemParts.push(item.shape);
                                        if (item.color) gemParts.push(item.color);
                                        if (item.clarity) gemParts.push(item.clarity);
                                        if (item.origin) gemParts.push(`Origin: ${item.origin}`);
                                        if (item.treatment && item.treatment !== 'None') gemParts.push(`Treatment: ${item.treatment}`);
                                        if (item.certificate_number) gemParts.push(`Cert: ${item.certificate_number}`);
                                        return (
                                        <tr key={`${item.id}-${idx}`}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                                                {gemParts.length > 0 && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                                                        {gemParts.join(' / ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>
                                                {item.carat_weight ? `${Number(item.carat_weight).toFixed(2)}ct` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>{formatCurrency(item.price)}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{item.quantity}</td>
                                            <td style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--destructive)' }}>
                                                {item.discount > 0 ? formatCurrency(item.discount) : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 600 }}>{formatCurrency((item.price - (item.discount || 0)) * item.quantity)}</td>
                                            {viewingSale.sale.type !== 'return' && (
                                                <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                                                    <div className="sales-return-cell">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.quantity}
                                                            value={refundQtys[item.id] || 0}
                                                            onChange={(e) => updateRefundQty(item.id, parseInt(e.target.value), item.quantity)}
                                                            className="input"
                                                        />
                                                        <span>/ {item.quantity}</span>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="modal-action-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                            <button onClick={() => setViewingSale(null)} className="btn btn-outline">Close</button>
                        </div>
                    </div>
                )}
            </Modal>

            <InputModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                onConfirm={executeEmailReceipt}
                title="Email Receipt"
                description="Enter customer email address to send the receipt."
                placeholder="customer@example.com"
                inputType="email"
                confirmLabel="Send Email"
                defaultValue={viewingSale?.sale?.customer_email || ''}
            />

            <InputModal
                isOpen={isPhoneModalOpen.open}
                onClose={() => setIsPhoneModalOpen({ ...isPhoneModalOpen, open: false })}
                onConfirm={executeWhatsAppReceipt}
                title="Send WhatsApp Receipt"
                description="Enter customer phone number (with country code, e.g., 923001234567)."
                placeholder="923001234567"
                inputType="text"
                confirmLabel="Open WhatsApp"
                defaultValue={viewingSale?.sale?.customer_phone || ''}
            />
        </>
    );
}
