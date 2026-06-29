import { redirect } from 'next/navigation';

export default function BrokersPage() {
    redirect('/contacts?tab=brokers');
}
