'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export default function AutoDataExporter() {
    // Run once on mount
    useEffect(() => {
        const checkAndExport = async () => {
            try {
                // 1. Check if today is the 1st of the month
                const today = new Date();
                if (today.getDate() !== 1) {
                    return; // Not the 1st of the month
                }

                // 2. Check if we already exported this month
                // Format: YYYY-MM-DD
                const todayStr = today.toISOString().split('T')[0];
                const { getSetting, updateSetting } = await import('@/app/actions/settings');
                const lastExport = await getSetting('last_auto_export_date');

                // If last export was today, skip
                if (lastExport === todayStr) {
                    return;
                }

                // 3. Trigger auto export
                console.log('Initiating automatic monthly data export...');
                toast.info('Starting automatic monthly data backup...');

                const { exportAllData } = await import('@/app/actions/data-management');
                const result = await exportAllData();

                if (result.success && result.data) {
                    // 4. Download file
                    const link = document.createElement('a');
                    link.href = `data:application/zip;base64,${result.data}`;
                    link.download = `Auto-Monthly-Backup-${todayStr}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // 5. Update tracking
                    await (updateSetting as any)('last_auto_export', new Date().toISOString());
                    await (updateSetting as any)('last_auto_export_status', 'success');
                } else {
                    console.error('Auto backup failed:', result.error);
                    toast.error('Auto backup failed: ' + result.error);
                }

            } catch (error) {
                console.error('Error in auto data exporter:', error);
            }
        };

        // Delay slightly to not block initial render
        const timer = setTimeout(() => {
            checkAndExport();
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    // Render nothing
    return null;
}
