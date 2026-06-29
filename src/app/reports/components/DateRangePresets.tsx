'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRange {
    start: string;
    end: string;
}

interface DateRangePresetsProps {
    onSelect: (range: DateRange | undefined) => void;
    onFilterTypeChange: (type: 'all' | 'custom') => void;
}

function fmt(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const PRESETS = [
    { value: 'all',        label: 'All Time' },
    { value: 'today',      label: 'Today' },
    { value: 'yesterday',  label: 'Yesterday' },
    { value: 'this_week',  label: 'This Week' },
    { value: 'last_week',  label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_year',  label: 'This Year' },
    { value: 'custom',     label: 'Custom Range' },
];

function getRange(value: string): DateRange | undefined {
    const now = new Date();
    switch (value) {
        case 'today': { const t = fmt(now); return { start: t, end: t }; }
        case 'yesterday': { const d = new Date(now); d.setDate(d.getDate() - 1); const t = fmt(d); return { start: t, end: t }; }
        case 'this_week': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); return { start: fmt(s), end: fmt(now) }; }
        case 'last_week': { const e = new Date(now); e.setDate(now.getDate() - now.getDay() - 1); const s = new Date(e); s.setDate(e.getDate() - 6); return { start: fmt(s), end: fmt(e) }; }
        case 'this_month': { return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) }; }
        case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: fmt(s), end: fmt(e) }; }
        case 'this_year': { return { start: fmt(new Date(now.getFullYear(), 0, 1)), end: fmt(now) }; }
        default: return undefined;
    }
}

export default function DateRangePresets({ onSelect, onFilterTypeChange }: DateRangePresetsProps) {
    const [selected, setSelected] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    function handleChange(value: string) {
        setSelected(value);
        if (value === 'all') {
            onFilterTypeChange('all');
            onSelect(undefined);
        } else if (value === 'custom') {
            onFilterTypeChange('custom');
            // Don't fire until both dates are set
        } else {
            onFilterTypeChange('custom');
            const range = getRange(value);
            if (range) onSelect(range);
        }
    }

    function handleCustomDate(start: string, end: string) {
        if (start && end) {
            onFilterTypeChange('custom');
            onSelect({ start, end });
        }
    }

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Calendar size={14} style={{ position: 'absolute', left: '0.625rem', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                <select
                    value={selected}
                    onChange={e => handleChange(e.target.value)}
                    style={{
                        height: '2.25rem',
                        paddingLeft: '2rem',
                        paddingRight: '2rem',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--surface-2)',
                        color: 'var(--foreground)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        minWidth: 140,
                    }}
                >
                    {PRESETS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </div>

            {selected === 'custom' && (
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                    <input
                        type="date"
                        value={customStart}
                        onChange={e => { setCustomStart(e.target.value); handleCustomDate(e.target.value, customEnd); }}
                        style={{ height: '2.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--foreground)', padding: '0 0.5rem', fontSize: '0.8125rem', width: 140 }}
                    />
                    <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>→</span>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={e => { setCustomEnd(e.target.value); handleCustomDate(customStart, e.target.value); }}
                        style={{ height: '2.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--foreground)', padding: '0 0.5rem', fontSize: '0.8125rem', width: 140 }}
                    />
                </div>
            )}
        </div>
    );
}
