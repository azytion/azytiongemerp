'use client';

/* eslint-disable @next/next/no-img-element */

interface ReceiptPreviewProps {
    settings: Record<string, string>;
}

export default function ReceiptPreview({ settings }: ReceiptPreviewProps) {
    const companyName = settings.company_name || 'Your Company';
    const companyAddress = settings.company_address || '123 Main Street, City';
    const companyPhone = settings.company_phone || '+1 (555) 000-0000';
    const companyEmail = settings.company_email || '';
    const companyWebsite = settings.company_website || '';
    const receiptFooter = settings.receipt_footer || 'Thank you for your business!';
    const logo = settings.company_logo || '';
    const sym = settings.currency_symbol || 'Rs';

    const mockItems = [
        { name: 'Blue Sapphire', detail: '2.05ct | Cushion | Blue | VVS1 | Origin: Sri Lanka', qty: 1, price: 7500.00, discount: 0 },
        { name: 'Ruby Oval Cut', detail: '1.20ct | Oval | Red | VS1', qty: 1, price: 4200.00, discount: 200 },
    ];
    const subtotal = mockItems.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = mockItems.reduce((s, i) => s + i.discount, 0);
    const total = subtotal - discount;
    const paid = total + 100;
    const change = 100;

    // A4 scale: 210mm wide, scaled down to ~360px for preview
    const _scale = 360 / 210;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Invoice Preview (A4)</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0 }}>
                Live preview of the PDF invoice generated for each sale
            </p>

            {/* A4 preview container */}
            <div style={{
                width: 360,
                background: '#fff',
                color: '#111',
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                fontSize: 10,
                border: '1px solid #ddd',
                borderRadius: 6,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                overflow: 'hidden',
            }}>
                {/* Navy header band */}
                <div style={{ background: '#0B132B', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {logo && (
                            <img src={logo} alt="logo" style={{ height: 22, width: 22, objectFit: 'contain', borderRadius: 3 }} />
                        )}
                        <div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em' }}>{companyName.toUpperCase()}</div>
                            {companyAddress && <div style={{ color: 'rgba(200,210,230,0.8)', fontSize: 8, marginTop: 1 }}>{companyAddress}</div>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {companyPhone && <div style={{ color: 'rgba(200,210,230,0.8)', fontSize: 8 }}>Tel: {companyPhone}</div>}
                        {companyEmail && <div style={{ color: 'rgba(200,210,230,0.8)', fontSize: 8 }}>{companyEmail}</div>}
                        {companyWebsite && <div style={{ color: 'rgba(200,210,230,0.8)', fontSize: 8 }}>{companyWebsite}</div>}
                    </div>
                </div>
                {/* Gold accent line */}
                <div style={{ height: 2, background: 'linear-gradient(90deg, #D4AF37, #F0D060, #D4AF37)' }} />

                {/* Title + status */}
                <div style={{ padding: '10px 14px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#0B132B', letterSpacing: '-0.02em' }}>SALES INVOICE</div>
                        <div style={{ fontSize: 8, color: '#64748B', marginTop: 1 }}>Invoice #INV-PREVIEW-001</div>
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 99, padding: '2px 8px', fontSize: 7.5, fontWeight: 700, color: '#16a34a' }}>
                        PAID
                    </div>
                </div>

                {/* Info block */}
                <div style={{ margin: '0 14px 8px', background: '#f8f9fc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '7px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 8.5 }}>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Invoice #: </span>INV-PREVIEW-001</div>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Customer: </span>Walk-in Customer</div>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Date: </span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Phone: </span>—</div>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Payment: </span>Cash</div>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Status: </span>PAID</div>
                    <div><span style={{ color: '#64748B', fontWeight: 600 }}>Salesman: </span>admin</div>
                </div>

                {/* Items table */}
                <div style={{ margin: '0 14px 8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
                        <thead>
                            <tr style={{ background: '#0B132B', color: '#fff' }}>
                                <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600 }}>#</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600 }}>Product / Gem Details</th>
                                <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Qty</th>
                                <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Price</th>
                                <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mockItems.map((item, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '4px 6px', color: '#64748B' }}>{i + 1}</td>
                                    <td style={{ padding: '4px 6px' }}>
                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ color: '#64748B', fontSize: 7.5 }}>{item.detail}</div>
                                    </td>
                                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{item.qty}</td>
                                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{sym} {item.price.toFixed(2)}</td>
                                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{sym} {(item.price * item.qty - item.discount).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div style={{ margin: '0 14px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#f8f9fc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '6px 10px', minWidth: 140, fontSize: 8.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ color: '#64748B' }}>Subtotal</span>
                            <span>{sym} {subtotal.toFixed(2)}</span>
                        </div>
                        {discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, color: '#dc2626' }}>
                                <span>Discount</span>
                                <span>- {sym} {discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0B132B', color: '#fff', padding: '3px 6px', borderRadius: 3, fontWeight: 700, fontSize: 9, margin: '4px -4px' }}>
                            <span>TOTAL</span>
                            <span>{sym} {total.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, color: '#16a34a', fontWeight: 600 }}>
                            <span>Paid</span>
                            <span>{sym} {paid.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                            <span>Change</span>
                            <span>{sym} {change.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Summary line */}
                <div style={{ padding: '0 14px 6px', fontSize: 7.5, color: '#94A3B8' }}>
                    2 line item(s) · 2 unit(s) · 3.25 ct total
                </div>

                {/* Footer */}
                {receiptFooter && (
                    <div style={{ borderTop: '1px solid #e2e8f0', padding: '6px 14px', textAlign: 'center', fontSize: 8, color: '#64748B', fontStyle: 'italic' }}>
                        {receiptFooter}
                    </div>
                )}

                {/* Navy footer band */}
                <div style={{ background: '#0B132B', padding: '5px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: 'rgba(200,210,230,0.7)', fontSize: 7 }}>{companyName}</div>
                    <div style={{ color: '#D4AF37', fontSize: 7, fontStyle: 'italic' }}>Powered By ZATION | +94752723544</div>
                    <div style={{ color: 'rgba(200,210,230,0.7)', fontSize: 7 }}>Page 1 / 1</div>
                </div>
            </div>
        </div>
    );
}
