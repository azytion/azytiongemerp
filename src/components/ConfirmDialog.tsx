'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';

type ConfirmOptions = {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
};

type ConfirmContextType = {
    confirm: (options: string | ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

import { createPortal } from 'react-dom';

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
    const [mounted, setMounted] = useState(false);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const confirm = (opts: string | ConfirmOptions) => {
        const finalOptions = typeof opts === 'string' ? { message: opts } : opts;
        setOptions({
            title: 'Confirm Action',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            type: 'warning',
            ...finalOptions
        });
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    };

    const handleClose = (value: boolean) => {
        setIsOpen(false);
        if (resolveRef.current) {
            resolveRef.current(value);
            resolveRef.current = null;
        }
    };

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {mounted && isOpen && createPortal(
                <div
                    className="modal-blur-overlay"
                    style={{ zIndex: 9999999 }}
                >
                    <div className="modal-portal-content confirm-dialog" style={{ maxWidth: '400px' }}>
                        <div
                            className="card modal-card confirm-dialog-card"
                            style={{
                                padding: '1.5rem',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                animation: 'confirmScaleIn 0.2s ease-out'
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="confirm-dialog-content">
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        backgroundColor: options.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {options.type === 'danger' ? (
                                            <AlertTriangle color="var(--destructive)" size={24} />
                                        ) : options.type === 'info' ? (
                                            <Info color="var(--primary)" size={24} />
                                        ) : (
                                            <HelpCircle color="var(--warning)" size={24} />
                                        )}
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                            {options.title}
                                        </h3>
                                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                                            {options.message}
                                        </p>
                                    </div>
                                </div>

                                <div className="modal-action-row">
                                    <button
                                        type="button"
                                        onClick={() => handleClose(false)}
                                        className="btn btn-outline"
                                    >
                                        {options.cancelText}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleClose(true)}
                                        className={`btn ${options.type === 'danger' ? 'btn-destructive' : 'btn-primary'}`}
                                        autoFocus
                                    >
                                        {options.confirmText}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
}
