import { getProduct } from '@/app/actions/products';
import { getCategories } from '@/app/actions/categories';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ClientEditForm from './ClientEditForm'; // We will create this client component next

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [product, categories] = await Promise.all([
        getProduct(Number(id)),
        getCategories()
    ]);

    if (!product) {
        redirect('/inventory-management?tab=products');
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link href="/inventory-management?tab=products" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Edit Product</h1>
                    <p style={{ color: 'var(--muted)' }}>Update product details</p>
                </div>
            </header>

            <ClientEditForm product={product} categories={categories.data} />
        </div>
    );
}
