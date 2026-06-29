'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Gem } from 'lucide-react';
import { Product } from '@/app/actions/products';

interface ProductEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (quantity: number, discount: number, discountType: 'percentage' | 'fixed', price: number) => void;
    product: Product | null;
    currencySymbol: string;
    initialQuantity?: number;
    initialDiscount?: number;
    initialPrice?: number;
}

export default function ProductEntryModal({
    isOpen, onClose, onConfirm, product, currencySymbol,
    initialQuantity = 1, initialDiscount = 0, initialPrice
}: ProductEntryModalProps) {
    const [quantity, setQuantity] = useState('1');
    const [discount, setDiscount] = useState('0');
    const [price, setPrice] = useState('0');
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
    const [mounted, setMounted] = useState(false);

    const priceInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const discountInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen) {
            setQuantity(initialQuantity.toString());
            setDiscount(initialDiscount.toString());
            // For per-carat products, default price = selling_price (already per-carat rate)
            // The quantity field represents carats for per-carat products
            setPrice(initialPrice?.toString() || product?.selling_price.toString() || '0');
            setDiscountType('fixed');
            setTimeout(() => {
                priceInputRef.current?.focus();
                priceInputRef.current?.select();
            }, 50);
        }
    }, [isOpen, product, initialPrice]);

    if (!isOpen || !product || !mounted) return null;

    const handleConfirm = () => {
        const qty = parseFloat(quantity);
        const disc = parseFloat(discount);
        const p = parseFloat(price);
        if (isNaN(qty) || qty === 0) return;
        onConfirm(qty, isNaN(disc) ? 0 : disc, discountType, isNaN(p) ? 0 : p);
    };

    const handleKeyDown = (e: React.KeyboardEvent, field: 'price' | 'quantity' | 'discount') => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (field === 'price') { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }
            else if (field === 'quantity') { discountInputRef.current?.focus(); discountInputRef.current?.select(); }
            else if (field === 'discount') { handleConfirm(); }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const stockCount = product.stock;

    return createPortal(
        <div
            className="modal-blur-overlay"
            style={{ zIndex: 999999 }}
        >
            <div className="modal-portal-content" style={{ maxWidth: '420px' }}>
                <div
                    className="card"
                    style={{
                        padding: 0,
                        boxShadow: 'var(--shadow-xl)',
                        overflow: 'hidden',
                        animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        position: 'relative',
                    }}
                >
                    {/* Gold top accent */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-primary)' }} />

                {/* Header */}
                <div style={{
                    padding: '1.125rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                        <div style={{ width: 30, height: 30, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Gem size={15} color="var(--primary)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {product.name}
                            </h3>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>
                                {stockCount} {product.pricing_method === 'per_carat' ? 'ct' : 'pcs'} in stock
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-close"><X size={16} /></button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                    {/* Per-carat pricing notice */}
                    {product.pricing_method === 'per_carat' && (
                        <div style={{ padding: '0.625rem 0.875rem', background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 'var(--radius)', fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            Per-carat pricing — enter quantity in carats (ct)
                        </div>
                    )}
                    {/* Price */}
                    <div className="form-group">
                        <label>Selling Price</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                                padding: '0 0.75rem',
                                height: '2.625rem',
                                display: 'flex', alignItems: 'center',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--input-border)',
                                borderRight: 'none',
                                borderRadius: 'var(--radius) 0 0 var(--radius)',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                color: 'var(--primary)',
                                flexShrink: 0,
                            }}>
                                {currencySymbol}
                            </span>
                            <input
                                ref={priceInputRef}
                                type="number"
                                className="input"
                                style={{ flex: 1, borderRadius: '0 var(--radius) var(--radius) 0', fontSize: '1.125rem', fontWeight: 700 }}
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, 'price')}
                            />
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="form-group">
                        <label>{product.pricing_method === 'per_carat' ? 'Carat Weight (ct)' : 'Quantity'}</label>
                        <input
                            ref={qtyInputRef}
                            type="number"
                            className="input"
                            style={{ fontSize: '1.125rem', fontWeight: 700 }}
                            value={quantity}
                            onChange={e => {
                                setQuantity(e.target.value);
                                // For per-carat: auto-recalculate total price when carat weight changes
                                if (product.pricing_method === 'per_carat') {
                                    const newQty = parseFloat(e.target.value) || 0;
                                    // selling_price is total price; derive rate from original carat weight
                                    const origCarat = product.gem_details?.carat_weight || 1;
                                    const ratePerCarat = origCarat > 0 ? product.selling_price / origCarat : product.selling_price;
                                    if (newQty > 0 && ratePerCarat > 0) {
                                        setPrice((ratePerCarat * newQty).toFixed(2));
                                    }
                                }
                            }}
                            onKeyDown={e => handleKeyDown(e, 'quantity')}
                        />
                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                            {product.pricing_method === 'per_carat'
                                ? (() => {
                                    const origCarat = product.gem_details?.carat_weight || 1;
                                    const rate = origCarat > 0 ? product.selling_price / origCarat : product.selling_price;
                                    return `Rate: ${currencySymbol} ${rate.toFixed(2)}/ct`;
                                  })()
                                : 'Use negative value for returns (e.g. -1)'}
                        </div>
                    </div>

                    {/* Discount */}
                    <div className="form-group">
                        <label>Discount</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                ref={discountInputRef}
                                type="number"
                                className="input"
                                style={{ flex: 1, borderRadius: 'var(--radius) 0 0 var(--radius)' }}
                                value={discount}
                                onChange={e => setDiscount(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, 'discount')}
                            />
                            <button
                                onClick={() => setDiscountType(dt => dt === 'fixed' ? 'percentage' : 'fixed')}
                                style={{
                                    padding: '0 1rem',
                                    background: discountType === 'percentage' ? 'var(--primary)' : 'var(--surface-2)',
                                    border: '1px solid var(--border-strong)',
                                    borderLeft: 'none',
                                    borderRadius: '0 var(--radius) var(--radius) 0',
                                    color: discountType === 'percentage' ? '#000' : 'var(--foreground)',
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    minWidth: 52,
                                    fontFamily: 'var(--font-sans)',
                                    transition: 'all var(--transition-fast)',
                                }}
                            >
                                {discountType === 'fixed' ? currencySymbol : '%'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    gap: '0.625rem',
                    justifyContent: 'flex-end',
                    background: 'var(--surface-2)',
                }}>
                    <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ minWidth: 90 }}>Cancel</button>
                    <button onClick={handleConfirm} className="btn btn-primary btn-sm" style={{ minWidth: 90, gap: '0.375rem' }}>
                        <Check size={15} /> Add to Cart
                    </button>
                </div>
            </div>
        </div>
    </div>,
        document.body
    );
}
