'use client';

import { useState } from 'react';
import { updateSettings } from '@/app/actions/settings';
import { Receipt } from 'lucide-react';

export default function TaxSettings({ settings }: { settings: Record<string, string> }) {
    const [formData, setFormData] = useState({
        tax_enabled: settings.tax_enabled === 'true',
        tax_rate: settings.tax_rate || '0',
        tax_name: settings.tax_name || 'Tax',
        tax_inclusive: settings.tax_inclusive === 'true'
    });

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    async function handleSave() {
        setSaving(true);
        setMessage('');

        const settingsToUpdate = {
            tax_enabled: formData.tax_enabled.toString(),
            tax_rate: formData.tax_rate,
            tax_name: formData.tax_name,
            tax_inclusive: formData.tax_inclusive.toString()
        };

        const result = await (updateSettings as any)(settingsToUpdate);

        if (result.success) {
            setMessage('Tax settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } else {
            setMessage('Error: ' + result.error);
        }

        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Receipt size={24} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Tax Configuration</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--secondary)', borderRadius: 'var(--radius)' }}>
                <input
                    type="checkbox"
                    id="tax_enabled"
                    checked={formData.tax_enabled}
                    onChange={(e) => setFormData({ ...formData, tax_enabled: e.target.checked })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <label htmlFor="tax_enabled" style={{ fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>
                    Enable Tax
                </label>
            </div>

            {formData.tax_enabled && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label className="label">Tax Name</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.tax_name}
                                onChange={(e) => setFormData({ ...formData, tax_name: e.target.value })}
                                placeholder="Tax, VAT, GST"
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                                Display name for tax (e.g., VAT, GST, Sales Tax)
                            </div>
                        </div>

                        <div>
                            <label className="label">Tax Rate (%)</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.tax_rate}
                                onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                                placeholder="0"
                                min="0"
                                max="100"
                                step="0.01"
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                                Percentage rate (e.g., 10 for 10%)
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--secondary)', borderRadius: 'var(--radius)' }}>
                        <input
                            type="checkbox"
                            id="tax_inclusive"
                            checked={formData.tax_inclusive}
                            onChange={(e) => setFormData({ ...formData, tax_inclusive: e.target.checked })}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                            <label htmlFor="tax_inclusive" style={{ fontSize: '1rem', fontWeight: '500', cursor: 'pointer', display: 'block' }}>
                                Tax Inclusive Pricing
                            </label>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                                Product prices already include tax (tax will be calculated from total)
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1rem', background: 'var(--secondary)' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Example Calculation:</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            {formData.tax_inclusive ? (
                                <>
                                    Product Price: $100.00 (includes {formData.tax_rate}% {formData.tax_name})<br />
                                    Base Price: ${(100 / (1 + parseFloat(formData.tax_rate || '0') / 100)).toFixed(2)}<br />
                                    {formData.tax_name}: ${(100 - (100 / (1 + parseFloat(formData.tax_rate || '0') / 100))).toFixed(2)}<br />
                                    <strong>Total: $100.00</strong>
                                </>
                            ) : (
                                <>
                                    Product Price: $100.00<br />
                                    {formData.tax_name} ({formData.tax_rate}%): ${(100 * parseFloat(formData.tax_rate || '0') / 100).toFixed(2)}<br />
                                    <strong>Total: ${(100 + (100 * parseFloat(formData.tax_rate || '0') / 100)).toFixed(2)}</strong>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                {message && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius)',
                        background: message.includes('Error') ? 'var(--destructive)' : 'var(--success)',
                        color: 'white',
                        fontSize: '0.875rem'
                    }}>
                        {message}
                    </div>
                )}
                <div style={{ marginLeft: 'auto' }}>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
