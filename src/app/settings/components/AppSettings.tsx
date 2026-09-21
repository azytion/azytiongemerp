'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useRef } from 'react';
import { updateSettings } from '@/app/actions/settings';
import { uploadAppImage } from '@/app/actions/upload';
import { toast } from 'sonner';
import {
    AppWindow, Save, Upload, X, Loader2, Phone, Globe,
    Mail, Copyright, Image as ImageIcon, Type, AlignLeft, RefreshCw,
} from 'lucide-react';

interface AppSettingsProps {
    settings: Record<string, string>;
}

type LogoSlot = 'brand_logo' | 'icon';

function normalizeAppImageUrl(value: string) {
    return value.replace(/^\/uploads\/app\//, '/api/uploads/app/');
}

const LOGO_SLOTS: { slot: LogoSlot; settingKey: string; label: string; hint: string; size: string }[] = [
    { slot: 'brand_logo', settingKey: 'app_logo_login', label: 'Login, Sidebar & Preload Logo', hint: 'Used on the login page, sidebar and app preload screen', size: '96×96 px' },
    { slot: 'icon',       settingKey: 'app_icon',       label: 'App & Browser Tab Icon',         hint: 'Used as the app icon, favicon and browser tab icon',     size: '64×64 px' },
];

export default function AppSettings({ settings }: AppSettingsProps) {
    const [saving, setSaving] = useState(false);
    const [uploadingSlot, setUploadingSlot] = useState<LogoSlot | null>(null);
    const fileRefs: Record<LogoSlot, React.RefObject<HTMLInputElement | null>> = {
        brand_logo:   useRef<HTMLInputElement>(null),
        icon:         useRef<HTMLInputElement>(null),
    };

    const [form, setForm] = useState({
        app_name:           settings.app_name           || 'Azytion GemERP',
        app_tagline:        settings.app_tagline        || 'GEMSTONE INDUSTRY ERP',
        app_description:    settings.app_description    || '',
        app_owner_phone:    settings.app_owner_phone    || '',
        app_owner_phone_2:  settings.app_owner_phone_2  || '',
        app_owner_email:    settings.app_owner_email    || '',
        app_owner_website:  settings.app_owner_website  || '',
        app_copyright:      settings.app_copyright      || '',
        // logo keys — stored as URLs
        app_icon:           normalizeAppImageUrl(settings.app_icon || ''),
        app_logo_sidebar:   settings.app_logo_sidebar   || '',
        app_logo_login:     normalizeAppImageUrl(settings.app_logo_login || settings.app_logo_sidebar || settings.app_logo_light || ''),
        app_logo_light:     settings.app_logo_light     || '',
    });

    /* ── Logo upload ───────────────────────────────────────────────────────── */
    async function handleLogoUpload(slot: LogoSlot, file: File) {
        setUploadingSlot(slot);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const uploadSlot = slot === 'brand_logo' ? 'logo_login' : slot;
            const res = await uploadAppImage(fd, uploadSlot);
            if (!res.success) { toast.error(res.error || 'Upload failed'); return; }

            const key = LOGO_SLOTS.find(s => s.slot === slot)!.settingKey;
            // Save the new URL into form state and immediately persist it
            const newUrl = res.imageUrl!;
            const linkedUpdates = slot === 'brand_logo'
                ? { app_logo_login: newUrl, app_logo_sidebar: newUrl, app_logo_light: newUrl }
                : { [key]: newUrl };
            setForm(prev => ({ ...prev, ...linkedUpdates }));

            const saveRes = await (updateSettings as any)(linkedUpdates);
            if (saveRes.success) {
                toast.success(`${LOGO_SLOTS.find(s => s.slot === slot)!.label} updated`);
            } else {
                toast.error(saveRes.error || 'Failed to save logo URL');
            }
        } catch {
            toast.error('Upload error');
        } finally {
            setUploadingSlot(null);
        }
    }

    async function handleRemoveLogo(slot: LogoSlot) {
        const key = LOGO_SLOTS.find(s => s.slot === slot)!.settingKey;
        const linkedUpdates = slot === 'brand_logo'
            ? { app_logo_login: '', app_logo_sidebar: '', app_logo_light: '' }
            : { [key]: '' };
        setForm(prev => ({ ...prev, ...linkedUpdates }));
        const res = await (updateSettings as any)(linkedUpdates);
        if (res.success) toast.success('Logo removed');
        else toast.error(res.error || 'Failed to remove logo');
    }

    /* ── Save text fields ─────────────────────────────────────────────────── */
    async function handleSave() {
        setSaving(true);
        try {
            const payload = {
                app_name:          form.app_name.trim(),
                app_tagline:       form.app_tagline.trim(),
                app_description:   form.app_description.trim(),
                app_owner_phone:   form.app_owner_phone.trim(),
                app_owner_phone_2: form.app_owner_phone_2.trim(),
                app_owner_email:   form.app_owner_email.trim(),
                app_owner_website: form.app_owner_website.trim(),
                app_copyright:     form.app_copyright.trim(),
            };
            const res = await (updateSettings as any)(payload);
            if (res.success) {
                toast.success('App settings saved — reload to see changes across the app');
            } else {
                toast.error(res.error || 'Failed to save');
            }
        } catch {
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    }

    /* ── Helpers ──────────────────────────────────────────────────────────── */
    const field = (
        key: keyof typeof form,
        label: string,
        icon: React.ReactNode,
        opts?: { placeholder?: string; type?: string; multiline?: boolean }
    ) => (
        <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {icon} {label}
            </label>
            {opts?.multiline ? (
                <textarea
                    className="input"
                    value={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={opts.placeholder}
                    rows={3}
                    style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                />
            ) : (
                <input
                    className="input"
                    type={opts?.type || 'text'}
                    value={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={opts?.placeholder}
                />
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <AppWindow size={22} color="var(--primary)" />
                    <div>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>App Settings</h2>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0 }}>
                            Control the app name, branding, logos and owner contact details shown throughout the application.
                        </p>
                    </div>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120 }}
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>

            {/* ── Section 1: Identity ─────────────────────────────────────────── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <Type size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>App Identity</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {field('app_name',        'App Name',        <Type size={14} />,      { placeholder: 'e.g. Azytion GemERP' })}
                    {field('app_tagline',     'Tagline',         <AlignLeft size={14} />, { placeholder: 'e.g. GEMSTONE INDUSTRY ERP' })}
                </div>
                {field('app_description', 'App Description', <AlignLeft size={14} />, {
                    placeholder: 'Short description shown on the login page…',
                    multiline: true,
                })}
            </section>

            {/* ── Section 2: Logos & Icons ────────────────────────────────────── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <ImageIcon size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Logos &amp; Icons</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginLeft: '0.25rem' }}>PNG, JPG, WebP or SVG · max 2 MB</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    {LOGO_SLOTS.map(({ slot, settingKey, label, hint, size }) => {
                        const currentUrl = form[settingKey as keyof typeof form] as string;
                        const isUploading = uploadingSlot === slot;
                        return (
                            <div key={slot} style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '1rem',
                                display: 'flex', flexDirection: 'column', gap: '0.75rem',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{hint}</div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>Recommended: {size}</div>
                                </div>

                                {/* Preview */}
                                <div style={{
                                    height: 80, borderRadius: 8,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px dashed var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    {currentUrl ? (
                                        <img src={currentUrl} alt={label} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>
                                            <ImageIcon size={20} style={{ opacity: 0.35 }} />
                                            <div style={{ fontSize: '0.6875rem', marginTop: 4 }}>No image set</div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-sm"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
                                        disabled={isUploading}
                                        onClick={() => fileRefs[slot].current?.click()}
                                    >
                                        {isUploading
                                            ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                                            : <><Upload size={13} /> Upload</>
                                        }
                                    </button>
                                    {currentUrl && (
                                        <button
                                            className="btn btn-sm"
                                            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--destructive)' }}
                                            onClick={() => handleRemoveLogo(slot)}
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* Hidden file input */}
                                <input
                                    ref={fileRefs[slot]}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) handleLogoUpload(slot, f);
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Fallback note */}
                <div style={{ marginTop: '0.875rem', padding: '0.75rem 1rem', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <RefreshCw size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--primary)' }} />
                    When a slot is empty the app falls back to the default image files in <code style={{ background: 'rgba(255,255,255,0.07)', padding: '0 4px', borderRadius: 4 }}>/public/</code>.
                    Upload a new image to override it without touching the file system.
                </div>
            </section>

            {/* ── Section 3: Owner Contact Details ────────────────────────────── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <Phone size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Owner / SaaS Contact Details</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {field('app_owner_phone',   'Primary Phone',   <Phone size={14} />,  { placeholder: '+94 75 272 3544' })}
                    {field('app_owner_phone_2', 'Secondary Phone', <Phone size={14} />,  { placeholder: '+94 75 533 1445' })}
                    {field('app_owner_email',   'Email',           <Mail size={14} />,   { placeholder: 'azytionlk@gmail.com', type: 'email' })}
                    {field('app_owner_website', 'Website',         <Globe size={14} />,  { placeholder: 'www.azytion.com' })}
                </div>
            </section>

            {/* ── Section 4: Copyright ────────────────────────────────────────── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <Copyright size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Copyright</span>
                </div>
                {field('app_copyright', 'Copyright Text', <Copyright size={14} />, {
                    placeholder: '© 2026 Azytion GemERP. All rights reserved.',
                })}
                <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                    Shown at the bottom of the login page.
                </p>
            </section>

            {/* Save button (bottom) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 140 }}
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? 'Saving…' : 'Save All Changes'}
                </button>
            </div>
        </div>
    );
}
