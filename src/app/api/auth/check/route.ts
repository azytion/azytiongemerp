import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/auth';

export async function GET() {
    console.log('--- API: Auth Check Started ---');
    try {
        const payload = await getSession();
        console.log('--- API: Auth Check Completed. IsValid:', !!payload);
        if (!payload) {
            return NextResponse.json({ isValid: false }, { status: 200 });
        }
        return NextResponse.json({ isValid: true, role: payload.role }, { status: 200 });
    } catch (error) {
        console.error('--- API: Auth Check Error:', error);
        return NextResponse.json({ isValid: false }, { status: 200 });
    }
}
