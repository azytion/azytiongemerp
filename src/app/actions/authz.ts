import { getSession } from './auth';

export type AppRole = 'cashier' | 'manager' | 'admin' | 'super_admin';

export type AuthSession = {
    sub?: string;
    username?: string;
    role?: string;
};

const ROLE_ORDER: Record<AppRole, number> = {
    cashier: 1,
    manager: 2,
    admin: 3,
    super_admin: 4,
};

export async function requireSession(): Promise<AuthSession> {
    const session = await getSession() as AuthSession | null;
    if (!session?.sub || !session.role) {
        throw new Error('Unauthorized');
    }
    return session;
}

export async function requireAnyRole(roles: AppRole[]): Promise<AuthSession> {
    const session = await requireSession();
    if (!roles.includes(session.role as AppRole)) {
        throw new Error('Forbidden');
    }
    return session;
}

export async function requireMinRole(role: AppRole): Promise<AuthSession> {
    const session = await requireSession();
    const current = ROLE_ORDER[session.role as AppRole] || 0;
    if (current < ROLE_ORDER[role]) {
        throw new Error('Forbidden');
    }
    return session;
}

export function userIdFromSession(session: AuthSession, fallback = 1) {
    return session.sub ? Number(session.sub) : fallback;
}

export function authError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return {
        success: false,
        error: message === 'Forbidden' ? 'Access denied' : 'Unauthorized',
    } as const;
}
