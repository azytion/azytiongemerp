import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/runtime-paths';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('session')?.value;

        if (!token) {
            return NextResponse.json({ isValid: false, reason: 'no_cookie' }, { status: 200 });
        }

        const secret = new TextEncoder().encode(getJwtSecret());
        const { payload } = await jwtVerify(token, secret);

        return NextResponse.json({ isValid: true, role: payload.role }, { status: 200 });
    } catch (error: any) {
        // Only log unexpected errors, not normal expired-token rejections
        const msg: string = error?.message || '';
        if (!msg.includes('expired') && !msg.includes('invalid') && !msg.includes('signature')) {
            console.error('[auth/check]', msg);
        }
        return NextResponse.json({ isValid: false, reason: 'verify_failed' }, { status: 200 });
    }
}
