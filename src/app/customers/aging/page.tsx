import { redirect } from 'next/navigation';

export default function CustomerAgingPage() {
    redirect('/contacts?tab=aging');
}
