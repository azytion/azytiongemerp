'use client';

import { updateCustomer, Customer } from '@/app/actions/customers';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function EditCustomerForm({ customer }: { customer: Customer }) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(formData: FormData) {
        const res = await updateCustomer(customer.id, formData);
        if (res?.error) {
            setError(res.error);
        } else {
            router.push('/contacts?tab=customers');
            router.refresh();
        }
    }

    return (
        <form action={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && (
                <div style={{ padding: '1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label style={{ fontWeight: 500 }}>Full Name</label>
                <input name="name" type="text" className="input" required defaultValue={customer.name} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 500 }}>Phone Number</label>
                    <input name="phone" type="tel" className="input" defaultValue={customer.phone || ''} />
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 500 }}>Email (Optional)</label>
                    <input name="email" type="email" className="input" defaultValue={customer.email || ''} />
                </div>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label style={{ fontWeight: 500 }}>Address</label>
                <textarea name="address" className="input" style={{ height: '100px', paddingTop: '0.5rem' }} defaultValue={customer.address || ''} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" onClick={() => router.back()} className="btn btn-outline">Cancel</button>
            </div>
        </form>
    );
}
