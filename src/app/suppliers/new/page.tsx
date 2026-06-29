'use client';

import { createSupplier } from '@/app/actions/suppliers';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewSupplierPage() {
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        const result = await createSupplier(formData);
        if (result.success) {
            toast.success('Supplier created successfully');
            router.push('/contacts?tab=suppliers');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to create supplier');
        }
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link href="/contacts?tab=suppliers" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Add Supplier</h1>
                    <p style={{ color: 'var(--muted)' }}>Create a new supplier profile</p>
                </div>
            </header>

            <div className="card" style={{ padding: '2rem' }}>
                <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Supplier Name</label>
                        <input name="name" type="text" className="input" required placeholder="e.g. ABC Distributors" />
                    </div>

                    <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Phone</label>
                            <input name="phone" type="text" className="input" placeholder="e.g. +1 234 567 890" />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Email</label>
                            <input name="email" type="email" className="input" placeholder="contact@example.com" />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Address</label>
                        <textarea name="address" className="input" rows={3} placeholder="Full address..."></textarea>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Link href="/contacts?tab=suppliers" className="btn btn-outline">Cancel</Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={20} />
                            Save Supplier
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
