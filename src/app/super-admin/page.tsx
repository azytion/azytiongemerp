'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { getSubscriptionInfo, updateSubscription } from '@/app/actions/super-admin';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { ShieldAlert, AlertTriangle, CheckCircle, Lock, Unlock, Sparkles, Clock, Calendar, Infinity } from 'lucide-react';
import { getSession } from '@/app/actions/auth';
import { StatCard } from '@/components/ui/StatCard';
import { useConfirm } from '@/components/ConfirmDialog';

export default function SuperAdminDashboard() {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { confirm } = useConfirm();

    // UI State for tabs
    const [activeTab, setActiveTab] = useState<'limited' | 'lifetime'>('limited');

    useEffect(() => {
        checkAuthAndLoad();
    }, []);

    async function checkAuthAndLoad() {
        const session = await getSession();
        if (!session || session?.role !== 'super_admin') {
            // Hard redirect — don't reveal the super-admin route exists
            window.location.replace('/login');
            return;
        }
        await loadData();
    }

    async function loadData() {
        try {
            const data = await getSubscriptionInfo();
            setInfo(data);
            // Auto-select tab based on current data
            const isLife = data.subscription_type === 'Lifetime' || (data.subscription_expiry && new Date(data.subscription_expiry).getFullYear() > 2100);
            setActiveTab(isLife ? 'lifetime' : 'limited');
        } catch (_e) {
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(action: 'extend_1_month' | 'extend_1_year' | 'reduce_1_month' | 'reduce_1_year' | 'lifetime' | 'disable_lifetime' | 'block' | 'unblock') {
        const confirmMsg = action === 'lifetime'
            ? "Are you sure you want to upgrade to LIFETIME Access? This removes all expiry checks."
            : `Are you sure you want to ${action.replace(/_/g, ' ')}?`;

        const isDanger = action.includes('block') || action.includes('reduce') || action === 'disable_lifetime';
        if (!await confirm({ title: 'Confirm Subscription Update', message: confirmMsg, type: isDanger ? 'danger' : 'warning' })) return;

        setActionLoading(true);
        try {
            const res = await updateSubscription(action);
            if (res.success) {
                toast.success("Subscription updated! Reloading system...");
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (actionErr) {
            console.error(actionErr);
            toast.error("Action failed");
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-20">Loading Super Admin Dashboard...</div>;
    }

    const isBlocked = info.subscription_status === 'blocked';
    const isLifetime = info.subscription_type === 'Lifetime' || (info.subscription_expiry && new Date(info.subscription_expiry).getFullYear() > 2100);

    const expiryDate = info.subscription_expiry ? new Date(info.subscription_expiry) : null;
    const isExpired = !isLifetime && expiryDate && expiryDate < new Date();

    // Calculate Days Remaining
    const now = new Date();
    const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '1rem' }}>
            <style>{`
                @media (max-width: 640px) {
                    .sa-header { flex-direction: column !important; align-items: flex-start !important; gap: 0.75rem !important; margin-bottom: 1.5rem !important; }
                    .sa-header h1 { font-size: 1.375rem !important; }
                    .sa-badges { flex-wrap: wrap; }
                    .sa-duration-grid { grid-template-columns: 1fr !important; gap: 1rem !important; }
                    .sa-plan-selector { width: 100%; }
                }
            `}</style>
            <header className="sa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.375rem, 4vw, 2rem)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <ShieldAlert className="text-primary" size={28} />
                        Super Admin Controls
                    </h1>
                    <p style={{ color: 'var(--muted)' }}>Manage client subscription and access</p>
                </div>
                <div className="sa-badges" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className={`badge ${isLifetime ? 'badge-warning' : 'badge-outline'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem' }}>
                        {isLifetime ? <Infinity size={14} /> : <Clock size={14} />}
                        Plan: <strong>{isLifetime ? 'Lifetime' : 'Limited'}</strong>
                    </div>
                    <div className="badge badge-primary" style={{ padding: '0.5rem 0.875rem' }}>
                        {info.client_name || 'Client'}
                    </div>
                </div>
            </header>

            {/* Plan Selector */}
            <div className="sa-plan-selector" style={{ marginBottom: '2rem', background: 'var(--secondary)', padding: '0.5rem', borderRadius: '0.75rem', display: 'inline-flex', gap: '0.5rem', maxWidth: '100%', boxSizing: 'border-box' }}>
                <button
                    onClick={() => setActiveTab('limited')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: activeTab === 'limited' ? 'white' : 'transparent',
                        color: activeTab === 'limited' ? 'black' : 'var(--muted)',
                        fontWeight: activeTab === 'limited' ? '600' : 'normal',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'limited' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    <Clock size={16} />
                    1. Limited / Specific
                </button>
                <button
                    onClick={() => setActiveTab('lifetime')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: activeTab === 'lifetime' ? 'white' : 'transparent',
                        color: activeTab === 'lifetime' ? 'black' : 'var(--muted)',
                        fontWeight: activeTab === 'lifetime' ? '600' : 'normal',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'lifetime' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    <Infinity size={16} />
                    2. Lifetime
                </button>
            </div>

            {/* Main Content Area based on Selection */}
            {activeTab === 'lifetime' ? (
                /* LIFETIME VIEW */
                <div className="card" style={{ padding: '3rem', textAlign: 'center', border: '2px solid gold', background: 'var(--card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'gold', padding: '1rem', borderRadius: '50%', color: 'white' }}>
                            <Sparkles size={48} />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Lifetime Access Plan</h2>
                    <p style={{ color: 'var(--muted)', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
                        This plan grants the client unlimited access to the system without any expiry restrictions.
                        No monthly or yearly renewals are required.
                    </p>

                    {isLifetime ? (
                        <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center' }}>
                            <div style={{ color: 'green', fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={24} /> Currently Active
                            </div>
                            <button
                                className="btn btn-outline"
                                style={{ borderColor: 'red', color: 'red' }}
                                onClick={() => handleAction('disable_lifetime')}
                                disabled={actionLoading}
                            >
                                Remove Lifetime Access
                            </button>
                        </div>
                    ) : (
                        <button
                            className="btn btn-primary"
                            style={{ background: 'gold', color: 'black', border: 'none', fontSize: '1.1rem', padding: '1rem 2rem' }}
                            onClick={() => handleAction('lifetime')}
                            disabled={actionLoading}
                        >
                            Activate Lifetime Access
                        </button>
                    )}
                </div>
            ) : (
                /* LIMITED VIEW */
                <div style={{ display: 'grid', gap: '2rem' }}>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        <StatCard
                            title="Subscription Status"
                            value={isBlocked ? 'BLOCKED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                            subtitle={isBlocked ? "Emergency Lock Active" : isExpired ? "Renewal Required" : "System fully accessible"}
                            icon={isBlocked ? Lock : isExpired ? AlertTriangle : CheckCircle}
                            variant={isBlocked ? 'red' : isExpired ? 'orange' : 'green'}
                        />

                        <StatCard
                            title="Expiry Date"
                            value={isLifetime ? 'Never (Lifetime)' : expiryDate ? formatDate(expiryDate.toISOString()) : 'N/A'}
                            subtitle="Last day of active access"
                            icon={Calendar}
                            variant="blue"
                        />

                        <StatCard
                            title="Days Remaining"
                            value={isLifetime ? '∞' : daysRemaining > 0 ? `${daysRemaining}` : '0'}
                            subtitle={isLifetime ? "No expiration" : "Days until lock"}
                            icon={Clock}
                            variant="purple"
                        />
                    </div>

                    {/* Manage Time */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={18} /> Manage Duration
                        </h3>

                        {isLifetime && (
                            <div className="alert alert-warning mb-4" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <AlertTriangle size={16} />
                                <span>Note: System is currently in <strong>Lifetime Mode</strong>. Adding time effectively switches it back to Limited mode.</span>
                            </div>
                        )}

                        <div className="sa-duration-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '1rem' }}>Extend Access</h4>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleAction('extend_1_month')}
                                        disabled={actionLoading}
                                        style={{ justifyContent: 'space-between' }}
                                    >
                                        Add 1 Month <span>+</span>
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleAction('extend_1_year')}
                                        disabled={actionLoading}
                                        style={{ justifyContent: 'space-between' }}
                                    >
                                        Add 1 Year <span>+</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '1rem' }}>Reduce / Correct</h4>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-outline"
                                        style={{ color: 'orange', borderColor: 'orange', justifyContent: 'space-between' }}
                                        onClick={() => handleAction('reduce_1_month')}
                                        disabled={actionLoading}
                                    >
                                        Remove 1 Month <span>-</span>
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        style={{ color: 'orange', borderColor: 'orange', justifyContent: 'space-between' }}
                                        onClick={() => handleAction('reduce_1_year')}
                                        disabled={actionLoading}
                                    >
                                        Remove 1 Year <span>-</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Emergency Controls - Always Visible */}
            <div className="card" style={{ padding: '1.5rem', marginTop: '2rem', borderColor: isBlocked ? 'green' : 'red', borderWidth: '1px' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isBlocked ? <Unlock size={18} /> : <Lock size={18} />}
                    {isBlocked ? 'Restore Access' : 'Emergency Lock'}
                </h3>
                <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--muted)' }}>
                    {isBlocked
                        ? "Client is currently BLOCKED. Unblock to verify subscription status."
                        : "Immediately BLOCK access for all users except Super Admin."}
                </p>
                {isBlocked ? (
                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', background: 'green', borderColor: 'green' }}
                        onClick={() => handleAction('unblock')}
                        disabled={actionLoading}
                    >
                        <Unlock size={16} className="inline mr-2" />
                        Unblock Access
                    </button>
                ) : (
                    <button
                        className="btn btn-destructive"
                        style={{ width: '100%' }}
                        onClick={() => handleAction('block')}
                        disabled={actionLoading}
                    >
                        <Lock size={16} className="inline mr-2" />
                        Block Access
                    </button>
                )}
            </div>
        </div>
    );
}

function _ClockIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    )
}
