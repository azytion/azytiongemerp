'use client';

import { updateSupplier } from '@/app/actions/suppliers';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import Link from 'next/link';

export default function ClientEditForm({ supplier }: { supplier: any }) {
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        const result = await updateSupplier(supplier.id, formData);
        if (result.success) {
            toast.success('Supplier updated successfully');
            router.push('/contacts?tab=suppliers');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to update supplier');
        }
    }

    return (
        <div className="card" style={{ padding: '2rem' }}>
            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label className="label">Supplier Name</label>
                    <input name="name" type="text" className="input" required defaultValue={supplier.name} />
                </div>

                <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Phone</label>
                        <input name="phone" type="text" className="input" defaultValue={supplier.phone || ''} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Email</label>
                        <input name="email" type="email" className="input" defaultValue={supplier.email || ''} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label className="label">Address</label>
                    <textarea name="address" className="input" rows={3} defaultValue={supplier.address || ''}></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Link href="/inventory-management" className="btn btn-outline">Cancel</Link>
                    <button type="submit" className="btn btn-primary">
                        <Save size={20} />
                        Update Supplier
                    </button>
                </div>
            </form>
        </div>
    );
}
