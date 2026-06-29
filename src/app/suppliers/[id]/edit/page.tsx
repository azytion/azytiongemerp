import { getSupplier } from '@/app/actions/suppliers';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ClientEditForm from './ClientEditForm';

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supplier = await getSupplier(Number(id));

    if (!supplier) {
        redirect('/inventory-management');
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link href="/inventory-management" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Edit Supplier</h1>
                    <p style={{ color: 'var(--muted)' }}>Update supplier details</p>
                </div>
            </header>

            <ClientEditForm supplier={supplier} />
        </div>
    );
}
