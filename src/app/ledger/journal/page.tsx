'use client';

import { createJournalEntry, getAccounts } from '@/app/actions/ledger';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentCurrencySymbol } from '@/lib/utils';

export default function NewJournalEntryPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [currencySymbol] = useState(getCurrentCurrencySymbol());
    const [lines, setLines] = useState<Array<{ accountId: number; debit: number; credit: number; description: string }>>([
        { accountId: 0, debit: 0, credit: 0, description: '' },
        { accountId: 0, debit: 0, credit: 0, description: '' }
    ]);
    const [date, setDate] = useState((() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })());
    const [description, setDescription] = useState('');

    useEffect(() => {
        getAccounts(1, 1000).then(result => setAccounts(result.data));
    }, []);

    const addLine = () => {
        setLines([...lines, { accountId: 0, debit: 0, credit: 0, description: '' }]);
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: field === 'description' ? value : Number(value) };
        setLines(newLines);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) {
            toast.error('Entry must have at least 2 lines');
            return;
        }
        setLines(lines.filter((_, i) => i !== index));
    };

    const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!isBalanced) {
            toast.error('Entry is not balanced. Debits must equal Credits.');
            return;
        }

        if (lines.some(l => l.accountId === 0)) {
            toast.error('Please select an account for all lines');
            return;
        }

        const result = await createJournalEntry(date, description, lines);
        if (result.success) {
            toast.success('Journal Entry posted successfully');
            router.push('/finance?tab=ledger');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to create entry');
        }
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <style>{`
                @media (max-width: 640px) {
                    .je-row { flex-direction: column !important; }
                    .je-footer { flex-direction: column !important; }
                    .je-footer a, .je-footer button { width: 100%; justify-content: center; box-sizing: border-box; }
                }
            `}</style>
            <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Link href="/finance?tab=ledger" className="btn btn-outline" style={{ padding: '0.5rem', flexShrink: 0 }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.375rem, 4vw, 2rem)', fontWeight: 'bold', margin: 0 }}>New Journal Entry</h1>
                    <p style={{ color: 'var(--muted)', margin: 0 }}>Manual general ledger entry</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
                    <div className="je-row" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: '0 0 auto', minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Date</label>
                            <input
                                type="date"
                                className="input"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                            <label className="label">Description</label>
                            <input
                                type="text"
                                className="input"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                                placeholder="e.g. Opening Balance Adjustment"
                            />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>Journal Lines</h3>
                        <button type="button" onClick={addLine} className="btn btn-outline btn-sm">
                            <Plus size={16} /> Add Line
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', marginBottom: '1rem', minWidth: '480px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Account</th>
                                    <th style={{ textAlign: 'left' }}>Memo</th>
                                    <th style={{ width: '130px', textAlign: 'right' }}>Debit</th>
                                    <th style={{ width: '130px', textAlign: 'right' }}>Credit</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, index) => (
                                    <tr key={index}>
                                        <td>
                                            <select
                                                className="input"
                                                value={line.accountId}
                                                onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                                                required
                                            >
                                                <option value={0}>Select Account...</option>
                                                {accounts.map(a => (
                                                    <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="input"
                                                value={line.description}
                                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                placeholder="Note"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="input"
                                                min="0"
                                                step="0.01"
                                                value={line.debit}
                                                onChange={(e) => updateLine(index, 'debit', e.target.value)}
                                                disabled={line.credit > 0}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="input"
                                                min="0"
                                                step="0.01"
                                                value={line.credit}
                                                onChange={(e) => updateLine(index, 'credit', e.target.value)}
                                                disabled={line.debit > 0}
                                            />
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => removeLine(index)} style={{ color: 'var(--destructive)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold', padding: '0.875rem 0.5rem' }}>Totals:</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap', color: totalDebits === totalCredits ? 'var(--success)' : 'var(--destructive)' }}>
                                        {currencySymbol}{totalDebits.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap', color: totalDebits === totalCredits ? 'var(--success)' : 'var(--destructive)' }}>
                                        {currencySymbol}{totalCredits.toFixed(2)}
                                    </td>
                                    <td></td>
                                </tr>
                                {!isBalanced && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'right', color: 'var(--destructive)', fontSize: '0.875rem' }}>
                                            Difference: {currencySymbol}{Math.abs(totalDebits - totalCredits).toFixed(2)}
                                        </td>
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="je-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                    <Link href="/finance" className="btn btn-outline">Cancel</Link>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} disabled={!isBalanced}>
                        <Save size={20} />
                        Post Entry
                    </button>
                </div>
            </form>
        </div>
    );
}


