'use client';

import { useState } from 'react';
import { updateSettings } from '@/app/actions/settings';
import { toast } from 'sonner';
import { Save, ShieldAlert, Building2, Mail, Barcode, MapPin, Wallet, Award, TrendingUp, Brain } from 'lucide-react';

interface FeatureSettingsProps {
    settings: Record<string, string>;
}

// Each feature gets a distinct color
const FEATURE_COLORS: Record<string, { bg: string; color: string }> = {
    feature_company_enabled:      { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
    feature_notification_enabled: { bg: 'rgba(16,185,129,0.12)',  color: '#10B981' },
    feature_barcodes_enabled:     { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
    feature_brokers_enabled:      { bg: 'rgba(212,175,55,0.12)',  color: '#D4AF37' },
    feature_memos_enabled:        { bg: 'rgba(139,92,246,0.12)',  color: '#8B5CF6' },
    feature_certificates_enabled: { bg: 'rgba(244,63,94,0.12)',   color: '#F43F5E' },
    feature_valuation_enabled:    { bg: 'rgba(20,184,166,0.12)',  color: '#14B8A6' },
    feature_ai_enabled:           { bg: 'rgba(99,102,241,0.12)',  color: '#6366F1' },
};

export default function FeatureSettings({ settings }: FeatureSettingsProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        feature_company_enabled:      settings.feature_company_enabled      ?? 'true',
        feature_notification_enabled: settings.feature_notification_enabled ?? 'true',
        feature_barcodes_enabled:     settings.feature_barcodes_enabled     ?? 'true',
        feature_brokers_enabled:      settings.feature_brokers_enabled      ?? 'true',
        feature_memos_enabled:        settings.feature_memos_enabled        ?? 'true',
        feature_certificates_enabled: settings.feature_certificates_enabled ?? 'true',
        feature_valuation_enabled:    settings.feature_valuation_enabled    ?? 'true',
        feature_ai_enabled:           settings.feature_ai_enabled           ?? 'true',
    });

    const handleChange = (key: string, value: boolean) => {
        setFormData(prev => ({ ...prev, [key]: String(value) }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const result = await (updateSettings as any)(formData);
            if (result.success) {
                toast.success('Feature settings updated');
                setTimeout(() => window.location.reload(), 800);
            } else {
                toast.error(result.error || 'Failed to update settings');
            }
        } catch {
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { key: 'feature_company_enabled',      label: 'Company Settings',       icon: Building2,  description: 'Access to Company details tab.' },
        { key: 'feature_notification_enabled', label: 'Communication (Email)',   icon: Mail,       description: 'Access to Email/Notification settings.' },
        { key: 'feature_barcodes_enabled',     label: 'Barcodes',               icon: Barcode,    description: 'Barcode generation and settings.' },
        { key: 'feature_brokers_enabled',      label: 'Brokers',                icon: Wallet,     description: 'Brokers module and commissions tracking.' },
        { key: 'feature_memos_enabled',        label: 'Consignments (Memos)',   icon: MapPin,     description: 'Consignments/Memos module.' },
        { key: 'feature_certificates_enabled', label: 'Certificates',           icon: Award,      description: 'Certificate Tracker page.' },
        { key: 'feature_valuation_enabled',    label: 'Inventory Valuation',    icon: TrendingUp, description: 'Inventory Valuation page.' },
        { key: 'feature_ai_enabled',           label: 'AI Assistant',           icon: Brain,      description: 'AI Business Assistant.' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldAlert size={20} color="var(--primary)" />
                        Feature Management
                    </h2>
                    <p style={{ color: 'var(--muted-foreground)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                        Control which modules are visible to Admins. Disabled modules are hidden from everyone except Super Admins.
                    </p>
                </div>
                <button onClick={handleSave} disabled={loading} className="btn btn-primary" style={{ gap: '0.5rem' }}>
                    <Save size={15} />
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
                {features.map((feature) => {
                    const Icon = feature.icon;
                    const isEnabled = formData[feature.key as keyof typeof formData] === 'true';
                    const colors = FEATURE_COLORS[feature.key] || { bg: 'rgba(100,116,139,0.12)', color: 'var(--muted-foreground)' };

                    return (
                        <div key={feature.key} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: colors.bg,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Icon size={19} color={colors.color} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{feature.label}</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>{feature.description}</div>
                                </div>
                            </div>
                            <div
                                onClick={() => handleChange(feature.key, !isEnabled)}
                                style={{
                                    width: 44, height: 24, borderRadius: 99, flexShrink: 0,
                                    background: isEnabled ? 'var(--primary)' : 'var(--surface-3)',
                                    border: '1px solid var(--border-strong)',
                                    position: 'relative', cursor: 'pointer',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <div style={{
                                    position: 'absolute', top: 3,
                                    left: isEnabled ? 22 : 3,
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: 'white', transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
