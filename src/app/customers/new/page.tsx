'use client';

import { createCustomer } from '@/app/actions/customers';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useOfflineAction } from '@/hooks/useOfflineAction';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export default function NewCustomerPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const offlineAction = useOfflineAction();
    const isOnline = useOnlineStatus();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const payload = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string || '',
            email: formData.get('email') as string || '',
            address: formData.get('address') as string || '',
        };

        const res = await offlineAction('create_customer', payload, () => createCustomer(formData));

        setLoading(false);

        if ('queued' in res && res.queued) {
            // Queued offline — go back
            router.push('/contacts?tab=customers');
        } else if (res.success) {
            router.push('/contacts?tab=customers');
        } else {
            setError((res as any).error || 'Failed to create customer');
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1>Add New Customer</h1>
                {!isOnline && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        background: 'rgba(249,115,22,0.1)',
                        border: '1px solid rgba(249,115,22,0.3)',
                        borderRadius: '99px',
                        color: '#f97316',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                    }}>
                        <WifiOff size={12} />
                        Offline — will sync later
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(244,63,94,0.08)', color: 'var(--destructive)', borderRadius: 'var(--radius)', border: '1px solid rgba(244,63,94,0.2)' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 500 }}>Full Name</label>
                    <input name="name" type="text" className="input" required placeholder="e.g. John Doe" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 500 }}>Phone Number</label>
                        <input name="phone" type="tel" className="input" placeholder="077xxxxxxx" />
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 500 }}>Email (Optional)</label>
                        <input name="email" type="email" className="input" placeholder="john@example.com" />
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 500 }}>Address</label>
                    <textarea name="address" className="input" style={{ height: '100px', paddingTop: '0.5rem' }} placeholder="Street, City..." />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                        {loading ? 'Saving...' : isOnline ? 'Save Customer' : 'Save (Queue for Sync)'}
                    </button>
                    <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
                </div>
            </form>
        </div>
    );
}
