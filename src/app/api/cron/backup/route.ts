import { NextRequest, NextResponse } from 'next/server';

function isCronAuthorized(request: NextRequest): boolean {
    const configuredSecret = process.env.CRON_SECRET;
    if (!configuredSecret && process.env.NODE_ENV !== 'production') return true;
    if (!configuredSecret) return false;

    // Only accept via header — query params appear in server/CDN logs
    const headerSecret = request.headers.get('x-cron-secret');
    return headerSecret === configuredSecret;
}

export async function GET(request: NextRequest) {
    try {
        if (!isCronAuthorized(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { getSetting } = await import('@/app/actions/settings');
        const configStr = await getSetting('scheduled_backup_config');
        if (!configStr) return NextResponse.json({ skipped: 'no config' });

        const config = JSON.parse(configStr);
        if (!config.enabled || !config.email) {
            return NextResponse.json({ skipped: 'disabled or no email' });
        }

        const now = new Date();
        const lastRun = config.lastRun ? new Date(config.lastRun) : null;

        const [schedHour, schedMin] = (config.time || '02:00').split(':').map(Number);

        const windowStart = new Date(now);
        windowStart.setHours(schedHour, schedMin, 0, 0);
        const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

        const inWindow = now >= windowStart && now < windowEnd;
        if (!inWindow) {
            return NextResponse.json({
                skipped: 'outside scheduled window',
                scheduledTime: `${String(schedHour).padStart(2, '0')}:${String(schedMin).padStart(2, '0')}`,
                currentTime: now.toISOString(),
            });
        }

        let isDue = false;
        if (!lastRun) {
            isDue = true;
        } else {
            const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
            if (config.frequency === 'daily') isDue = hoursSince >= 20;
            else if (config.frequency === 'weekly') isDue = hoursSince >= 144;
            else if (config.frequency === 'monthly') isDue = hoursSince >= 648;
        }

        if (!isDue) {
            return NextResponse.json({
                skipped: 'already ran recently',
                lastRun: lastRun?.toISOString(),
                frequency: config.frequency,
                nextDue: getNextDueTime(lastRun, config.frequency, schedHour, schedMin),
            });
        }

        const { sendBackupEmailForCron } = await import('@/app/actions/data-management');
        const result = await sendBackupEmailForCron(config.email, true);

        if (result.success) {
            return NextResponse.json({ sent: true, to: config.email, frequency: config.frequency, sentAt: now.toISOString() });
        }
        return NextResponse.json({ error: 'Backup send failed' }, { status: 500 });
    } catch (error: any) {
        console.error('Backup cron error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

function getNextDueTime(lastRun: Date | null, frequency: string, schedHour: number, schedMin: number): string {
    if (!lastRun) return 'now';
    const next = new Date(lastRun);
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    next.setHours(schedHour, schedMin, 0, 0);
    return next.toISOString();
}
