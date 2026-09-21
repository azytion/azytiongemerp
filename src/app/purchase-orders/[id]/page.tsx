import { getPurchaseOrder } from '@/app/actions/purchase-orders';
import { getSettings } from '@/app/actions/settings';
import { ChevronLeft, Truck, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatCurrencyServer, formatDateServer } from '@/lib/server-utils';
import { notFound } from 'next/navigation';
import PrintButton from './PrintButton';
import ReceiveOrderButton from './ReceiveOrderButton';

export default async function PurchaseOrderViewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const order = await getPurchaseOrder(Number(id));
    const settings = await getSettings();

    if (!order) {
        notFound();
    }

    // Company info from settings
    const companyInfo = {
        name: settings.company_name || 'Azytion',
        address: settings.company_address,
        phone: settings.company_phone,
        phone2: settings.company_phone_2,
        email: settings.company_email,
        website: settings.company_website,
        logo: (settings.receipt_show_logo === 'true' || settings.receipt_logo_enabled === 'true') && settings.company_logo ? settings.company_logo : undefined
    };

    const currencySymbol = settings.currency_symbol || 'LKR';

    // Format currency values
    const formattedTotalAmount = await formatCurrencyServer(order.total_amount);
    const formattedItems = await Promise.all(
        order.items.map(async (item: any) => ({
            ...item,
            formattedUnitCost: await formatCurrencyServer(item.expected_price || 0),
            formattedTotal: await formatCurrencyServer(item.quantity * (item.expected_price || 0))
        }))
    );
    const formattedDate = await formatDateServer(order.date_created);
    const formattedExpectedDate = order.expected_date ? await formatDateServer(order.expected_date) : 'N/A';

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <header className="no-print" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/inventory-management?tab=purchase-orders" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Purchase Order: {order.po_number}</h1>
                        <p style={{ color: 'var(--muted)' }}>Details and item list for this order</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <ReceiveOrderButton order={order} />
                    <PrintButton order={order} companyInfo={companyInfo} currencySymbol={currencySymbol} />
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                        <Truck size={24} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: '600' }}>Supplier Details</span>
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>{order.supplier_name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                        <div>{order.supplier_phone || 'No phone provided'}</div>
                        <div>{order.supplier_email || 'No email provided'}</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                        <Calendar size={24} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: '600' }}>Order Dates</span>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Created At:</div>
                        <div style={{ fontWeight: '500' }}>{formattedDate}</div>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Expected Date:</div>
                        <div style={{ fontWeight: '500' }}>{formattedExpectedDate}</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                        <FileText size={24} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: '600' }}>Status & Summary</span>
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            color: order.status === 'received' ? 'var(--success)' : (order.status === 'cancelled' ? 'var(--muted)' : 'var(--warning)'),
                            border: '1px solid currentColor'
                        }}>
                            {order.status}
                        </span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Value: {formattedTotalAmount}
                    </div>
                </div>
            </div>

            <div className="card table-wrapper">
                <h3 style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Line Items</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Barcode</th>
                            <th style={{ textAlign: 'center' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Unit Cost</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formattedItems.map((item: any) => (
                            <tr key={item.id}>
                                <td>{item.product_name}</td>
                                <td>{item.barcode || 'N/A'}</td>
                                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right' }}>{item.formattedUnitCost}</td>
                                <td style={{ textAlign: 'right', fontWeight: '500' }}>
                                    {item.formattedTotal}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', padding: '1rem' }}>Grand Total</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.125rem', padding: '1rem' }}>
                                {formattedTotalAmount}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {order.notes && (
                <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Internal Notes</h3>
                    <p style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{order.notes}</p>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    .card { border: 1px solid #eee !important; box-shadow: none !important; }
                    body { background: white !important; padding: 0 !important; }
                }
            ` }} />
        </div>
    );
}
