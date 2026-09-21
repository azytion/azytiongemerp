'use client';

/* eslint-disable @next/next/no-img-element */
import { login } from '@/app/actions/auth';
import { useState, useEffect } from 'react';
import { Phone, Globe, Mail, ShieldCheck, Gem, FileCheck, Loader2, Zap, Award, BarChart3, Eye, EyeOff } from 'lucide-react';

interface AppBranding {
    app_name: string;
    app_tagline: string;
    app_description: string;
    app_icon: string;
    app_logo_login: string;
    app_owner_phone: string;
    app_owner_phone_2: string;
    app_owner_email: string;
    app_owner_website: string;
    app_copyright: string;
}

const DEFAULT_BRANDING: AppBranding = {
    app_name:          'Azytion GemERP',
    app_tagline:       'GEMSTONE INDUSTRY ERP',
    app_description:   'The definitive platform for managing high-value gemstone inventory, consignment memos, and lab certificates with uncompromising precision.',
    app_icon:          '',
    app_logo_login:    '',
    app_owner_phone:   '+94 75 272 3544',
    app_owner_phone_2: '+94 75 533 1445',
    app_owner_email:   'azytionlk@gmail.com',
    app_owner_website: 'www.azytion.com',
    app_copyright:     '© 2026 Azytion GemERP. All rights reserved.',
};

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [branding, setBranding] = useState<AppBranding>(DEFAULT_BRANDING);

    useEffect(() => {
        // Restore remember-me preference from localStorage
        const saved = localStorage.getItem('azytion_remember_me');
        if (saved === 'true') setRememberMe(true);
    }, []);

    // Fetch app branding settings
    useEffect(() => {
        fetch('/api/settings/app')
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) {
                    setBranding(prev => ({
                        ...prev,
                        ...(d.app_name          && { app_name:          d.app_name }),
                        ...(d.app_tagline       && { app_tagline:       d.app_tagline }),
                        ...(d.app_description   && { app_description:   d.app_description }),
                        ...(d.app_icon          !== undefined && { app_icon:       d.app_icon }),
                        ...(d.app_logo_login    !== undefined && { app_logo_login: d.app_logo_login }),
                        ...(d.app_owner_phone   && { app_owner_phone:   d.app_owner_phone }),
                        ...(d.app_owner_phone_2 !== undefined && { app_owner_phone_2: d.app_owner_phone_2 }),
                        ...(d.app_owner_email   && { app_owner_email:   d.app_owner_email }),
                        ...(d.app_owner_website && { app_owner_website: d.app_owner_website }),
                        ...(d.app_copyright     && { app_copyright:     d.app_copyright }),
                    }));
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        let cancelled = false;
        const timeoutId = setTimeout(() => { if (!cancelled) setChecking(false); }, 8000);

        async function checkSession() {
            try {
                const res = await fetch('/api/auth/check', { cache: 'no-store' });
                if (cancelled) return;
                const json = await res.json();
                if (json.isValid) {
                    window.location.href = json.role === 'super_admin' ? '/super-admin' : '/';
                } else {
                    setChecking(false);
                }
            } catch {
                if (!cancelled) setChecking(false);
            } finally {
                if (!cancelled) clearTimeout(timeoutId);
            }
        }

        checkSession();
        return () => { cancelled = true; clearTimeout(timeoutId); };
    }, []);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError('');
        try {
            // Persist remember-me preference
            localStorage.setItem('azytion_remember_me', rememberMe ? 'true' : 'false');
            formData.append('rememberMe', rememberMe ? 'true' : 'false');

            const result = await login(formData);
            if (result.success) {
                if (rememberMe) {
                    // Persistent session — store flag in localStorage so it survives browser close
                    localStorage.setItem('azytion_pos_session_active', 'true');
                } else {
                    // Session-only — use sessionStorage so it clears when browser/tab closes
                    sessionStorage.setItem('azytion_pos_session_active', 'true');
                    localStorage.removeItem('azytion_pos_session_active');
                }
                const dest = result.role === 'super_admin' ? '/super-admin' : '/';
                window.location.href = dest;
            } else {
                setError(result.error || 'Login failed');
                setLoading(false);
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    }

    if (checking) {
        return (
            <div style={{
                height: '100vh', width: '100vw',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--background)', gap: '1.25rem',
                position: 'fixed', inset: 0,
            }}>
                <div style={{
                    width: 72, height: 72,
                    background: 'var(--primary-subtle)',
                    border: '2px solid rgba(212,175,55,0.3)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'var(--shadow-gold)',
                    animation: 'pulse 2s ease-in-out infinite',
                }}>
                    <Gem size={32} color="var(--primary)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.375rem' }}>
                        <Loader2 size={16} className="animate-spin" color="var(--primary)" />
                        <span style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9375rem' }}>Initializing Security...</span>
                    </div>
                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>Verifying your session</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <style>{`
                html, body { overflow: hidden !important; height: 100% !important; }

                @keyframes loginFadeIn {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes loginShake {
                    0%, 100% { transform: translateX(0); }
                    20%       { transform: translateX(-6px); }
                    40%       { transform: translateX(6px); }
                    60%       { transform: translateX(-4px); }
                    80%       { transform: translateX(4px); }
                }
                @keyframes orbFloat1 {
                    0%, 100% { transform: translate(0,0) scale(1); }
                    50%       { transform: translate(-2%,4%) scale(1.05); }
                }
                @keyframes orbFloat2 {
                    0%, 100% { transform: translate(0,0) scale(1); }
                    50%       { transform: translate(3%,-3%) scale(0.96); }
                }

                .login-form-section { animation: loginFadeIn 0.55s cubic-bezier(0.2,0.8,0.2,1) 0.05s both; }
                .login-error-anim  { animation: loginShake 0.4s ease-in-out; }

                /* Input wrapper — icon + input together */
                .login-field {
                    position: relative;
                }
                .login-field-icon {
                    position: absolute;
                    left: 0.875rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: rgba(148,163,184,0.6);
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    z-index: 2;
                }
                .login-input {
                    display: block;
                    width: 100%;
                    height: 3.125rem;
                    padding: 0 1rem 0 2.75rem;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    color: #F8FAFC;
                    font-size: 0.9375rem;
                    font-family: var(--font-sans);
                    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
                    outline: none;
                    box-sizing: border-box;
                    -webkit-appearance: none;
                    appearance: none;
                }

                .login-btn {
                    width: 100%;
                    height: 3.125rem;
                    background: var(--gradient-primary);
                    border: none;
                    border-radius: 10px;
                    color: #0D0A00;
                    font-size: 0.9375rem;
                    font-weight: 800;
                    font-family: var(--font-sans);
                    cursor: pointer;
                    letter-spacing: 0.03em;
                    box-shadow: 0 6px 20px rgba(212,175,55,0.3);
                    transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s, filter 0.2s;
                    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
                }
                .login-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 28px rgba(212,175,55,0.4);
                    filter: brightness(1.06);
                }
                .login-btn:active:not(:disabled) { transform: translateY(0); box-shadow: 0 4px 12px rgba(212,175,55,0.25); }
                .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }

                /* Kill ALL browser-native password reveal icons */
                input[type="password"]::-ms-reveal,
                input[type="password"]::-ms-clear,
                input[type="password"]::-webkit-contacts-auto-fill-button,
                input[type="password"]::-webkit-credentials-auto-fill-button,
                input[type="password"]::-webkit-textfield-decoration-container,
                input[type="password"]::-webkit-caps-lock-indicator { display: none !important; }
                input::-webkit-credentials-auto-fill-button { display: none !important; }

                .feature-pill {
                    display: flex; align-items: center; gap: 0.75rem;
                    padding: 0.625rem 1rem;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 99px;
                    transition: background 0.2s, border-color 0.2s;
                }
                .feature-pill:hover {
                    background: rgba(212,175,55,0.07);
                    border-color: rgba(212,175,55,0.18);
                }

                @media (max-width: 1024px) {
                    .login-layout { flex-direction: column !important; overflow-y: auto !important; position: relative !important; height: auto !important; min-height: 100vh !important; }
                    html, body { overflow: auto !important; }
                    .login-brand { min-height: 52vh !important; padding: 3rem 2rem !important; }
                    .login-form-wrap { min-height: 48vh !important; padding: 3rem 2rem !important; }
                }
                @media (max-width: 480px) {
                    .login-brand { padding: 2.5rem 1.5rem !important; }
                    .login-form-wrap { padding: 2.5rem 1.5rem !important; }
                }
            `}</style>

            <div className="login-layout" style={{
                height: '100vh', width: '100vw',
                display: 'flex',
                position: 'fixed', inset: 0,
                fontFamily: 'var(--font-sans)',
                overflow: 'hidden',
            }}>

                {/* ── LEFT: Brand Panel ── */}
                <div className="login-brand" style={{
                    flex: '0 0 52%',
                    background: 'linear-gradient(150deg, #080e1f 0%, #0B132B 40%, #111d38 70%, #1C2541 100%)',
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 'clamp(2.5rem,6vh,5rem) clamp(2.5rem,5vw,4.5rem)',
                    position: 'relative', overflow: 'hidden',
                    color: 'white',
                }}>
                    {/* Background orbs */}
                    <div style={{
                        position: 'absolute', top: '-18%', right: '-12%',
                        width: '55vw', height: '55vw', maxWidth: 680, maxHeight: 680,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 65%)',
                        animation: 'orbFloat1 20s ease-in-out infinite',
                        pointerEvents: 'none',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '-22%', left: '-8%',
                        width: '42vw', height: '42vw', maxWidth: 560, maxHeight: 560,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)',
                        animation: 'orbFloat2 25s ease-in-out infinite',
                        pointerEvents: 'none',
                    }} />
                    {/* Grid overlay */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
                        backgroundSize: '52px 52px',
                        maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)',
                    }} />

                    {/* Logo — white version, same style as original */}
                    <div style={{ position: 'relative', zIndex: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{
                                background: 'rgba(255,255,255,0.08)',
                                padding: '0.5rem',
                                borderRadius: '14px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}>
                                <img
                                    src="/azytion-brand-logo-512.png"
                                    alt={branding.app_name}
                                    style={{ width: 'clamp(36px,5.5vh,52px)', height: 'clamp(36px,5.5vh,52px)', objectFit: 'contain' }}
                                />
                            </div>
                            <div>
                                <h1 style={{
                                    fontSize: 'clamp(1.5rem,4.5vh,2.5rem)',
                                    fontWeight: 900,
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1.1,
                                    margin: 0,
                                }}>
                                    {branding.app_name}
                                </h1>
                                <div style={{
                                    fontSize: '0.6875rem', color: 'var(--primary)',
                                    fontWeight: 700, letterSpacing: '0.1em',
                                    textTransform: 'uppercase', marginTop: '0.2rem',
                                }}>
                                    {branding.app_tagline}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hero */}
                    <div style={{ position: 'relative', zIndex: 2, maxWidth: 520 }}>
                        <h2 style={{
                            fontSize: 'clamp(1.75rem,5.5vh,3.25rem)',
                            fontWeight: 900, lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            marginBottom: 'clamp(0.875rem,2.5vh,1.625rem)',
                            margin: '0 0 clamp(0.875rem,2.5vh,1.625rem)',
                        }}>
                            Precision &amp; Elegance<br />
                            <span style={{
                                background: 'var(--gradient-primary)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                in Every Gem.
                            </span>
                        </h2>

                        <p style={{
                            fontSize: 'clamp(0.875rem,2vh,1.0625rem)',
                            color: 'rgba(255,255,255,0.65)',
                            lineHeight: 1.7,
                            marginBottom: 'clamp(1.5rem,4vh,2.5rem)',
                        }}>
                            {branding.app_description}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { icon: <Gem size={14} />,         text: 'Gemstone & Diamond Inventory Tracking' },
                                { icon: <FileCheck size={14} />,   text: 'Certificate & Memo Management' },
                                { icon: <ShieldCheck size={14} />, text: 'Secure Vault & Full Audit Logs' },
                                { icon: <BarChart3 size={14} />,   text: 'Real-time Analytics & AI Insights' },
                            ].map((f, i) => (
                                <div key={i} className="feature-pill">
                                    <div style={{ color: 'var(--primary)', flexShrink: 0, lineHeight: 0 }}>{f.icon}</div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ position: 'relative', zIndex: 2, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 'clamp(1rem,2.5vh,1.75rem)' }}>
                        {/* Line 1: phone 1, website, email */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(1rem,3vw,2.5rem)', marginBottom: '0.35rem' }}>
                            {[
                                { icon: <Phone size={13} />, text: branding.app_owner_phone },
                                { icon: <Globe size={13} />, text: branding.app_owner_website },
                                { icon: <Mail size={13} />,  text: branding.app_owner_email },
                            ].filter(c => c.text).map((c, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.8125rem', fontWeight: 500 }}>
                                    {c.icon} {c.text}
                                </div>
                            ))}
                        </div>
                        {/* Line 2: phone 2, aligned under phone 1 */}
                        {branding.app_owner_phone_2 && (
                            <div style={{ display: 'flex', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.8125rem', fontWeight: 500 }}>
                                    <Phone size={13} /> {branding.app_owner_phone_2}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.25)' }}>
                            <span>{branding.app_copyright}</span>
                            <span>v4.0.0-PRO</span>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Login Form ── */}
                <div className="login-form-wrap" style={{
                    flex: 1,
                    background: 'var(--background)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 'clamp(2rem,5vw,4rem)',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Subtle glow */}
                    <div style={{
                        position: 'absolute', top: '15%', left: '50%',
                        transform: 'translateX(-50%)',
                        width: '90%', height: '70%',
                        background: 'radial-gradient(ellipse, rgba(212,175,55,0.035) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <div className="login-form-section" style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: 'clamp(1.75rem,5vh,2.75rem)' }}>
                            <div style={{
                                width: 54, height: 54,
                                background: 'var(--primary-subtle)',
                                border: '1px solid rgba(212,175,55,0.22)',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.125rem',
                                boxShadow: 'var(--shadow-gold)',
                            }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                            <h2 style={{
                                fontSize: 'clamp(1.375rem,4vh,1.875rem)',
                                fontWeight: 900, letterSpacing: '-0.03em',
                                color: 'var(--foreground)', margin: '0 0 0.5rem',
                            }}>
                                Secure Portal
                            </h2>
                            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', margin: 0 }}>
                                Sign in to your enterprise command center
                            </p>
                        </div>

                        {/* Form card */}
                        <div style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-xl)',
                            padding: '1.75rem',
                            boxShadow: 'var(--shadow-md)',
                        }}>
                            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

                                {/* Username */}
                                <div>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.75rem', fontWeight: 700,
                                        color: 'var(--muted-foreground)',
                                        letterSpacing: '0.07em', textTransform: 'uppercase',
                                    }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        Username
                                    </label>
                                    <input
                                        name="username"
                                        type="text"
                                        placeholder="Enter your username"
                                        required
                                        autoComplete="username"
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            height: '3rem',
                                            padding: '0 0.875rem',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '10px',
                                            color: '#F8FAFC',
                                            fontSize: '0.9375rem',
                                            fontFamily: 'var(--font-sans)',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            transition: 'border-color 0.2s, box-shadow 0.2s',
                                        }}
                                        onFocus={e => {
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.14)';
                                            e.currentTarget.style.background = 'rgba(212,175,55,0.04)';
                                        }}
                                        onBlur={e => {
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                        }}
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.75rem', fontWeight: 700,
                                        color: 'var(--muted-foreground)',
                                        letterSpacing: '0.07em', textTransform: 'uppercase',
                                    }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                        </svg>
                                        Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Enter your password"
                                            required
                                            autoComplete="new-password"
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                height: '3rem',
                                                padding: '0 3rem 0 0.875rem',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px',
                                                color: '#F8FAFC',
                                                fontSize: '0.9375rem',
                                                fontFamily: 'var(--font-sans)',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                transition: 'border-color 0.2s, box-shadow 0.2s',
                                            }}
                                            onFocus={e => {
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.14)';
                                                e.currentTarget.style.background = 'rgba(212,175,55,0.04)';
                                            }}
                                            onBlur={e => {
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                                e.currentTarget.style.boxShadow = 'none';
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(s => !s)}
                                            tabIndex={-1}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            style={{
                                                position: 'absolute',
                                                right: '0.75rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'rgba(100,116,139,0.7)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.25rem',
                                                borderRadius: '4px',
                                                transition: 'color 0.15s',
                                                lineHeight: 0,
                                            }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(100,116,139,0.7)'}
                                        >
                                            {showPassword
                                                ? <EyeOff size={15} />
                                                : <Eye size={15} />
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Remember Me + Error row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        cursor: 'pointer', userSelect: 'none',
                                        fontSize: '0.8125rem', color: 'rgba(148,163,184,0.8)',
                                    }}>
                                        <div
                                            onClick={() => setRememberMe(v => !v)}
                                            style={{
                                                width: 36, height: 20, borderRadius: 99,
                                                background: rememberMe ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                                border: `1px solid ${rememberMe ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}`,
                                                position: 'relative', flexShrink: 0,
                                                transition: 'background 0.2s, border-color 0.2s',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute', top: 2,
                                                left: rememberMe ? 17 : 2,
                                                width: 14, height: 14, borderRadius: '50%',
                                                background: rememberMe ? '#0D0A00' : 'rgba(255,255,255,0.6)',
                                                transition: 'left 0.2s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                            }} />
                                        </div>
                                        <span>
                                            {rememberMe ? (
                                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Stay signed in</span>
                                            ) : (
                                                'Remember me'
                                            )}
                                        </span>
                                    </label>
                                    {rememberMe && (
                                        <span style={{ fontSize: '0.6875rem', color: 'rgba(148,163,184,0.5)' }}>
                                            Session lasts 30 days
                                        </span>
                                    )}
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="login-error-anim" style={{
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(244,63,94,0.08)',
                                        border: '1px solid rgba(244,63,94,0.22)',
                                        borderRadius: 8,
                                        color: 'var(--destructive)',
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    }}>
                                        <Zap size={14} style={{ flexShrink: 0 }} />
                                        {error}
                                    </div>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    className="login-btn"
                                    disabled={loading}
                                    style={{ marginTop: '0.25rem' }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={17} className="animate-spin" />
                                            Authenticating...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                                <polyline points="10 17 15 12 10 7"/>
                                                <line x1="15" y1="12" x2="3" y2="12"/>
                                            </svg>
                                            Sign In
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Trust badges */}
                        <div style={{
                            marginTop: '1.5rem',
                            display: 'flex', justifyContent: 'center',
                            gap: '1.25rem', flexWrap: 'wrap',
                        }}>
                            {[
                                { icon: <ShieldCheck size={12} />, text: 'Encrypted' },
                                { icon: <Award size={12} />,       text: 'Certified' },
                                { icon: <Gem size={12} />,         text: 'Azytion GemERP Pro' },
                            ].map((b, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    fontSize: '0.6875rem', fontWeight: 600,
                                    color: 'var(--muted)',
                                }}>
                                    <span style={{ color: 'var(--primary)', lineHeight: 0 }}>{b.icon}</span>
                                    {b.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
