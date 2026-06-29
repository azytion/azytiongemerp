'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X } from 'lucide-react';

interface ManagerOverrideModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    actionDescription: string;
}

export default function ManagerOverrideModal({ isOpen, onClose, onSuccess, actionDescription }: ManagerOverrideModalProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [mounted, setMounted] = useState(false);
    const MAX_ATTEMPTS = 3;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            setAttempts(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        if (attempts >= MAX_ATTEMPTS) {
            setError('Too many failed attempts. Override locked.');
            return;
        }
        setVerifying(true);
        setError('');
        try {
            const { verifyManagerPin } = await import('@/app/actions/users');
            const res = await verifyManagerPin(pin);
            if (res.success) {
                setAttempts(0);
                onSuccess();
                onClose();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                if (newAttempts >= MAX_ATTEMPTS) {
                    setError(`Too many failed attempts. Override locked.`);
                } else {
                    setError(`Invalid PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
                }
                setPin('');
                inputRef.current?.focus();
            }
        } catch { setError('Verification failed'); }
        finally { setVerifying(false); }
    }

    return createPortal(
        <div className="modal-blur-overlay" style={{ zIndex: 999999 }}>
            <div className="modal-portal-content manager-override-modal" style={{ maxWidth: '400px' }}>
                <div className="card modal-card" style={{ width: '100%', padding: '2rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-1rem', marginRight: '-1rem' }}>
                        <button type="button" onClick={onClose} className="btn-close">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--primary)' }}>
                        <ShieldCheck size={64} />
                    </div>
                    
                    <h2 style={{ marginBottom: '0.5rem' }}>Manager Override</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{actionDescription}</p>
                    
                    <form onSubmit={handleVerify}>
                        <input
                            ref={inputRef}
                            type="password"
                            className="input"
                            placeholder="Enter Manager PIN"
                            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', height: '4rem', marginBottom: '1rem' }}
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                            disabled={verifying}
                            maxLength={4}
                        />
                        
                        {error && <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'OK'].map(val => (
                                <button key={val} type="button"
                                    onClick={() => {
                                        if (val === 'Clear') setPin('');
                                        else if (val === 'OK') handleVerify({ preventDefault: () => { } } as any);
                                        else if (pin.length < 4) setPin(pin + val);
                                    }}
                                    className="btn btn-outline" style={{ height: '3.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                    {val}
                                </button>
                            ))}
                        </div>
                        
                        <button type="submit" disabled={verifying || pin.length < 4 || attempts >= MAX_ATTEMPTS} className="btn btn-primary" style={{ width: '100%', height: '3rem' }}>
                            {verifying ? 'Verifying...' : 'Authorize Action'}
                        </button>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
