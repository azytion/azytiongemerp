'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    description?: string;
    defaultValue?: string;
    placeholder?: string;
    inputType?: 'text' | 'email' | 'number' | 'textarea';
    confirmLabel?: string;
    cancelLabel?: string;
}

import Modal from './Modal';

export default function InputModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    defaultValue = '',
    placeholder = '',
    inputType = 'text',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
}: InputModalProps) {
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();

        // Basic validation
        const currentValue = inputRef.current ? (inputRef.current as HTMLInputElement | HTMLTextAreaElement).value : '';
        if (inputType === 'email' && currentValue) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(currentValue)) {
                setError('Please enter a valid email address');
                return;
            }
        }

        onConfirm(currentValue);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputType !== 'textarea') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="450px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {description && (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                        {description}
                    </p>
                )}

                <div>
                    {inputType === 'textarea' ? (
                        <textarea
                            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                            className="input"
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            rows={4}
                            style={{ resize: 'none', width: '100%' }}
                            defaultValue={defaultValue}
                        />
                    ) : (
                        <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            type={inputType}
                            className="input"
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            style={{ width: '100%' }}
                            defaultValue={defaultValue}
                        />
                    )}
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                            <AlertCircle size={12} />
                            {error}
                        </div>
                    )}
                </div>

                <div className="modal-action-row">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-outline"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSubmit()}
                        className="btn btn-primary"
                    >
                        <CheckCircle2 size={16} />
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
