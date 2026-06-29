'use client';

import { useState } from 'react';
import { updateSettings } from '@/app/actions/settings';
import { restoreDatabase, resetSystem } from '@/app/actions/system';
import { Settings as SettingsIcon, Database, Download, Upload, AlertTriangle, Clock, Banknote, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { currencies } from '@/lib/currencies';
import InputModal from '@/components/ui/InputModal';
import { ExchangeRate, parseExchangeRates } from '@/lib/exchange-rates';

export default function SystemSettings({ settings }: { settings: Record<string, string> }) {
    const [formData, setFormData] = useState({
        // Regional
        country: settings.country || 'United States',
        timezone: settings.timezone || 'UTC',
        // Currency
        currency_code: settings.currency_code || 'USD',
        exchange_rates_enabled: settings.exchange_rates_enabled || 'false',
        exchange_display_currency: settings.exchange_display_currency || '',
        // currency_symbol is deprecated but we keep it for now or derive it
        // Formats
        date_format: settings.date_format || 'MM/DD/YYYY',
        time_format: settings.time_format || '12h',
        // Inventory
        low_stock_threshold: settings.low_stock_threshold || '10'
    });

    const [saving, setSaving] = useState(false);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>(() => parseExchangeRates(settings.exchange_rates));
    const [restoring, setRestoring] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [_message, setMessage] = useState('');
    const { confirm } = useConfirm();

    // Helper to get currency details
    const selectedCurrency = currencies.find(c => c.code === formData.currency_code) || currencies[0];
    const availableExchangeCurrencies = currencies.filter(c => c.code !== formData.currency_code);
    const enabledRates = exchangeRates.filter(rate => rate.enabled && rate.code !== formData.currency_code);

    function updateExchangeRate(index: number, patch: Partial<ExchangeRate>) {
        setExchangeRates(prev => prev.map((rate, i) => i === index ? { ...rate, ...patch, updatedAt: new Date().toISOString() } : rate));
    }

    function addExchangeRate() {
        const used = new Set(exchangeRates.map(rate => rate.code));
        const next = availableExchangeCurrencies.find(c => !used.has(c.code)) || availableExchangeCurrencies[0];
        if (!next) return;
        setExchangeRates(prev => [...prev, { code: next.code, targetAmount: 1, baseAmount: 1, enabled: true, updatedAt: new Date().toISOString() }]);
        if (!formData.exchange_display_currency) {
            setFormData(prev => ({ ...prev, exchange_display_currency: next.code, exchange_rates_enabled: 'true' }));
        }
    }

    function removeExchangeRate(index: number) {
        const removed = exchangeRates[index];
        setExchangeRates(prev => prev.filter((_, i) => i !== index));
        if (removed?.code === formData.exchange_display_currency) {
            const next = exchangeRates.find((rate, i) => i !== index && rate.enabled)?.code || '';
            setFormData(prev => ({ ...prev, exchange_display_currency: next }));
        }
    }

    async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!await confirm({
            title: 'Restore Database',
            message: 'Are you sure? This will overwrite the current database. A backup of the current data will be created automatically before restoring.',
            confirmText: 'Restore Database',
            type: 'danger'
        })) {
            e.target.value = '';
            return;
        }

        setRestoring(true);
        const formData = new FormData();
        formData.append('file', file);

        const result = await restoreDatabase(formData);
        if (result.success) {
            toast.success('Database restored successfully! Reloading...');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            toast.error(`Restore failed: ${result.error}`);
        }
        setRestoring(false);
        e.target.value = '';
    }

    async function handleSave() {
        setSaving(true);
        setMessage('');

        // We also save the symbol for backward compatibility or easy access
        const dataToSave = {
            ...formData,
            currency_symbol: selectedCurrency.symbol,
            exchange_rates: JSON.stringify(
                exchangeRates
                    .filter(rate =>
                        rate.code &&
                        rate.code !== formData.currency_code &&
                        Number(rate.targetAmount) > 0 &&
                        Number(rate.baseAmount) > 0
                    )
                    .map(rate => ({
                        code: rate.code,
                        targetAmount: Number(rate.targetAmount),
                        baseAmount: Number(rate.baseAmount),
                        enabled: rate.enabled !== false,
                        updatedAt: rate.updatedAt || new Date().toISOString(),
                    }))
            )
        };

        const result = await (updateSettings as any)(dataToSave);

        if (result.success) {
            setMessage('System settings saved successfully! Reloading...');
            toast.success('Settings saved');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            setMessage('Error: ' + result.error);
            toast.error(result.error);
        }

        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    }

    async function handleResetInitiate() {
        if (!await confirm({
            title: 'RESET SYSTEM',
            message: 'WARNING: This will delete ALL data in the system including products, sales, customers, and users. This action cannot be undone. Are you absolutely sure?',
            confirmText: 'Yes, Reset Everything',
            type: 'danger'
        })) return;

        setShowResetModal(true);
    }

    async function handleResetConfirm(userInput: string) {
        const finalWord = 'RESET';
        if (userInput !== finalWord) {
            toast.error('Reset cancelled: Confirmation text did not match.');
            return;
        }

        setResetting(true);
        const result = await resetSystem();
        if (result.success) {
            toast.success('System reset successful! Logging out...');
            const { logout } = await import('@/app/actions/auth');
            await logout();
            setTimeout(() => window.location.href = '/login', 1000);
        } else {
            toast.error(`Reset failed: ${result.error}`);
        }
        setResetting(false);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <SettingsIcon size={24} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>System Preferences</h2>
            </div>



            {/* Currency Settings Section */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <Banknote size={20} className="text-primary" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Currency</h3>
                </div>

                <div>
                    <label className="label">Currency Code</label>
                    <select
                        className="input"
                        value={formData.currency_code}
                        onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                        style={{ fontFamily: 'monospace' }}
                    >
                        {currencies.map(c => (
                            <option key={c.code} value={c.code}>
                                {c.code} - {c.name} ({c.symbol})
                            </option>
                        ))}
                    </select>
                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--background-alt)', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                        <strong>Preview:</strong> {selectedCurrency.code} 1,234.56
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={formData.exchange_rates_enabled === 'true'}
                            onChange={(e) => setFormData({ ...formData, exchange_rates_enabled: e.target.checked ? 'true' : 'false' })}
                            style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontWeight: 700 }}>Enable exchange-rate display</span>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
                        <div>
                            <label className="label">Default Display Currency</label>
                            <select
                                className="input"
                                value={formData.exchange_display_currency}
                                onChange={(e) => setFormData({ ...formData, exchange_display_currency: e.target.value })}
                                disabled={formData.exchange_rates_enabled !== 'true'}
                            >
                                <option value="">No secondary currency</option>
                                {enabledRates.map(rate => {
                                    const currency = currencies.find(c => c.code === rate.code);
                                    return <option key={rate.code} value={rate.code}>{rate.code} - {currency?.name || rate.code}</option>;
                                })}
                            </select>
                        </div>
                        <div style={{ padding: '0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>How rates work</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--foreground-2)' }}>
                                Enter the actual pair you use at the counter. Example: if your app currency is LKR and 1 USD = 300 LKR, choose USD, set secondary amount to 1, and {formData.currency_code} amount to 300.
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {exchangeRates.length === 0 ? (
                            <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                No exchange rates added yet.
                            </div>
                        ) : exchangeRates.map((rate, index) => {
                            const currency = currencies.find(c => c.code === rate.code);
                            return (
                                <div key={`${rate.code}-${index}`} className="exchange-rate-row">
                                    <div className="exchange-rate-row__currency">
                                        <div className="exchange-rate-row__code">{rate.code}</div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <label className="label">Currency</label>
                                            <select
                                                className="input"
                                                value={rate.code}
                                                onChange={(e) => updateExchangeRate(index, { code: e.target.value.toUpperCase() })}
                                            >
                                                {availableExchangeCurrencies.map(c => (
                                                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                                ))}
                                            </select>
                                            <div className="exchange-rate-row__name">{currency?.name || rate.code}</div>
                                        </div>
                                    </div>

                                    <div className="exchange-rate-row__pair">
                                        <div>
                                            <label className="label">Secondary Amount</label>
                                            <input
                                                type="number"
                                                className="input"
                                                min="0"
                                                step="0.000001"
                                                value={rate.targetAmount}
                                                onChange={(e) => updateExchangeRate(index, { targetAmount: Number(e.target.value) })}
                                                placeholder="1.000000"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">{formData.currency_code} Amount</label>
                                            <input
                                                type="number"
                                                className="input"
                                                min="0"
                                                step="0.000001"
                                                value={rate.baseAmount}
                                                onChange={(e) => updateExchangeRate(index, { baseAmount: Number(e.target.value) })}
                                                placeholder="1.000000"
                                            />
                                        </div>
                                        <div className="exchange-rate-row__formula">
                                            {rate.targetAmount || 0} {rate.code} = {selectedCurrency.symbol} {rate.baseAmount || 0}
                                            {rate.baseAmount > 0 && rate.targetAmount > 0 ? ` / 1 ${formData.currency_code} = ${((rate.targetAmount || 0) / (rate.baseAmount || 1)).toFixed(6)} ${rate.code}` : ''}
                                        </div>
                                    </div>

                                    <div className="exchange-rate-row__actions">
                                        <label className="exchange-rate-toggle">
                                            <input
                                                type="checkbox"
                                                checked={rate.enabled}
                                                onChange={(e) => updateExchangeRate(index, { enabled: e.target.checked })}
                                            />
                                            <span>{rate.enabled ? 'Active' : 'Inactive'}</span>
                                        </label>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeExchangeRate(index)} style={{ color: 'var(--destructive)', minHeight: '2.5rem' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <button type="button" className="btn btn-outline btn-sm" onClick={addExchangeRate}>
                            <Plus size={14} /> Add Exchange Rate
                        </button>
                    </div>
                </div>
            </div>

            {/* Formats Section */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <Clock size={20} className="text-primary" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Formats</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    <div>
                        <label className="label">Date Format</label>
                        <select
                            className="input"
                            value={formData.date_format}
                            onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}
                        >
                            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                            <option value="DD MMM YYYY">DD MMM YYYY (31 Dec 2024)</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Time Format</label>
                        <select
                            className="input"
                            value={formData.time_format}
                            onChange={(e) => setFormData({ ...formData, time_format: e.target.value })}
                        >
                            <option value="12h">12-hour (3:30 PM)</option>
                            <option value="24h">24-hour (15:30)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Inventory Section */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <AlertTriangle size={20} className="text-primary" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Inventory Alerts</h3>
                </div>

                <div>
                    <label className="label">Low Stock Threshold</label>
                    <input
                        type="number"
                        className="input"
                        value={formData.low_stock_threshold}
                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                        placeholder="10"
                        min="0"
                        style={{ maxWidth: '200px' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                        Products with stock below this value will show low stock alerts
                    </div>
                </div>
            </div>

            {/* Data Management Section */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <Database size={20} className="text-primary" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Data Management</h3>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Download size={20} className="text-primary" />
                            <h4 style={{ fontWeight: 600 }}>Backup Database</h4>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            Download a copy of your database for safekeeping.
                        </p>
                        <a
                            href="/api/backup"
                            download
                            className="btn btn-outline"
                            style={{ textAlign: 'center', justifyContent: 'center' }}
                        >
                            <Download size={16} /> Download Backup
                        </a>
                    </div>

                    <div style={{ flex: 1, minWidth: '250px', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={20} className="text-destructive" />
                            <h4 style={{ fontWeight: 600 }}>Restore Database</h4>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            Restore from a MySQL backup (.sql). For Excel/ZIP exports, use Data Management → Import.
                        </p>
                        <label className="btn btn-destructive" style={{ cursor: 'pointer', textAlign: 'center', justifyContent: 'center' }}>
                            {restoring ? 'Restoring...' : (
                                <>
                                    <Upload size={16} /> Upload & Restore
                                </>
                            )}
                            <input
                                type="file"
                                accept=".sql"
                                hidden
                                onChange={handleRestore}
                                disabled={restoring}
                            />
                        </label>
                    </div>

                    <div style={{ flex: 1, minWidth: '250px', padding: '1rem', border: '1px solid var(--destructive)', borderRadius: 'var(--radius)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={20} className="text-destructive" />
                            <h4 style={{ fontWeight: 600, color: 'var(--destructive)' }}>Factory Reset</h4>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            Completely wipe all data and reset the system.
                            <strong style={{ display: 'block', color: 'var(--destructive)', marginTop: '0.5rem' }}>
                                This action is permanent.
                            </strong>
                        </p>
                        <button
                            onClick={handleResetInitiate}
                            disabled={resetting}
                            className="btn btn-destructive"
                            style={{ justifyContent: 'center' }}
                        >
                            {resetting ? 'Resetting...' : 'Reset Entire System'}
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ minWidth: '150px' }}
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <InputModal
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                onConfirm={handleResetConfirm}
                title="System Reset Confirmation"
                description={`Please type "RESET" below to confirm this destructive action.`}
                placeholder="Type RESET here"
                confirmLabel="Confirm Reset"
            />
        </div>
    );
}
