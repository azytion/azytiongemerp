import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

async function getSecretKey() {
    const secret = process.env.JWT_SECRET;
    if (
        process.env.NODE_ENV === 'production' &&
        (!secret || secret === 'zation-pos-secret-key-change-this')
    ) {
        throw new Error('JWT_SECRET must be set to a strong random value in production');
    }
    return new TextEncoder().encode(secret || 'zation-pos-secret-key-change-this');
}

// ── Role-based access control ─────────────────────────────────────────────────
const ROLE_ACCESS: Record<string, { allowed: string[]; denied: string[]; redirect: string }> = {
    cashier: {
        allowed: ['/', '/pos', '/sales', '/products'],
        denied:  [],
        redirect: '/',
    },
    manager: {
        allowed: [],
        denied:  ['/settings', '/finance', '/super-admin', '/admin'],
        redirect: '/',
    },
    admin: {
        allowed: [],
        denied:  ['/super-admin', '/admin/tenants'],
        redirect: '/',
    },
    super_admin: {
        allowed: [],
        denied:  [],
        redirect: '/super-admin',
    },
};

function isPathAllowed(path: string, role: string): boolean {
    const rules = ROLE_ACCESS[role];
    if (!rules) return false;

    if (role === 'super_admin') return true;

    if (role === 'cashier') {
        return rules.allowed.some(p => path === p || path.startsWith(p + '/'));
    }

    return !rules.denied.some(p => path === p || path.startsWith(p + '/'));
}

function isDirectPosDocumentLaunch(request: NextRequest): boolean {
    if (request.nextUrl.pathname !== '/pos' || request.nextUrl.search) return false;

    const fetchDest = request.headers.get('sec-fetch-dest');
    if (fetchDest && fetchDest !== 'document') return false;

    const referer = request.headers.get('referer');
    if (!referer) return true;

    try {
        return new URL(referer).origin !== request.nextUrl.origin;
    } catch {
        return true;
    }
}

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip internals and static assets
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/') ||
        pathname.includes('.') ||
        pathname === '/favicon.ico' ||
        pathname === '/manifest.json' ||
        pathname === '/sw.js' ||
        request.headers.has('next-action')
    ) {
        return NextResponse.next();
    }

    const sessionCookie = request.cookies.get('session')?.value;
    const isLoginPage = pathname === '/login';

    // Unauthenticated
    if (!sessionCookie) {
        if (isLoginPage) return NextResponse.next();
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify JWT
    try {
        const secret = await getSecretKey();
        const { payload } = await jwtVerify(sessionCookie, secret);
        const role = (payload.role as string) || '';

        // Authenticated user on login page → send to their home
        if (isLoginPage) {
            const dest = role === 'super_admin' ? '/super-admin' : '/';
            return NextResponse.redirect(new URL(dest, request.url));
        }

        // ── Subscription enforcement (non-super-admin only) ───────────────
        // Super admin always passes through so they can unblock/extend
        if (role !== 'super_admin' && !isLoginPage) {
            try {
                const subStatus = request.cookies.get('sub_status')?.value;
                const subExpiry = request.cookies.get('sub_expiry')?.value;

                // We cache subscription state in short-lived cookies set by the API
                // to avoid a DB call on every request. If not cached, allow through
                // and let the login check handle it.
                if (subStatus === 'blocked') {
                    const response = NextResponse.redirect(new URL('/login', request.url));
                    response.cookies.delete('session');
                    return response;
                }
                if (subExpiry && subExpiry !== 'lifetime') {
                    const expiry = new Date(subExpiry);
                    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
                        const response = NextResponse.redirect(new URL('/login', request.url));
                        response.cookies.delete('session');
                        return response;
                    }
                }
            } catch {
                // If subscription cookies not set, allow through
            }
        }

        // Super admin visiting / → send to super-admin dashboard
        if (role === 'super_admin' && pathname === '/') {
            return NextResponse.redirect(new URL('/super-admin', request.url));
        }

        // Deprecated route
        if (pathname.startsWith('/gem-calculator')) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        if (isDirectPosDocumentLaunch(request)) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        // RBAC check
        if (!isPathAllowed(pathname, role)) {
            const rules = ROLE_ACCESS[role];
            return NextResponse.redirect(new URL(rules?.redirect || '/', request.url));
        }

        return NextResponse.next();
    } catch {
        // Invalid or expired token
        if (!isLoginPage) {
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('session');
            return response;
        }
        return NextResponse.next();
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
