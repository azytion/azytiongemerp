'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { ReactNode, useEffect, useState } from 'react';
import { updateFormatSettings } from '@/lib/utils';
import { getSettings } from '@/app/actions/settings';
import { getCurrencySymbol } from '@/lib/currencies';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Module-level flag so Fast Refresh re-mounts don't re-save the timezone on every HMR cycle
let timezoneSaved = false;

export function QueryProvider({ children }: { children: ReactNode }) {
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    useEffect(() => {
        // In React 18 Strict Mode, effects run twice. We use a cancelled flag so the
        // first (discarded) run bails out before updating state, avoiding a double DB call.
        let cancelled = false;

        const loadSettings = async () => {
            try {
                const settings = await Promise.race([
                    getSettings(),
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 8000)
                    ),
                ]) as Record<string, string>;

                if (cancelled) return;

                const currencyCode = settings.currency_code || 'USD';
                const currencySymbol = settings.currency_symbol || getCurrencySymbol(currencyCode);

                // Auto-detect browser timezone and save to settings if not already configured.
                // Guard with module-level flag so Fast Refresh re-mounts don't re-fire the write.
                const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const configuredTimezone = settings.timezone || browserTimezone;

                if (!settings.timezone && browserTimezone && !timezoneSaved) {
                    timezoneSaved = true;
                    // Defer this write — only persists if user is authenticated
                    setTimeout(async () => {
                        try {
                            const { saveInitialTimezone } = await import('@/app/actions/settings');
                            await saveInitialTimezone(browserTimezone);
                        } catch {
                            // Non-critical — silently ignore
                            timezoneSaved = false; // Allow retry on next full page load
                        }
                    }, 3000);
                }

                updateFormatSettings({
                    currencyCode,
                    currencySymbol,
                    dateFormat: settings.date_format || 'MM/DD/YYYY',
                    timeFormat: (settings.time_format as '12h' | '24h') || '12h',
                    timezone: configuredTimezone,
                    country: settings.country || 'US',
                });
            } catch {
                // Fallback to defaults if settings load fails (e.g. DB not ready yet)
                if (!cancelled) {
                    updateFormatSettings({
                        currencyCode: 'USD',
                        currencySymbol: '$',
                        dateFormat: 'MM/DD/YYYY',
                        timeFormat: '12h',
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        country: 'US',
                    });
                }
            } finally {
                if (!cancelled) setIsSettingsLoaded(true);
            }
        };

        loadSettings();
        return () => {
            cancelled = true;
        };
    }, []);

    if (!isSettingsLoaded) {
        return <LoadingScreen />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
            )}
        </QueryClientProvider>
    );
}
