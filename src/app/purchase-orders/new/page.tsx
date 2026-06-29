'use client';

import { createPurchaseOrder } from '@/app/actions/purchase-orders';
import { getSuppliers } from '@/app/actions/suppliers';
import { getProducts } from '@/app/actions/products';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NewPurchaseOrderPage() {
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [items, setItems] = useState<Array<{ product_id: number; quantity: number; expected_price: number }>>([]);

    useEffect(() => {
        Promise.all([
            getSuppliers('', 1, 1000),
            getProducts('', undefined, 1, 1000)
        ]).then(([s, p]) => {
            setSuppliers(s.data);
            setProducts(p.data);
        });
    }, []);

    const addItem = () => {
        setItems([...items, { product_id: 0, quantity: 1, expected_price: 0 }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: Number(value) };

        // Auto-fill price if product selected
        if (field === 'product_id') {
            const prod = products.find(p => p.id === Number(value));
            if (prod) {
                newItems[index].expected_price = prod.cost_price;
            }
        }
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.expected_price), 0);

    async function handleSubmit(formData: FormData) {
        if (items.length === 0 || items.some(i => i.product_id === 0)) {
            toast.error('Please add valid items');
            return;
        }

        formData.append('items', JSON.stringify(items));

        const result = await createPurchaseOrder(formData);
        if (result.success) {
            toast.success('Purchase Order created successfully');
            router.push('/inventory-management?tab=purchase-orders');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to create PO');
        }
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <style>{`
                @media (max-width: 640px) {
                    .po-row { flex-direction: column !important; }
                    .po-footer { flex-direction: column !important; }
                    .po-footer a, .po-footer button { width: 100%; justify-content: center; box-sizing: border-box; }
                }
            `}</style>
            <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Link href="/inventory-management" className="btn btn-outline" style={{ padding: '0.5rem', flexShrink: 0 }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.375rem, 4vw, 2rem)', fontWeight: 'bold', margin: 0 }}>New Purchase Order</h1>
                    <p style={{ color: 'var(--muted)', margin: 0 }}>Create a new order for a supplier</p>
                </div>
            </header>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Order Details</h3>
                    <div className="po-row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Supplier</label>
                            <select name="supplier_id" className="input" required>
                                <option value="">Select Supplier...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Expected Date</label>
                            <input name="expected_date" type="date" className="input" />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>Items</h3>
                        <button type="button" onClick={addItem} className="btn btn-outline btn-sm">
                            <Plus size={16} /> Add Item
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', marginBottom: '1rem', minWidth: '480px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Product</th>
                                    <th style={{ width: '90px' }}>Qty</th>
                                    <th style={{ width: '130px' }}>Unit Cost</th>
                                    <th style={{ width: '110px', textAlign: 'right' }}>Total</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <select
                                                className="input"
                                                value={item.product_id}
                                                onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                                required
                                            >
                                                <option value={0}>Select Product...</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="input"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="input"
                                                min="0"
                                                step="0.01"
                                                value={item.expected_price}
                                                onChange={(e) => updateItem(index, 'expected_price', e.target.value)}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                            ${(item.quantity * item.expected_price).toFixed(2)}
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => removeItem(index)} style={{ color: 'var(--destructive)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold', padding: '0.875rem 0.5rem' }}>Total Amount:</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.125rem', whiteSpace: 'nowrap' }}>${totalAmount.toFixed(2)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Notes</label>
                        <textarea name="notes" className="input" rows={3} placeholder="Internal notes..."></textarea>
                    </div>
                </div>

                <div className="po-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                    <Link href="/inventory-management" className="btn btn-outline">Cancel</Link>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={20} />
                        Create Purchase Order
                    </button>
                </div>
            </form>
        </div>
    );
}
