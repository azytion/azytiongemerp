'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Command, Package, Users, ShoppingCart, BarChart3, Settings, Plus, Home, ArrowRight } from 'lucide-react';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const actions = [
        { icon: ShoppingCart, label: 'Open POS Terminal', shortcut: 'P', path: '/pos' },
        { icon: Package, label: 'Inventory Management', shortcut: 'I', path: '/inventory-management' },
        { icon: BarChart3, label: 'Business Reports', shortcut: 'R', path: '/reports' },
        { icon: Users, label: 'Customer Directory', shortcut: 'C', path: '/customers' },
        { icon: Plus, label: 'Add New Product', shortcut: 'N', path: '/products/new' },
        { icon: Settings, label: 'System Settings', shortcut: 'S', path: '/settings' },
        { icon: Home, label: 'Dashboard', shortcut: 'D', path: '/' },
    ];

    const filteredActions = actions.filter(a =>
        a.label.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleAction = (path: string) => {
        router.push(path);
        setIsOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredActions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
        } else if (e.key === 'Enter') {
            if (filteredActions[selectedIndex]) {
                handleAction(filteredActions[selectedIndex].path);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal-blur-overlay"
            style={{ zIndex: 99999, alignItems: 'flex-start', paddingTop: '15vh' }}
            onClick={() => setIsOpen(false)}
        >
            <div
                style={{
                    width: 'min(600px, calc(100vw - 2rem))',
                    background: 'var(--surface)', borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
                    overflow: 'hidden', border: '1px solid var(--border)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Search size={20} className="text-muted" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search actions or pages..."
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1.1rem', color: 'var(--foreground)' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--secondary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                        <Command size={12} /> K
                    </div>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
                    {filteredActions.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                            No actions found for &quot;{search}&quot;
                        </div>
                    ) : (
                        filteredActions.map((action, index) => (
                            <div
                                key={action.path}
                                onClick={() => handleAction(action.path)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                style={{
                                    padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
                                    borderRadius: '8px', cursor: 'pointer',
                                    background: selectedIndex === index ? 'var(--primary-light)' : 'transparent',
                                    color: selectedIndex === index ? 'var(--primary)' : 'var(--foreground)',
                                    transition: 'all 0.1s ease'
                                }}
                            >
                                <action.icon size={20} />
                                <span style={{ flex: 1, fontWeight: 500 }}>{action.label}</span>
                                {selectedIndex === index && <ArrowRight size={16} />}
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', opacity: selectedIndex === index ? 0 : 1 }}>
                                    Alt + {action.shortcut}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: '0.75rem 1rem', background: 'var(--secondary)', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ border: '1px solid var(--border)', padding: '0 4px', borderRadius: '3px' }}>↵</span> to select
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ border: '1px solid var(--border)', padding: '0 4px', borderRadius: '3px' }}>↑↓</span> to navigate
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ border: '1px solid var(--border)', padding: '0 4px', borderRadius: '3px' }}>esc</span> to close
                    </div>
                </div>
            </div>
        </div>
    );
}
