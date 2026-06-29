'use client';

import { createCheque } from '@/app/actions/cheques';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewChequePage() {
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        const result = await createCheque(formData);
        if (result.success) {
            toast.success('Cheque created successfully');
            router.push('/finance?tab=cheques');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to create cheque');
        }
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link href="/finance?tab=cheques" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Add Cheque</h1>
                    <p style={{ color: 'var(--muted)' }}>Record a new post-dated cheque</p>
                </div>
            </header>

            <div className="card" style={{ padding: '2rem' }}>
                <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Cheque Number</label>
                            <input name="cheque_number" type="text" className="input" required placeholder="e.g. 10245" />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Amount</label>
                            <input name="amount" type="number" step="0.01" className="input" required placeholder="0.00" />
                        </div>
                    </div>

                    <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Bank Name</label>
                            <input name="bank_name" type="text" className="input" required placeholder="e.g. Chase" />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Account Number</label>
                            <input name="account_number" type="text" className="input" placeholder="Optional" />
                        </div>
                    </div>

                    <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Issue Date</label>
                            <input name="issue_date" type="date" className="input" required />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Due Date</label>
                            <input name="due_date" type="date" className="input" required />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Payee Name</label>
                        <input name="payee_name" type="text" className="input" placeholder="Who is the cheque to/from?" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="label">Notes</label>
                        <textarea name="notes" className="input" rows={3} placeholder="Optional notes..."></textarea>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Link href="/finance" className="btn btn-outline">Cancel</Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={20} />
                            Save Cheque
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
