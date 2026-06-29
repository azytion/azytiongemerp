'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, Loader2, Save, AlertTriangle, Clock, Bell, Zap, RefreshCw, WifiOff } from 'lucide-react';
import { updateSetting, getSetting } from '@/app/actions/settings';
import { vacuumDatabase } from '@/app/actions/system';
import { sendBackupEmail, exportAllData, downloadTemplates, importAllData } from '@/app/actions/data-management';
import { toast } from 'sonner';

interface ScheduledBackup {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    email: string;
    lastRun?: string;        // Last SCHEDULED send
    lastManualSend?: string; // Last MANUAL send
    history?: Array<{ sentAt: string; type: 'scheduled' | 'manual'; email: string }>;
}

export default function DataManagementTab() {
    const [exporting, setExporting] = useState(false);
    const [generatingTemplates, setGeneratingTemplates] = useState(false);
    const [importing, setImporting] = useState(false);
    const [vacuuming, setVacuuming] = useState(false);
    const [companyName, setCompanyName] = useState('POS');
    const [scheduledBackup, setScheduledBackup] = useState<ScheduledBackup>({
        enabled: false,
        frequency: 'daily',
        time: '02:00',
        email: '',
    });
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [sendingBackup, setSendingBackup] = useState(false);
    const [pendingOffline, setPendingOffline] = useState(0);
    const [syncingOffline, setSyncingOffline] = useState(false);
    const [filter, setFilter] = useState<{
        type: 'alltime' | 'year' | 'month' | 'custom';
        year: number;
        month: number;
        startDate: string;
        endDate: string;
    }>({
        type: 'alltime',
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        startDate: '',
        endDate: '',
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/settings/company_name')
            .then(r => r.json())
            .then(d => setCompanyName(d.value || 'POS'))
            .catch(() => {});
        loadSchedule();
        loadPendingOffline();
    }, []);

    async function loadPendingOffline() {
        try {
            const { getPendingWriteCount } = await import('@/lib/db/LocalDB');
            const count = await getPendingWriteCount();
            setPendingOffline(count);
        } catch { /* IndexedDB not available in SSR */ }
    }

    async function handleSyncOffline() {
        setSyncingOffline(true);
        try {
            const { localDB, setSyncMeta } = await import('@/lib/db/LocalDB');
            const { createSale } = await import('@/app/actions/sales');
            const pendingSales = await localDB.offlineSales.where('synced').equals(0).toArray();
            let synced = 0;
            for (const sale of pendingSales) {
                try {
                    const res = await createSale(
                        sale.items, sale.totalAmount, sale.cashReceived,
                        sale.customerId, sale.paymentMethod, sale.paymentDetails,
                        0, sale.discountAmount, sale.userId,
                        sale.brokerId ?? null, sale.brokerCommission ?? 0
                    );
                    if (res.success) {
                        await localDB.offlineSales.update(sale.id!, { synced: 1 });
                        synced++;
                    }
                } catch { /* continue */ }
            }
            if (synced > 0) {
                await setSyncMeta('last_synced_at', new Date().toISOString());
                toast.success(`${synced} offline sale${synced !== 1 ? 's' : ''} synced`);
            } else {
                toast.info('No pending offline sales to sync');
            }
            await loadPendingOffline();
        } catch (e: any) {
            toast.error('Sync failed: ' + e.message);
        } finally {
            setSyncingOffline(false);
        }
    }

    async function loadSchedule() {
        try {
            const val = await getSetting('scheduled_backup_config');
            if (val) {
                const parsed = JSON.parse(val);
                setScheduledBackup(parsed);
            }
        } catch { /* ignore */ }
    }

    async function saveSchedule() {
        setSavingSchedule(true);
        try {
            await updateSetting('scheduled_backup_config', JSON.stringify(scheduledBackup), 'data');
            toast.success('Backup schedule saved');
        } catch {
            toast.error('Failed to save schedule');
        } finally {
            setSavingSchedule(false);
        }
    }

    async function handleSendBackupNow() {
        if (!scheduledBackup.email) {
            toast.error('Please enter an email address first');
            return;
        }
        setSendingBackup(true);
        toast.loading('Generating and sending backup...', { id: 'backup-send' });
        try {
            const result = await sendBackupEmail(scheduledBackup.email);
            if (result.success) {
                toast.success(`Backup sent to ${scheduledBackup.email}`, { id: 'backup-send' });
                // Reload schedule to show updated lastRun
                const val = await getSetting('scheduled_backup_config');
                if (val) setScheduledBackup(JSON.parse(val));
            } else {
                toast.error('Failed to send backup: ' + result.error, { id: 'backup-send' });
            }
        } catch (e: any) {
            toast.error('Error: ' + e.message, { id: 'backup-send' });
        } finally {
            setSendingBackup(false);
        }
    }

    const handleExport = async () => {
        try {
            setExporting(true);
            toast.info('Starting export... This may take a moment.');
            const result = await exportAllData(filter);
            if (result.success && result.data) {
                const label = companyName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
                const link = document.createElement('a');
                link.href = `data:application/zip;base64,${result.data}`;
                const filterLabel = filter.type === 'alltime' ? 'Full' : filter.type.charAt(0).toUpperCase() + filter.type.slice(1);
                link.download = `${label}-${filterLabel}-Export-${new Date().toISOString().split('T')[0]}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Export completed!');
            } else {
                toast.error('Export failed: ' + result.error);
            }
        } catch {
            toast.error('An unexpected error occurred during export.');
        } finally {
            setExporting(false);
        }
    };

    const handleDownloadTemplates = async () => {
        try {
            setGeneratingTemplates(true);
            const result = await downloadTemplates();
            if (result.success && result.data) {
                const label = companyName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
                const link = document.createElement('a');
                link.href = `data:application/zip;base64,${result.data}`;
                link.download = `${label}-Import-Templates.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Templates downloaded!');
            } else {
                toast.error('Template generation failed: ' + result.error);
            }
        } catch {
            toast.error('Error downloading templates.');
        } finally {
            setGeneratingTemplates(false);
        }
    };

    const handleVacuum = async () => {
        setVacuuming(true);
        try {
            const result = await vacuumDatabase();
            if (result.success) {
                toast.success('Database optimized successfully!');
            } else {
                toast.error('Optimization failed: ' + result.error);
            }
        } catch {
            toast.error('An error occurred during optimization.');
        } finally {
            setVacuuming(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.zip')) { toast.error('Please upload a valid ZIP file.'); return; }
        try {
            setImporting(true);
            toast.loading('Importing data... Do not close this window.', { id: 'import-toast' });
            const formData = new FormData();
            formData.append('file', file);
            const result = await importAllData(null, formData);
            if (result.success) {
                toast.success('Data imported successfully!', { id: 'import-toast' });
                setTimeout(() => window.location.reload(), 2000);
            } else {
                toast.error('Import failed: ' + result.error, { id: 'import-toast' });
            }
        } catch (error: any) {
            toast.error('Import error: ' + error.message, { id: 'import-toast' });
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function getNextScheduledTime(config: ScheduledBackup): string {
        if (!config.enabled) return 'Disabled';
        const [h, m] = (config.time || '02:00').split(':').map(Number);
        const base = config.lastRun ? new Date(config.lastRun) : new Date();
        const next = new Date(base);
        if (config.frequency === 'daily') next.setDate(next.getDate() + 1);
        else if (config.frequency === 'weekly') next.setDate(next.getDate() + 7);
        else if (config.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        next.setHours(h, m, 0, 0);
        // If never run, next is today at scheduled time (or tomorrow if already past)
        if (!config.lastRun) {
            const today = new Date();
            today.setHours(h, m, 0, 0);
            return today > new Date() ? today.toLocaleString() : new Date(today.getTime() + 86400000).toLocaleString();
        }
        return next.toLocaleString();
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Offline Sync Status */}
            {pendingOffline > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.875rem 1.25rem',
                    background: 'rgba(249,115,22,0.06)',
                    border: '1px solid rgba(249,115,22,0.25)',
                    borderRadius: 'var(--radius-lg)',
                    gap: '1rem', flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <WifiOff size={18} color="#f97316" style={{ flexShrink: 0 }} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f97316' }}>
                                {pendingOffline} offline record{pendingOffline !== 1 ? 's' : ''} pending sync
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                                These were saved while offline and need to be synced to the server
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleSyncOffline}
                        disabled={syncingOffline}
                        className="btn btn-sm"
                        style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', flexShrink: 0 }}
                    >
                        <RefreshCw size={13} style={{ animation: syncingOffline ? 'spin 1s linear infinite' : 'none' }} />
                        {syncingOffline ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            )}

            {/* Export Section */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: 32, height: 32, background: 'rgba(59,130,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Download size={16} color="var(--info)" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Export Data</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Download a ZIP backup of your system data</p>
                    </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Filter controls */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: '1 1 160px' }}>
                            <label>Export Scope</label>
                            <select className="input" value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value as any })}>
                                <option value="alltime">All Time (Full Backup)</option>
                                <option value="year">Specific Year</option>
                                <option value="month">Specific Month</option>
                                <option value="custom">Custom Date Range</option>
                            </select>
                        </div>
                        {(filter.type === 'year' || filter.type === 'month') && (
                            <div className="form-group" style={{ flex: '1 1 120px' }}>
                                <label>Year</label>
                                <select className="input" value={filter.year} onChange={e => setFilter({ ...filter, year: parseInt(e.target.value) })}>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        )}
                        {filter.type === 'month' && (
                            <div className="form-group" style={{ flex: '1 1 140px' }}>
                                <label>Month</label>
                                <select className="input" value={filter.month} onChange={e => setFilter({ ...filter, month: parseInt(e.target.value) })}>
                                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                                </select>
                            </div>
                        )}
                        {filter.type === 'custom' && (
                            <>
                                <div className="form-group" style={{ flex: '1 1 140px' }}>
                                    <label>Start Date</label>
                                    <input type="date" className="input" value={filter.startDate} onChange={e => setFilter({ ...filter, startDate: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: '1 1 140px' }}>
                                    <label>End Date</label>
                                    <input type="date" className="input" value={filter.endDate} onChange={e => setFilter({ ...filter, endDate: e.target.value })} />
                                </div>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleExport}
                            disabled={exporting || (filter.type === 'custom' && (!filter.startDate || !filter.endDate))}
                        >
                            {exporting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            {exporting ? 'Generating...' : 'Download Export ZIP'}
                        </button>
                        {exporting && <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Please wait, this may take a moment...</span>}
                    </div>
                </div>
            </div>

            {/* Import Section */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: 32, height: 32, background: 'rgba(16,185,129,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Upload size={16} color="var(--success)" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Import Data</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Bulk import using Excel templates</p>
                    </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Warning */}
                    <div className="alert alert-warning" style={{ fontSize: '0.8125rem' }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                        <span>Import will update existing records and insert new ones. Always backup your data before importing.</span>
                    </div>

                    {/* Steps */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>1</div>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Get Templates</span>
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '0.875rem', lineHeight: 1.5 }}>
                                Download blank Excel templates to fill with your data.
                            </p>
                            <button className="btn btn-secondary btn-sm" onClick={handleDownloadTemplates} disabled={generatingTemplates}>
                                {generatingTemplates ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />}
                                Download Templates
                            </button>
                        </div>

                        <div style={{ padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)' }}>2</div>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Upload Data</span>
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '0.875rem', lineHeight: 1.5 }}>
                                Upload the filled ZIP file to import all data at once.
                            </p>
                            <input type="file" accept=".zip" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                            <button className="btn btn-success btn-sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                                {importing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                {importing ? 'Importing...' : 'Select ZIP to Import'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Database Optimization Section */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={16} color="var(--accent-purple)" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Database Optimization</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Run VACUUM and ANALYZE to reclaim space and improve performance</p>
                    </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={handleVacuum} disabled={vacuuming}>
                        {vacuuming ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                        {vacuuming ? 'Optimizing...' : 'Optimize Database'}
                    </button>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                        Recommended after bulk deletions or imports.
                    </span>
                </div>
            </div>

            {/* Scheduled Backup Section */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: 32, height: 32, background: 'rgba(212,175,55,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={16} color="var(--primary)" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Scheduled Backups</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Automatically export and email backups on a schedule</p>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{scheduledBackup.enabled ? 'Enabled' : 'Disabled'}</span>
                        <div
                            onClick={() => setScheduledBackup(s => ({ ...s, enabled: !s.enabled }))}
                            style={{
                                width: 40, height: 22, borderRadius: 99,
                                background: scheduledBackup.enabled ? 'var(--primary)' : 'var(--surface-3)',
                                border: '1px solid var(--border-strong)',
                                position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: 2,
                                left: scheduledBackup.enabled ? 20 : 2,
                                width: 16, height: 16, borderRadius: '50%',
                                background: 'white', transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }} />
                        </div>
                    </label>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', opacity: scheduledBackup.enabled ? 1 : 0.5, pointerEvents: scheduledBackup.enabled ? 'auto' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Frequency</label>
                            <select className="input" value={scheduledBackup.frequency} onChange={e => setScheduledBackup(s => ({ ...s, frequency: e.target.value as any }))}>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Time</label>
                            <input type="time" className="input" value={scheduledBackup.time} onChange={e => setScheduledBackup(s => ({ ...s, time: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label>Email Backup To</label>
                            <input type="email" className="input" placeholder="admin@example.com" value={scheduledBackup.email} onChange={e => setScheduledBackup(s => ({ ...s, email: e.target.value }))} />
                        </div>
                    </div>

                    {/* Status row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                                Last Scheduled Send
                            </div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: scheduledBackup.lastRun ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                                {scheduledBackup.lastRun ? new Date(scheduledBackup.lastRun).toLocaleString() : 'Never'}
                            </div>
                        </div>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                                Next Scheduled Send
                            </div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)' }}>
                                {getNextScheduledTime(scheduledBackup)}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveSchedule} disabled={savingSchedule}>
                            {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Schedule
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleSendBackupNow}
                            disabled={sendingBackup || !scheduledBackup.email}
                            title="Send a manual backup now — does not affect the schedule timer"
                        >
                            {sendingBackup ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                            Send Backup Now
                        </button>
                        {scheduledBackup.lastManualSend && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                Last manual: {new Date(scheduledBackup.lastManualSend).toLocaleString()}
                            </span>
                        )}
                    </div>

                    {/* Send history */}
                    {scheduledBackup.history && scheduledBackup.history.length > 0 && (
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                                Recent Sends
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                {scheduledBackup.history.slice(0, 5).map((h, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.8125rem', padding: '0.375rem 0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                        <span style={{
                                            padding: '0.1rem 0.5rem', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 700,
                                            background: h.type === 'scheduled' ? 'rgba(212,175,55,0.1)' : 'rgba(59,130,246,0.1)',
                                            color: h.type === 'scheduled' ? 'var(--primary)' : 'var(--info)',
                                        }}>
                                            {h.type === 'scheduled' ? 'Auto' : 'Manual'}
                                        </span>
                                        <span style={{ color: 'var(--foreground-2)' }}>{new Date(h.sentAt).toLocaleString()}</span>
                                        <span style={{ color: 'var(--muted-foreground)', marginLeft: 'auto', fontSize: '0.75rem' }}>{h.email}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ padding: '0.75rem', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 'var(--radius)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <Bell size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} />
                        <span>
                            <strong style={{ color: 'var(--foreground)' }}>Send Backup Now</strong> sends an immediate backup without affecting the schedule.
                            The schedule timer only resets when an automatic backup runs at the configured time.
                            Requires the app to be running at the scheduled time.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
