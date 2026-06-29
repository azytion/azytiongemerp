'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { AlertTriangle, Database, Download, X } from 'lucide-react';
import Link from 'next/link';

export default function EndOfMonthBackupAlert() {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if it's the end of the month (last 3 days)
        const today = new Date();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const isEndOfMonth = today.getDate() >= lastDayOfMonth - 2;
        
        // Check if dismissed in this session
        const dismissed = sessionStorage.getItem('backupAlertDismissed');
        
        if (isEndOfMonth && !dismissed) {
            setIsVisible(true);
        }
    }, []);

    if (!isVisible || isDismissed) return null;

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem('backupAlertDismissed', 'true');
    };

    return (
        <div style={{
            background: 'linear-gradient(to right, rgba(203, 163, 88, 0.1), rgba(203, 163, 88, 0.02))',
            border: '1px solid rgba(203, 163, 88, 0.3)',
            borderRadius: '8px',
            padding: '1.5rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }} className="animate-fade-in">
            <button 
                onClick={handleDismiss}
                style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer'
                }}
            >
                <X size={20} />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>End of Month Reminder: Secure Your Data</h3>
            </div>
            
            <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                As the month comes to a close, it is highly recommended to create a backup of your shop&apos;s database and export your monthly data for accounting purposes. 
                Securing your data prevents accidental loss in case of hardware failure.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <Link href="/settings?tab=system" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <Database size={16} /> Backup Database (System)
                </Link>
                <Link href="/settings?tab=data" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={16} /> Export All Data (Archiving)
                </Link>
            </div>
        </div>
    );
}
