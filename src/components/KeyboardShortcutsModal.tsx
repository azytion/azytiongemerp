'use client';

import { createPortal } from 'react-dom';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const shortcuts = [
    { key: 'F2', description: 'Focus Search / Barcode Input' },
    { key: 'F4', description: 'Open Checkout (when cart has items)' },
    { key: 'F6', description: 'Hold Current Order' },
    { key: 'Enter', description: 'Complete Sale / Confirm Action' },
    { key: 'Esc', description: 'Close Modal / Cancel' },
    { key: 'Alt', description: 'Clear Cart' },
    { key: '→ / ←', description: 'Switch Payment Method (in checkout)' },
    { key: 'Shift', description: 'Hold Order (when cart has items)' },
    { key: 'Ctrl', description: 'Focus Search Bar' },
    { key: '+', description: 'Cycle Discount Type (when discount focused)' },
    { key: '?', description: 'Show Keyboard Shortcuts' },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    if (!isOpen || typeof window === 'undefined') return null;

    return createPortal(
        <div
            className="modal-blur-overlay"
            style={{ zIndex: 999999 }}
            onClick={onClose}
        >
            <div
                style={{
                    width: 480,
                    maxWidth: '95vw',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-xl)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <Keyboard size={18} color="var(--primary)" />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Keyboard Shortcuts</h3>
                    </div>
                    <button className="btn-close" onClick={onClose}><X size={16} /></button>
                </div>
                <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {shortcuts.map(s => (
                        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <kbd style={{
                                background: 'var(--surface-3)',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                padding: '0.125rem 0.5rem',
                                fontSize: '0.75rem',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                color: 'var(--primary)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                minWidth: 40,
                                textAlign: 'center',
                            }}>
                                {s.key}
                            </kbd>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--foreground-2)' }}>{s.description}</span>
                        </div>
                    ))}
                </div>
                <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Press <kbd style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 3, padding: '0 4px', fontSize: '0.7rem', fontFamily: 'monospace' }}>?</kbd> or <kbd style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 3, padding: '0 4px', fontSize: '0.7rem', fontFamily: 'monospace' }}>Esc</kbd> to close</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
