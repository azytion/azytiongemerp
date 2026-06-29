'use client';

import { useState, useEffect } from 'react';
import { getDiscountRules, addDiscountRule, deleteDiscountRule, toggleDiscountRule, DiscountRule } from '@/app/actions/pos-settings';
import { updateSettings } from '@/app/actions/settings';
import { Plus, Trash2, Save, X, ToggleRight, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';

export default function POSSettings({ settings }: { settings: Record<string, string> }) {
    const [rules, setRules] = useState<DiscountRule[]>([]);
    const [_loading, setLoading] = useState(true);

    // Buffered local state
    const [localSettings, setLocalSettings] = useState({
        pos_auto_discount_enabled: settings['pos_auto_discount_enabled'] === 'true',
        pos_auto_print_enabled: settings['pos_auto_print_enabled'] === 'true',
        pos_product_images_enabled: settings['pos_product_images_enabled'] === 'true',
        pos_auto_whatsapp_enabled: settings['pos_auto_whatsapp_enabled'] === 'true',
        pos_auto_email_receipt: settings['pos_auto_email_receipt'] === 'true',
    });

    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const { confirm } = useConfirm();

    // New Rule State
    const [newRule, setNewRule] = useState<Partial<DiscountRule>>({
        min_price: 0,
        max_price: null,
        discount_type: 'fixed',
        discount_value: 0,
        is_active: true
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const data = await getDiscountRules();
        setRules(data);
        setLoading(false);
    }

    function handleLocalToggle(key: string, value: any) {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }

    async function handleBatchSave() {
        setSaving(true);
        try {
            const stringifiedSettings: Record<string, string> = {};
            Object.entries(localSettings).forEach(([key, value]) => {
                stringifiedSettings[key] = String(value);
            });

            const result = await updateSettings(stringifiedSettings);
            if (result.success) {
                toast.success('All settings saved successfully. Reloading...');
                setTimeout(() => window.location.reload(), 800);
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to save settings');
            setSaving(false);
        }
    }

    async function handleAddRule() {
        if (!newRule.min_price && newRule.min_price !== 0) return toast.error("Min price required");
        if (!newRule.discount_value) return toast.error("Discount value required");

        const result = await addDiscountRule(newRule as any); // Cast for strict TS if needed
        if (result.success) {
            toast.success("Rule added");
            setShowAddForm(false);
            setNewRule({ min_price: 0, max_price: null, discount_type: 'fixed', discount_value: 0, is_active: true });
            loadData();
        } else {
            toast.error("Failed to add rule");
        }
    }

    async function handleDeleteRule(id: number) {
        if (!await confirm({ title: 'Delete Rule', message: "Delete this rule?", type: 'danger' })) return;
        const result = await deleteDiscountRule(id);
        if (result.success) {
            toast.success("Rule deleted");
            loadData();
        }
    }

    async function handleToggleRule(rule: DiscountRule) {
        await toggleDiscountRule(rule.id, !rule.is_active);
        loadData();
    }

    const currencySymbol = settings.currency_symbol || 'LKR';

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: hasChanges ? '100px' : '2rem' }}>
            {/* Direct Printing Section */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Auto Direct Printing</h2>
                        <p style={{ color: 'var(--muted)' }}>Print bill automatically after sale</p>
                    </div>
                    <button
                        onClick={() => handleLocalToggle('pos_auto_print_enabled', !localSettings.pos_auto_print_enabled)}
                        className={`btn ${localSettings.pos_auto_print_enabled ? 'btn-primary' : 'btn-outline'}`}
                        style={{ gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}
                    >
                        {localSettings.pos_auto_print_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        {localSettings.pos_auto_print_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                </div>

                {localSettings.pos_auto_print_enabled && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted)', paddingTop: '1rem', borderTop: '1px solid var(--border)', margin: 0 }}>
                        Invoices open as A4 PDF in a new tab with the browser print dialog.
                    </p>
                )}
            </div>

            {/* Product Images Section */}
            <div className="card" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Product Images</h2>
                    <p style={{ color: 'var(--muted)' }}>Show images in POS catalog</p>
                </div>
                <button
                    onClick={() => handleLocalToggle('pos_product_images_enabled', !localSettings.pos_product_images_enabled)}
                    className={`btn ${localSettings.pos_product_images_enabled ? 'btn-primary' : 'btn-outline'}`}
                    style={{ gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}
                >
                    {localSettings.pos_product_images_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    {localSettings.pos_product_images_enabled ? 'Enabled' : 'Disabled'}
                </button>
            </div>

            {/* Auto Discount Section */}
            <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: localSettings.pos_auto_discount_enabled ? '2rem' : 0 }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>POS Auto Discounts</h2>
                        <p style={{ color: 'var(--muted)' }}>Automatically apply discounts based on product price</p>
                    </div>

                    <button
                        onClick={() => handleLocalToggle('pos_auto_discount_enabled', !localSettings.pos_auto_discount_enabled)}
                        className={`btn ${localSettings.pos_auto_discount_enabled ? 'btn-primary' : 'btn-outline'}`}
                        style={{ gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}
                    >
                        {localSettings.pos_auto_discount_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        {localSettings.pos_auto_discount_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                </div>

                {/* Conditional Discount Rules Section */}
                {localSettings.pos_auto_discount_enabled && (
                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: '600', fontSize: '1.2rem' }}>Discount Rules</h3>
                            <button onClick={() => setShowAddForm(true)} className="btn btn-sm btn-primary" disabled={showAddForm}>
                                <Plus size={16} /> Add Rule
                            </button>
                        </header>

                        {showAddForm && (
                            <div style={{ background: 'var(--secondary)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end', border: '1px solid var(--primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Min Price ({currencySymbol})</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={newRule.min_price}
                                        onChange={e => setNewRule({ ...newRule, min_price: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Max Price (Optional)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Unlimited"
                                        value={newRule.max_price || ''}
                                        onChange={e => setNewRule({ ...newRule, max_price: e.target.value ? Number(e.target.value) : null })}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Discount Type</label>
                                    <select
                                        className="input"
                                        value={newRule.discount_type}
                                        onChange={e => setNewRule({ ...newRule, discount_type: e.target.value as any })}
                                    >
                                        <option value="fixed">Fixed Amount</option>
                                        <option value="percentage">Percentage (%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Value {newRule.discount_type === 'percentage' ? '(%)' : `(${currencySymbol})`}</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={newRule.discount_value}
                                        onChange={e => setNewRule({ ...newRule, discount_value: Number(e.target.value) })}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={handleAddRule} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                                    <button onClick={() => setShowAddForm(false)} className="btn btn-outline" style={{ padding: '0.5rem' }}><X size={18} /></button>
                                </div>
                            </div>
                        )}

                        <div className="table-wrapper" style={{ background: 'var(--surface)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '1rem' }}>Price Range ({currencySymbol})</th>
                                        <th style={{ padding: '1rem' }}>Discount</th>
                                        <th style={{ padding: '1rem' }}>Status</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                                                No rules defined.
                                            </td>
                                        </tr>
                                    ) : (
                                        rules.map(rule => (
                                            <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    {rule.min_price} {rule.max_price ? `- ${rule.max_price}` : '+'}
                                                </td>
                                                <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                    {rule.discount_type === 'fixed' ? `${currencySymbol}${rule.discount_value}` : `${rule.discount_value}%`}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <button
                                                        onClick={() => handleToggleRule(rule)}
                                                        style={{
                                                            background: rule.is_active ? 'var(--success-bg)' : 'var(--secondary)',
                                                            color: rule.is_active ? 'var(--success)' : 'var(--muted)',
                                                            border: '1px solid ' + (rule.is_active ? 'var(--success)' : 'var(--border)'),
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {rule.is_active ? 'Active' : 'Inactive'}
                                                    </button>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <button onClick={() => handleDeleteRule(rule.id)} className="btn btn-sm btn-destructive" style={{ padding: '0.4rem' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Save Bar */}
            {hasChanges && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--surface)',
                    border: '1px solid var(--primary)',
                    borderRadius: '1rem',
                    padding: '1rem 2rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2rem',
                    zIndex: 99999,
                    animation: 'slideUpFade 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Unsaved Changes</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>You have modified POS settings</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => {
                                setLocalSettings({
                                    pos_auto_discount_enabled: settings['pos_auto_discount_enabled'] === 'true',
                                    pos_auto_print_enabled: settings['pos_auto_print_enabled'] === 'true',
                                    pos_product_images_enabled: settings['pos_product_images_enabled'] === 'true',
                                    pos_auto_whatsapp_enabled: settings['pos_auto_whatsapp_enabled'] === 'true',
                                    pos_auto_email_receipt: settings['pos_auto_email_receipt'] === 'true',
                                });
                                setHasChanges(false);
                            }}
                            className="btn btn-outline"
                            disabled={saving}
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleBatchSave}
                            className="btn btn-primary"
                            disabled={saving}
                            style={{ minWidth: '120px' }}
                        >
                            {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
