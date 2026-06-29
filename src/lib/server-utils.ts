'use server';

import { getSetting } from '@/app/actions/settings';

/**
 * Server-side currency formatter that reads from database settings
 * Use this in server components instead of the client-side formatCurrency
 */
export async function formatCurrencyServer(amount: number): Promise<string> {
    try {
        const currencyCode = await getSetting('currency_code') || 'USD';
        const _currencySymbol = await getSetting('currency_symbol') || '$';

        // Use Intl.NumberFormat with the currency code from settings
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            currencyDisplay: 'code'
        }).format(amount);
    } catch (_e) {
        // Fallback to USD if settings can't be read
        return `USD ${amount.toFixed(2)}`;
    }
}

/**
 * Server-side date formatter that reads from database settings
 */
export async function formatDateServer(dateStr: string | Date, options?: { showTime?: boolean }): Promise<string> {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const timezone = await getSetting('timezone') || 'UTC';
        const timeFormat = await getSetting('time_format') || '12h';

        const dtOptions: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...(options?.showTime && {
                hour: 'numeric',
                minute: 'numeric',
                hour12: timeFormat === '12h'
            })
        };

        return new Intl.DateTimeFormat('en-US', dtOptions).format(date);
    } catch (_e) {
        return String(dateStr);
    }
}
