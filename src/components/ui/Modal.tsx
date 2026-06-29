'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
    showClose?: boolean;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '500px',
    showClose = true
}: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div 
            className="modal-blur-overlay"
            onClick={onClose}
            style={{ zIndex: 999999 }}
        >
            <div className="modal-portal-content" style={{ maxWidth }}>
                <div 
                    className="card modal-card"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'relative',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        animation: 'modalFadeIn 0.3s ease-out',
                        padding: 0,
                    }}
                >
                {(title || showClose) && (
                    <div className="modal-card-header" style={{ margin: 0, padding: '1rem 1.25rem' }}>
                        {title && <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>{title}</h3>}
                        {showClose && (
                            <button 
                                type="button"
                                onClick={onClose}
                                className="btn-close"
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: 'var(--muted)',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}
                <div className="modal-card-body" style={{ padding: '1.25rem' }}>
                    {children}
                </div>
            </div>
        </div>
    </div>,
        document.body
    );
}
