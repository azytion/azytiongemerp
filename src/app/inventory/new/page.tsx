'use client';

import { createAdjustment } from '@/app/actions/inventory';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getProducts } from '@/app/actions/products';

export default function NewInventoryAdjustmentPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        getProducts('', undefined, 1, 1000).then(res => setProducts(res.data));
    }, []);

    async function handleSubmit(formData: FormData) {
        const result = await createAdjustment(formData);
        if (result.success) {
            toast.success('Adjustment created successfully');
            router.push('/inventory-management?tab=inventory');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to create adjustment');
        }
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link href="/inventory-management" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>New Adjustment</h1>
                    <p style={{ color: 'var(--muted)' }}>Adjust stock levels manually</p>
                </div>
            </header>

            <div className="card" style={{ padding: '2rem' }}>
                <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Product</label>
                        <select name="product_id" className="input" required>
                            <option value="">Select Product...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock})</option>
                            ))}
                        </select>
                    </div>

                    <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Adjustment Type</label>
                            <select name="adjustment_type" className="input" required>
                                <option value="correction">Correction (Stocktake)</option>
                                <option value="damage">Damage (Remove)</option>
                                <option value="loss">Loss/Theft (Remove)</option>
                                <option value="return">Customer Return (Add)</option>
                            </select>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Quantity</label>
                            <input name="quantity" type="number" className="input" required placeholder="Qty to add/remove" />
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                Positive for add/correction, value will be subtracted for damage/loss automatically.
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Reason</label>
                        <input name="reason" type="text" className="input" placeholder="Short description of reason" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Notes</label>
                        <textarea name="notes" className="input" rows={3} placeholder="Additional details..."></textarea>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Link href="/inventory-management" className="btn btn-outline">Cancel</Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={20} />
                            Save Adjustment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
