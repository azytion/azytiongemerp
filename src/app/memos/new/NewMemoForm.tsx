'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { getCustomers, Customer } from '@/app/actions/customers';
import { getProducts, Product } from '@/app/actions/products';
import { createMemo } from '@/app/actions/memos';
import { Search, User, Package, Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NewMemoForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Customer Selection
    const [customerQuery, setCustomerQuery] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerResults, setShowCustomerResults] = useState(false);
    const customerInputRef = useRef<HTMLInputElement>(null);
    const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

    // Product Selection
    const [productQuery, setProductQuery] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [_showProductResults, setShowProductResults] = useState(false);

    // Memo Data
    const [items, setItems] = useState<any[]>([]);
    const [dateOut, setDateOut] = useState((() => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })());
    const [dateDue, setDateDue] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const timer = setTimeout(async () => {
            const res = await getCustomers(customerQuery, 1, 50);
            setCustomers(res.data);
            if (!selectedCustomer) setShowCustomerResults(true);
        }, customerQuery ? 300 : 0);
        return () => clearTimeout(timer);
    }, [customerQuery]);

    useEffect(() => {
        const fetchProducts = async () => {
            const res = await getProducts(productQuery, undefined, 1, 500);
            if (res?.data) {
                setProducts(res.data);
                setShowProductResults(true);
            }
        };
        const timer = setTimeout(fetchProducts, productQuery ? 300 : 0);
        return () => clearTimeout(timer);
    }, [productQuery]);

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerQuery('');
        setShowCustomerResults(false);
    };

    const handleAddProduct = (product: Product) => {
        const existingItem = items.find(i => i.product_id === product.id);
        if (existingItem) {
            toast.error('Item already added to memo');
            return;
        }
        const newItem = {
            product_id: product.id,
            name: product.name,
            barcode: product.barcode,
            quantity: 1,
            carat_weight: product.gem_details?.carat_weight || 0,
            price_per_carat: product.pricing_method === 'per_carat'
                ? (product.selling_price / (product.gem_details?.carat_weight || 1))
                : 0,
            total_price: product.selling_price,
            pricing_method: product.pricing_method || 'per_piece',
            stock: product.stock,
        };
        setItems([...items, newItem]);
        setProductQuery('');
        setShowProductResults(false);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        const item = newItems[index];
        if (field === 'quantity') {
            const qty = parseInt(value) || 0;
            if (qty > item.stock) { toast.error(`Only ${item.stock} in stock!`); return; }
            item.quantity = qty;
        } else if (field === 'price_per_carat') {
            item.price_per_carat = parseFloat(value) || 0;
            if (item.carat_weight) item.total_price = item.carat_weight * item.price_per_carat;
        } else if (field === 'total_price') {
            item.total_price = parseFloat(value) || 0;
            if (item.pricing_method === 'per_carat' && item.carat_weight > 0)
                item.price_per_carat = item.total_price / item.carat_weight;
        }
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSubmit = async () => {
        if (!selectedCustomer) { toast.error('Please select a customer'); return; }
        if (items.length === 0) { toast.error('Please add at least one item'); return; }
        setLoading(true);
        const result = await createMemo({
            customer_id: selectedCustomer.id,
            date_out: dateOut,
            date_due: dateDue || undefined,
            notes,
            items: items.map(item => ({
                product_id: item.product_id,
                variant_id: null,
                quantity: item.quantity,
                carat_weight: item.carat_weight,
                price_per_carat: item.price_per_carat,
                total_price: item.total_price,
            })),
        });
        if (result.success) {
            toast.success('Memo created successfully!');
            router.push(`/memos/${result.memoId}`);
        } else {
            toast.error(result.error || 'Failed to create memo');
            setLoading(false);
        }
    };

    const calculateTotal = () => items.reduce((sum, item) => sum + (item.total_price || 0), 0);

    return (
        <>
            <style>{`
                .memo-layout {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 1.5rem;
                    align-items: start;
                }
                .memo-sidebar {
                    position: sticky;
                    top: 1rem;
                }
                /* Inventory table — hide Price/Ct column on small screens */
                .inv-col-price { display: table-cell; }
                /* Items table — stack on mobile */
                .memo-items-table { width: 100%; border-collapse: collapse; }
                .memo-item-row-desktop { display: table-row; }
                .memo-item-row-mobile { display: none; }

                @media (max-width: 900px) {
                    .memo-layout {
                        grid-template-columns: 1fr;
                    }
                    .memo-sidebar {
                        position: static;
                        order: -1; /* Summary card first on mobile */
                    }
                }

                @media (max-width: 640px) {
                    .inv-col-price { display: none; }

                    /* Replace desktop table rows with mobile card rows */
                    .memo-item-row-desktop { display: none !important; }
                    .memo-item-row-mobile  { display: block !important; }

                    .memo-item-card {
                        border: 1px solid var(--border);
                        border-radius: 0.5rem;
                        padding: 0.75rem;
                        margin-bottom: 0.625rem;
                        background: var(--surface);
                    }
                    .memo-item-card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 0.625rem;
                        gap: 0.5rem;
                    }
                    .memo-item-fields {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 0.5rem;
                    }
                    .memo-item-field label {
                        display: block;
                        font-size: 0.6875rem;
                        font-weight: 600;
                        color: var(--muted-foreground);
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 0.25rem;
                    }
                    .memo-item-field input {
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .memo-item-field .static-value {
                        font-size: 0.875rem;
                        font-weight: 600;
                        padding: 0.375rem 0;
                    }
                }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* ── Header ── */}
                <header style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href="/memos" className="btn btn-outline" style={{ padding: '0.5rem', flexShrink: 0 }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: 'clamp(1.375rem, 4vw, 2rem)', fontWeight: 'bold', margin: 0 }}>New Memo</h1>
                        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>Create a new consignment / approval note</p>
                    </div>
                </header>

                <div className="memo-layout">

                    {/* ── Left: main content ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>

                        {/* Customer */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={16} /> Customer Details
                            </h3>
                            {selectedCustomer ? (
                                <div style={{ padding: '0.875rem', background: 'var(--secondary)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{selectedCustomer.name}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{selectedCustomer.phone || selectedCustomer.email}</div>
                                    </div>
                                    <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(null)}>Change</button>
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <input
                                        ref={customerInputRef}
                                        type="text"
                                        className="input"
                                        placeholder="Search customer by name or phone..."
                                        value={customerQuery}
                                        onChange={e => setCustomerQuery(e.target.value)}
                                        onFocus={() => {
                                            const rect = customerInputRef.current?.getBoundingClientRect();
                                            if (rect) setDropdownRect(rect);
                                            setShowCustomerResults(true);
                                        }}
                                        onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                                        autoFocus
                                    />
                                    {mounted && showCustomerResults && customers.length > 0 && dropdownRect && createPortal(
                                        <div style={{
                                            position: 'fixed',
                                            top: dropdownRect.bottom + 4,
                                            left: dropdownRect.left,
                                            width: Math.min(dropdownRect.width, window.innerWidth - dropdownRect.left - 12),
                                            zIndex: 999999,
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border-strong)',
                                            borderRadius: 'var(--radius-lg)',
                                            boxShadow: 'var(--shadow-xl)',
                                            maxHeight: 260,
                                            overflowY: 'auto',
                                        }}>
                                            {customers.map(c => (
                                                <div
                                                    key={c.id}
                                                    onMouseDown={() => handleSelectCustomer(c)}
                                                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                >
                                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{c.phone || c.email || '—'}</div>
                                                </div>
                                            ))}
                                        </div>,
                                        document.body
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Package size={16} /> Memo Items
                            </h3>

                            {/* Inventory search */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Search inventory by name or barcode..."
                                        style={{ paddingLeft: '2.25rem' }}
                                        value={productQuery}
                                        onChange={e => setProductQuery(e.target.value)}
                                    />
                                </div>

                                <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.625rem 0.875rem', background: 'var(--secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Available Inventory</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 'normal' }}>{products.length} products</span>
                                    </div>
                                    <div style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.625rem' }}>Product</th>
                                                    <th style={{ textAlign: 'center', padding: '0.5rem 0.625rem', whiteSpace: 'nowrap' }}>Stock</th>
                                                    <th className="inv-col-price" style={{ textAlign: 'right', padding: '0.5rem 0.625rem', whiteSpace: 'nowrap' }}>Price</th>
                                                    <th style={{ width: '60px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.length > 0 ? products.map(p => (
                                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '0.5rem 0.625rem' }}>
                                                            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{p.barcode}</div>
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '0.5rem 0.625rem' }}>
                                                            <span style={{ padding: '2px 6px', borderRadius: 4, background: p.stock > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: p.stock > 0 ? 'var(--success)' : 'var(--error)', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                {p.stock}
                                                            </span>
                                                        </td>
                                                        <td className="inv-col-price" style={{ textAlign: 'right', padding: '0.5rem 0.625rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                            ${p.selling_price.toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '0.375rem 0.5rem' }}>
                                                            <button
                                                                onClick={() => handleAddProduct(p)}
                                                                className="btn btn-sm btn-primary"
                                                                style={{ padding: '0.25rem 0.5rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                            >
                                                                <Plus size={13} /> Add
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                                                            No products found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Added items — desktop table */}
                            <table className="memo-items-table">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Item</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', whiteSpace: 'nowrap' }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', whiteSpace: 'nowrap' }}>Cts</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', whiteSpace: 'nowrap' }}>Price/Ct</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', whiteSpace: 'nowrap' }}>Total</th>
                                        <th style={{ width: '36px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <Fragment key={idx}>
                                            {/* Desktop row */}
                                            <tr key={`d-${idx}`} className="memo-item-row-desktop" style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.625rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{item.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.barcode}</div>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                    <input type="number" min="1" className="input" style={{ width: '60px', padding: '0.25rem', textAlign: 'center' }} value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                                    {item.carat_weight > 0 ? item.carat_weight.toFixed(2) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                                                    {item.pricing_method === 'per_carat' ? (
                                                        <input type="number" className="input" style={{ width: '80px', padding: '0.25rem', textAlign: 'right' }} value={item.price_per_carat || ''} onChange={e => updateItem(idx, 'price_per_carat', e.target.value)} />
                                                    ) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                                                    <input type="number" className="input" style={{ width: '90px', padding: '0.25rem', textAlign: 'right' }} value={item.total_price || ''} onChange={e => updateItem(idx, 'total_price', e.target.value)} />
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <button onClick={() => removeItem(idx)} className="btn btn-sm btn-ghost" style={{ color: 'var(--destructive)', padding: '0.25rem' }}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Mobile card */}
                                            <tr key={`m-${idx}`} className="memo-item-row-mobile">
                                                <td colSpan={6} style={{ padding: '0 0 0.5rem 0' }}>
                                                    <div className="memo-item-card">
                                                        <div className="memo-item-card-header">
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.3 }}>{item.name}</div>
                                                                {item.barcode && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.barcode}</div>}
                                                            </div>
                                                            <button onClick={() => removeItem(idx)} className="btn btn-sm btn-ghost" style={{ color: 'var(--destructive)', padding: '0.25rem', flexShrink: 0 }}>
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                        <div className="memo-item-fields">
                                                            <div className="memo-item-field">
                                                                <label>Quantity</label>
                                                                <input type="number" min="1" className="input" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ padding: '0.375rem 0.5rem' }} />
                                                            </div>
                                                            {item.carat_weight > 0 && (
                                                                <div className="memo-item-field">
                                                                    <label>Carats</label>
                                                                    <div className="static-value">{item.carat_weight.toFixed(2)} ct</div>
                                                                </div>
                                                            )}
                                                            {item.pricing_method === 'per_carat' && (
                                                                <div className="memo-item-field">
                                                                    <label>Price / Ct</label>
                                                                    <input type="number" className="input" value={item.price_per_carat || ''} onChange={e => updateItem(idx, 'price_per_carat', e.target.value)} style={{ padding: '0.375rem 0.5rem' }} />
                                                                </div>
                                                            )}
                                                            <div className="memo-item-field">
                                                                <label>Total Price</label>
                                                                <input type="number" className="input" value={item.total_price || ''} onChange={e => updateItem(idx, 'total_price', e.target.value)} style={{ padding: '0.375rem 0.5rem' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </Fragment>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                                                No items added yet. Search products above.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="memo-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Memo Settings</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                <div>
                                    <label className="label">Date Out</label>
                                    <input type="date" className="input" value={dateOut} onChange={e => setDateOut(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label">Due Date <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Optional)</span></label>
                                    <input type="date" className="input" value={dateDue} onChange={e => setDateDue(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label">Notes</label>
                                    <textarea
                                        className="input"
                                        rows={3}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Terms, conditions, or internal notes..."
                                        style={{ resize: 'vertical', minHeight: '72px' }}
                                    />
                                </div>
                            </div>

                            <div className="divider" style={{ margin: '1.25rem 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--muted)' }}>Total Items:</span>
                                <span style={{ fontWeight: 600 }}>{items.length}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 700 }}>
                                <span>Total Value:</span>
                                <span>${calculateTotal().toLocaleString()}</span>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || items.length === 0 || !selectedCustomer}
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                <Save size={18} />
                                {loading ? 'Creating...' : 'Create Memo'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
