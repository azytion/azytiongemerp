/**
 * Server-side datetime utilities for ZATION GemERP.
 */

let _cachedTimezone: string | null = null;

/**
 * Load timezone from DB into cache. Call from server layout on startup.
 */
export async function warmTimezoneCache(): Promise<void> {
    try {
        const { getDb } = await import('@/lib/db');
        const db = await getDb();
        const row = await db.prepare("SELECT value FROM settings WHERE `key` = 'timezone'").get() as { value: string } | undefined;
        const tz = row?.value;
        if (tz && tz.length > 0) {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            _cachedTimezone = tz;
        }
    } catch {
        /* DB not ready */
    }
}

/**
 * Get the configured timezone (cached or system fallback).
 */
export function getConfiguredTimezone(): string {
    if (_cachedTimezone) return _cachedTimezone;
    const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    _cachedTimezone = sysTz;
    return sysTz;
}

export function nowLocalISO(): string {
    return new Date().toISOString();
}

export function todayLocalDate(): string {
    const tz = getConfiguredTimezone();
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

export function invalidateTimezoneCache() {
    _cachedTimezone = null;
}
