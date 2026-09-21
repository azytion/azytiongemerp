'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { updateSettings } from '@/app/actions/settings';
import { uploadCompanyLogo } from '@/app/actions/upload';
import { Building2 } from 'lucide-react';
import ReceiptPreview from './ReceiptPreview';
import { useSidebar } from '@/components/SidebarProvider';

export default function CompanySettings({ settings, isSuperAdmin }: { settings: Record<string, string>; isSuperAdmin?: boolean }) {
    const { isMobile } = useSidebar();
    const [formData, setFormData] = useState({
        company_name: settings.company_name || '',
        company_address: settings.company_address || '',
        company_phone: settings.company_phone || '',
        company_phone_2: settings.company_phone_2 || '',
        company_email: settings.company_email || '',
        company_website: settings.company_website || '',
        company_tax_id: settings.company_tax_id || '',
        company_logo: settings.company_logo || '',
        receipt_footer: settings.receipt_footer || 'Thank you for shopping!',
        receipt_promotional_footer: settings.receipt_promotional_footer || ''
    });

    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [message, setMessage] = useState('');

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        setMessage('');
        try {
            const uploadData = new FormData();
            uploadData.append('file', file);
            const result = await uploadCompanyLogo(uploadData);
            if (!result.success || !result.imageUrl) {
                setMessage(`Error: ${result.error || 'Failed to upload company logo'}`);
                return;
            }
            setFormData(current => ({ ...current, company_logo: result.imageUrl }));
        } catch {
            setMessage('Error: Failed to upload company logo');
        } finally {
            setUploadingLogo(false);
            e.target.value = '';
        }
    }

    function handleRemoveLogo() {
        setFormData({ ...formData, company_logo: '' });
    }

    async function handleSave() {
        setSaving(true);
        setMessage('');

        const result = await (updateSettings as any)(formData);

        if (result.success) {
            setMessage('Company settings saved successfully! Reloading...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            setMessage('Error: ' + result.error);
        }

        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Building2 size={24} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Company Information</h2>
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '1fr auto', 
                gap: '2rem', 
                alignItems: 'start' 
            }}>
                {/* Left: Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
                    gap: '1.5rem' 
                }}>
                <div>
                    <label className="label">Company Name *</label>
                    <input
                        type="text"
                        className="input"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="Azytion GemERP"
                    />
                </div>

                <div>
                    <label className="label">Tax ID / Registration Number</label>
                    <input
                        type="text"
                        className="input"
                        value={formData.company_tax_id}
                        onChange={(e) => setFormData({ ...formData, company_tax_id: e.target.value })}
                        placeholder="TAX-123456789"
                    />
                </div>
            </div>

            <div>
                <label className="label">Company Logo</label>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', alignItems: isMobile ? 'flex-start' : 'center' }}>
                    {formData.company_logo && (
                        <div style={{ position: 'relative' }}>
                            <img
                                src={formData.company_logo}
                                alt="Logo Preview"
                                style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1px solid var(--border)', padding: '0.25rem', background: 'white' }}
                            />
                            <button
                                onClick={handleRemoveLogo}
                                style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    background: 'var(--destructive)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Remove Logo"
                            >
                                ×
                            </button>
                        </div>
                    )}
                    <div style={{ flex: 1, width: '100%' }}>
                        <input
                            type="file"
                            accept="image/*"
                            className="input"
                            onChange={handleLogoUpload}
                            disabled={uploadingLogo}
                            style={{ padding: '0.5rem', width: '100%' }}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                            Recommended: Square PNG or JPG. Use &quot;×&quot; to remove.
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <label className="label">Address</label>
                <textarea
                    className="input"
                    value={formData.company_address}
                    onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                    placeholder="123 Business Street, City, State 12345"
                    rows={3}
                    style={{ resize: 'vertical' }}
                />
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
                gap: '1.5rem' 
            }}>
                <div>
                    <label className="label">Phone 1</label>
                    <input
                        type="tel"
                        className="input"
                        value={formData.company_phone}
                        onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                    />
                </div>
                <div>
                    <label className="label">Phone 2 (Optional)</label>
                    <input
                        type="tel"
                        className="input"
                        value={formData.company_phone_2}
                        onChange={(e) => setFormData({ ...formData, company_phone_2: e.target.value })}
                        placeholder="+1 (555) 987-6543"
                    />
                </div>
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
                gap: '1.5rem' 
            }}>
                <div>
                    <label className="label">Email</label>
                    <input
                        type="email"
                        className="input"
                        value={formData.company_email}
                        onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                        placeholder="info@company.com"
                    />
                </div>

                <div>
                    <label className="label">Website</label>
                    <input
                        type="url"
                        className="input"
                        value={formData.company_website}
                        onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                        placeholder="www.company.com"
                    />
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Receipt Settings</h3>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div>
                        <label className="label">Thank You Message</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.receipt_footer}
                            onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                            placeholder="Thank you for shopping!"
                        />
                    </div>

                    {isSuperAdmin && (
                        <div>
                            <label className="label">Promotional Footer <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginLeft: '0.4rem' }}>Super Admin only</span></label>
                            <input
                                type="text"
                                className="input"
                                value={formData.receipt_promotional_footer}
                                onChange={(e) => setFormData({ ...formData, receipt_promotional_footer: e.target.value })}
                                placeholder="POS powered by Azytion"
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                                Displayed below the thank you message on receipts
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
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
                <div style={{ marginLeft: isMobile ? '0' : 'auto' }}>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary"
                        style={{ width: isMobile ? '100%' : 'auto' }}
                        disabled={saving || uploadingLogo}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
                </div>{/* end left form */}

                {/* Right: Receipt Preview */}
                <div style={{ position: isMobile ? 'static' : 'sticky', top: '1rem', width: isMobile ? '100%' : 'auto' }}>
                    <ReceiptPreview settings={{ ...settings, ...formData }} />
                </div>
            </div>
        </div>
    );
}
