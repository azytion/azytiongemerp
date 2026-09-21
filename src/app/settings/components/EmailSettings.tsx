'use client';

import { useState } from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import { updateSetting } from '@/app/actions/settings';

export default function EmailSettings({ settings, isSuperAdmin = false }: { settings: Record<string, string>; isSuperAdmin?: boolean }) {
    const [formData, setFormData] = useState({
        email_notifications: settings.email_notifications === 'true',
        low_stock_alerts: settings.low_stock_alerts === 'true',
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || '587',
        smtp_user: settings.smtp_user || '',
        smtp_pass: settings.smtp_pass || '',
        smtp_secure: settings.smtp_secure === 'true',
        email_from: settings.email_from || '"Azytion GemERP" <noreply@azytionapp.com>'
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [testing, setTesting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [showTestInput, setShowTestInput] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        setMessage('');
        try {
            const updates: [string, string][] = [
                ['email_notifications', String(formData.email_notifications)],
                ['low_stock_alerts', String(formData.low_stock_alerts)],
                ['smtp_user', formData.smtp_user],
                ['smtp_pass', formData.smtp_pass],
            ];
            // Super admin can also update host/port/from
            if (isSuperAdmin) {
                updates.push(
                    ['smtp_host', formData.smtp_host],
                    ['smtp_port', formData.smtp_port],
                    ['smtp_secure', String(formData.smtp_secure)],
                    ['email_from', formData.email_from],
                );
            }

            for (const [key, value] of updates) {
                await (updateSetting as any)(key, value, 'email');
            }

            setMessage('Settings saved successfully!');
            setTimeout(() => { setMessage(''); window.location.reload(); }, 1500);
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage('Error saving settings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ padding: '1.5rem' }}>
            <h2 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: '600' }}>
                <Mail size={24} /> Communication Settings
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Toggles */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                    <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            name="email_notifications"
                            checked={formData.email_notifications}
                            onChange={handleChange}
                        />
                        <span>Enable Email Notifications</span>
                    </label>

                    <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            name="low_stock_alerts"
                            checked={formData.low_stock_alerts}
                            onChange={handleChange}
                        />
                        <span>Low Stock Alerts</span>
                    </label>
                </div>

                <hr style={{ borderColor: 'var(--border)', margin: '0.5rem 0' }} />

                <h3 style={{ fontSize: '1rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <MessageSquare size={18} /> WhatsApp Integration
                </h3>
                <div className="card" style={{ background: 'var(--muted-background)', border: '1px solid var(--border)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: '500' }}>Direct Link Mode</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Uses WhatsApp Web/App to send receipts directly. Free to use.</div>
                    </div>
                    <span className="badge badge-success">Active</span>
                </div>

                <hr style={{ borderColor: 'var(--border)', margin: '0.5rem 0' }} />

                <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    SMTP Configuration
                </h3>

                {isSuperAdmin && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>SMTP Host</label>
                                <input
                                    type="text"
                                    name="smtp_host"
                                    className="input"
                                    placeholder="smtp.example.com"
                                    value={formData.smtp_host}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Port</label>
                                <input
                                    type="number"
                                    name="smtp_port"
                                    className="input"
                                    placeholder="587"
                                    value={formData.smtp_port}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>From Address</label>
                            <input
                                type="text"
                                name="email_from"
                                className="input"
                                placeholder='"My Store" <pos@store.com>'
                                value={formData.email_from}
                                onChange={handleChange}
                            />
                        </div>

                        <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                name="smtp_secure"
                                checked={formData.smtp_secure}
                                onChange={handleChange}
                            />
                            <span>Use Secure Connection (SSL/TLS) - typically port 465</span>
                        </label>
                    </>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label>SMTP User</label>
                        <input
                            type="text"
                            name="smtp_user"
                            className="input"
                            value={formData.smtp_user}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>SMTP Password</label>
                        <input
                            type="password"
                            name="smtp_pass"
                            className="input"
                            value={formData.smtp_pass}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={handleSave} disabled={loading} className="btn btn-primary">
                        {loading ? 'Saving...' : 'Save Settings'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowTestInput(s => !s)}
                        disabled={!formData.smtp_host}
                        title={!formData.smtp_host ? 'Configure SMTP host first' : 'Send a test email'}
                    >
                        <Mail size={14} /> Test SMTP
                    </button>
                    {showTestInput && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: 260 }}>
                            <input
                                type="email"
                                className="input"
                                placeholder="Send test to..."
                                value={testEmail}
                                onChange={e => setTestEmail(e.target.value)}
                                style={{ height: '2.25rem', flex: 1 }}
                            />
                            <button
                                type="button"
                                className="btn btn-success btn-sm"
                                disabled={testing || !testEmail}
                                onClick={async () => {
                                    if (!testEmail) return;
                                    setTesting(true);
                                    try {
                                        const { sendEmail } = await import('@/app/actions/email');
                                        const companyName = settings.company_name || 'Azytion GemERP';
                                        const companyLogo = settings.company_logo || '';
                                        const brandedHtml = `
                                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                                          <div style="background:#1a1a2e;padding:24px;text-align:center">
                                            ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="height:60px;object-fit:contain;margin-bottom:8px" />` : ''}
                                            <h1 style="color:#D4AF37;margin:0;font-size:22px">${companyName}</h1>
                                          </div>
                                          <div style="padding:32px">
                                            <p style="color:#374151;font-size:16px">Hello,</p>
                                            <p style="color:#374151">This is a test email from <strong>${companyName}</strong> POS system. Your email configuration is working correctly.</p>
                                            <p style="color:#374151">If you received this email, your SMTP settings are configured properly.</p>
                                          </div>
                                          <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
                                            <p style="color:#9ca3af;font-size:12px;margin:0">Powered By Azytion</p>
                                          </div>
                                        </div>`;
                                        const res = await sendEmail(
                                            testEmail,
                                            `${companyName} — SMTP Test`,
                                            brandedHtml
                                        );
                                        if (res.success) {
                                            setMessage('Test email sent successfully!');
                                        } else {
                                            setMessage('Test failed: ' + (res.error || 'Unknown error'));
                                        }
                                    } catch (e: any) {
                                        setMessage('Test failed: ' + e.message);
                                    } finally {
                                        setTesting(false);
                                        setShowTestInput(false);
                                        setTimeout(() => setMessage(''), 5000);
                                    }
                                }}
                            >
                                {testing ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    )}
                    {message && (
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: message.includes('Error') || message.includes('failed') ? 'var(--destructive)' : 'var(--success)' }}>
                            {message}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
