import { getCustomer } from '@/app/actions/customers';
import EditCustomerForm from './form';
import { notFound } from 'next/navigation';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const customer = await getCustomer(Number(id));

    if (!customer) {
        notFound();
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '2rem' }}>Edit Customer</h1>
            <EditCustomerForm customer={customer} />
        </div>
    );
}
