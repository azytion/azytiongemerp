import { getMemo } from '@/app/actions/memos';
import MemoDetailsClient from './MemoDetailsClient';
import { redirect } from 'next/navigation';

export default async function MemoDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const memo = await getMemo(Number(id));

    if (!memo) {
        redirect('/memos');
    }

    return <MemoDetailsClient memo={memo} />;
}
