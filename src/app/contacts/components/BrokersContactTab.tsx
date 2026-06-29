'use client';

// Re-export the full brokers page content as a tab component
// The brokers page already has its own internal tabs (Manage / Commissions)
import { useCallback, useState, useSyncExternalStore } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { createPortal } from 'react-dom';
import { Users2, DollarSign, Search, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Phone, Mail, MapPin, Save, X, RefreshCw, UserPlus, FileSpreadsheet, FileDown, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import {
    getBrokers, createBroker, updateBroker, deleteBroker,
    getBrokerCommissionReport, getBrokerSalesDetail
} from '@/app/actions/brokers';
import type { Broker } from '@/app/actions/brokers';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import StaleBanner from '@/components/StaleBanner';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

type SubTab = 'manage' | 'commissions';

export default function BrokersContactTab() {
    const [subTab, setSubTab] = useState<SubTab>('manage');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
                {([['manage', 'Manage Brokers', Users2], ['commissions', 'Commissions', DollarSign]] as const).map(([id, label, Icon]) => (
                    <button
                        key={id}
                        onClick={() => setSubTab(id)}
                        className={`page-tab-btn ${subTab === id ? 'active' : ''}`}
                        style={{ fontSize: '0.8125rem' }}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>
            {subTab === 'manage' && <ManageBrokersSubTab />}
            {subTab === 'commissions' && <CommissionsSubTab />}
        </div>
    );
}

function ManageBrokersSubTab() {
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Broker | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
    const [statementBroker, setStatementBroker] = useState<Broker | null>(null);
    const [statementData, setStatementData] = useState<any[]>([]);
    const [statementLoading, setStatementLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const { confirm } = useConfirm();

    const load = useCallback(async () => {
        setLoading(true);
        if (navigator.onLine) {
            try {
                const res = await getBrokers();
                if (res.success) {
                    setBrokers(res.brokers || []);
                    setIsStale(false);
                    // Cache
                    const { localDB } = await import('@/lib/db/LocalDB');
                    await localDB.brokers.clear();
                    await localDB.brokers.bulkPut((res.brokers || []) as any);
                }
            } catch {
                await loadFromCache();
            }
        } else {
            await loadFromCache();
        }
        setLoading(false);
    }, []);

    useLoadEffect(() => load(), [load]);

    async function loadFromCache() {
        try {
            const { localDB } = await import('@/lib/db/LocalDB');
            const cached = await localDB.brokers.toArray();
            setBrokers(cached as any);
            setIsStale(true);
        } catch { setBrokers([]); }
    }

    const filtered = brokers.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.phone && b.phone.includes(search)) ||
        (b.email && b.email.toLowerCase().includes(search.toLowerCase()))
    );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const fd = new FormData(e.currentTarget);
        const res = editing ? await updateBroker(editing.id, fd) : await createBroker(fd);
        if (res.success) {
            toast.success(editing ? 'Broker updated' : 'Broker added');
            setModalOpen(false); setEditing(null); load();
        } else toast.error(res.error || 'Failed');
        setSubmitting(false);
    }

    async function handleDelete(id: number, name: string) {
        if (!await confirm({ title: 'Delete Broker', message: `Delete "${name}"?`, type: 'danger' })) return;
        const res = await deleteBroker(id);
        if (res.success) { toast.success('Broker deleted'); load(); }
        else toast.error(res.error || 'Failed');
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Brokers',
            message: `Permanently delete ${selectedIds.length} selected broker${selectedIds.length === 1 ? '' : 's'}?`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deleteBroker(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await load();
        if (failed.length) toast.error(`${failed.length} broker${failed.length === 1 ? '' : 's'} could not be deleted`);
        else toast.success('Selected brokers deleted');
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    async function handleBrokerStatement(broker: Broker) {
        setStatementBroker(broker);
        setStatementLoading(true);
        const data = await getBrokerSalesDetail(broker.id);
        setStatementData(data);
        setStatementLoading(false);
    }

    async function handleExportExcel() {
        const rows = filtered.map(b => ({
            Name: b.name, Phone: b.phone || '', Email: b.email || '',
            Address: b.address || '', Status: b.is_active ? 'Active' : 'Inactive',
        }));
        void downloadRowsAsXlsx(rows, 'Brokers', `Brokers_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    async function handleExportPDF() {
        try {
            const { generateGenericReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
            const { getSettings } = await import('@/app/actions/settings');
            const settings = await getSettings();
            const doc = generateGenericReportPDF(
                'Broker List',
                [{ label: 'Name' }, { label: 'Phone' }, { label: 'Email' }, { label: 'Address' }, { label: 'Status' }],
                filtered.map(b => [b.name, b.phone || '—', b.email || '—', b.address || '—', b.is_active ? 'Active' : 'Inactive']),
                buildCompanyInfo(settings)
            );
            downloadPDF(doc, `Brokers_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) { console.error(e); }
    }

    return (
        <>
            {isStale && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <StaleBanner message="Viewing cached brokers" onRefresh={load} refreshing={loading} />
                </div>
            )}
            <div className="filter-bar">
                <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
                    <Search size={15} className="search-icon" />
                    <input type="text" placeholder="Search brokers..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {selectedIds.length > 0 && (
                    <>
                        <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
                            <X size={14} /> {selectedIds.length} selected
                        </button>
                        <button onClick={handleBulkDelete} disabled={deletingSelected} className="btn btn-destructive btn-sm">
                            <Trash2 size={14} /> {deletingSelected ? 'Deleting...' : `Delete (${selectedIds.length})`}
                        </button>
                    </>
                )}
                <button onClick={handleExportExcel} className="btn btn-secondary btn-sm"><FileSpreadsheet size={14} /> Excel</button>
                <button onClick={handleExportPDF} className="btn btn-secondary btn-sm"><FileDown size={14} /> PDF</button>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                    <UserPlus size={15} /> Add Broker
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-xl)' }} />)}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState icon={Users2} title="No Brokers Found" description="Add your first broker to get started." action={<button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Add Broker</button>} />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {filtered.map(broker => (
                        <div key={broker.id} className="card" style={{ padding: '1.25rem', border: selectedIds.includes(broker.id) ? '1px solid var(--primary)' : '1px solid var(--border)', background: selectedIds.includes(broker.id) ? 'rgba(212,175,55,0.04)' : 'var(--surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(broker.id)}
                                        onChange={() => toggleSelect(broker.id)}
                                        style={{ cursor: 'pointer' }}
                                        aria-label={`Select ${broker.name}`}
                                    />
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-purple)', flexShrink: 0 }}>
                                        {broker.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{broker.name}</div>
                                        <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: 99, background: broker.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)', color: broker.is_active ? 'var(--success)' : 'var(--muted-foreground)', fontWeight: 700 }}>
                                            {broker.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} title="Statement" onClick={() => handleBrokerStatement(broker)}><FileText size={13} /></button>
                                    <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => { setEditing(broker); setModalOpen(true); }}><Edit2 size={13} /></button>
                                    <button className="btn btn-sm" style={{ padding: '0.25rem 0.5rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--destructive)' }} onClick={() => handleDelete(broker.id, broker.name)}><Trash2 size={13} /></button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                {broker.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}><Phone size={12} />{broker.phone}</div>}
                                {broker.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}><Mail size={12} />{broker.email}</div>}
                                {broker.address && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}><MapPin size={12} />{broker.address}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {mounted && modalOpen && createPortal(
                <div className="modal-blur-overlay" style={{ zIndex: 999999 }} onClick={() => { setModalOpen(false); setEditing(null); }}>
                    <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{editing ? 'Edit Broker' : 'Add Broker'}</h3>
                            <button className="btn-close" onClick={() => { setModalOpen(false); setEditing(null); }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group"><label>Name *</label><input name="name" type="text" className="input" required defaultValue={editing?.name} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group"><label>Phone</label><input name="phone" type="tel" className="input" defaultValue={editing?.phone || ''} /></div>
                                <div className="form-group"><label>Email</label><input name="email" type="email" className="input" defaultValue={editing?.email || ''} /></div>
                            </div>
                            <div className="form-group"><label>Address</label><input name="address" type="text" className="input" defaultValue={editing?.address || ''} /></div>
                            <div className="form-group"><label>Notes</label><textarea name="notes" className="input" rows={2} defaultValue={editing?.notes || ''} style={{ height: 'auto' }} /></div>
                            {editing && <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}><input type="checkbox" name="is_active" defaultChecked={editing.is_active === 1} style={{ accentColor: 'var(--primary)' }} /> Active</label>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
                                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                    {editing ? 'Update' : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Broker Statement Modal */}
            {statementBroker && mounted && createPortal(
                <div className="modal-blur-overlay" onClick={() => setStatementBroker(null)}>
                    <div style={{ width: '100%', maxWidth: 700, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Broker Statement — {statementBroker.name}</h3>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{statementBroker.phone || statementBroker.email || 'No contact'}</p>
                            </div>
                            <button className="btn-close" onClick={() => setStatementBroker(null)}><X size={16} /></button>
                        </div>
                        <div style={{ overflow: 'auto', flex: 1, padding: '1rem' }}>
                            {statementLoading ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>
                            ) : statementData.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>No sales linked to this broker.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                                            {['Invoice', 'Date', 'Customer', 'Sale Amount', 'Commission'].map(h => (
                                                <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: h === 'Sale Amount' || h === 'Commission' ? 'right' : 'left', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {statementData.map((s: any, i: number) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{s.invoice_number}</td>
                                                <td style={{ padding: '0.625rem 0.75rem', color: 'var(--muted-foreground)' }}>{formatDate(s.date)}</td>
                                                <td style={{ padding: '0.625rem 0.75rem' }}>{s.customer_name || 'Walk-in'}</td>
                                                <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.total_amount)}</td>
                                                <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(s.broker_commission)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--surface-2)' }}>
                                            <td colSpan={3} style={{ padding: '0.75rem', fontWeight: 700 }}>Total</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(statementData.reduce((s: number, r: any) => s + r.total_amount, 0))}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(statementData.reduce((s: number, r: any) => s + r.broker_commission, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                            <button className="btn btn-secondary btn-sm" onClick={async () => {
                                if (!statementBroker || statementData.length === 0) return;
                                try {
                                    const { generateGenericReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
                                    const { getSettings } = await import('@/app/actions/settings');
                                    const settings = await getSettings();
                                    const sym = settings.currency_symbol || settings.currency_code || '$';
                                    const totalSales = statementData.reduce((s: number, r: any) => s + r.total_amount, 0);
                                    const totalComm = statementData.reduce((s: number, r: any) => s + r.broker_commission, 0);
                                    const rows = [
                                        ...statementData.map((s: any) => [
                                            s.invoice_number,
                                            formatDate(s.date),
                                            s.customer_name || 'Walk-in',
                                            `${sym} ${Number(s.total_amount).toFixed(2)}`,
                                            `${sym} ${Number(s.broker_commission).toFixed(2)}`,
                                        ]),
                                        ['', '', 'TOTAL', `${sym} ${totalSales.toFixed(2)}`, `${sym} ${totalComm.toFixed(2)}`],
                                    ];
                                    const doc = generateGenericReportPDF(
                                        `Broker Statement — ${statementBroker.name}`,
                                        [{ label: 'Invoice' }, { label: 'Date' }, { label: 'Customer' }, { label: 'Sale Amount', align: 'right' }, { label: 'Commission', align: 'right' }],
                                        rows,
                                        buildCompanyInfo(settings),
                                        `${statementBroker.phone || statementBroker.email || ''} | Generated: ${new Date().toLocaleDateString()}`
                                    );
                                    downloadPDF(doc, `Broker_Statement_${statementBroker.name}_${new Date().toISOString().split('T')[0]}.pdf`);
                                } catch (e) { console.error(e); }
                            }}>
                                <FileText size={14} /> Download PDF
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setStatementBroker(null)}>Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

function CommissionsSubTab() {
    const [brokers, setBrokers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedBroker, setExpandedBroker] = useState<number | null>(null);
    const [brokerDetails, setBrokerDetails] = useState<Record<number, any[]>>({});
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterType, setFilterType] = useState<'all' | 'custom'>('all');

    useLoadEffect(async () => {
        setLoading(true);
        const range = filterType === 'custom' && dateRange.start && dateRange.end ? dateRange : undefined;
        const data = await getBrokerCommissionReport(range, search || undefined);
        setBrokers(data);
        setLoading(false);
    }, [search, filterType, dateRange]);

    async function toggleBroker(brokerId: number) {
        if (expandedBroker === brokerId) { setExpandedBroker(null); return; }
        setExpandedBroker(brokerId);
        if (!brokerDetails[brokerId]) {
            const range = filterType === 'custom' && dateRange.start && dateRange.end ? dateRange : undefined;
            const details = await getBrokerSalesDetail(brokerId, range);
            setBrokerDetails(prev => ({ ...prev, [brokerId]: details }));
        }
    }

    const totalCommission = brokers.reduce((s, b) => s + (b.total_commission || 0), 0);

    return (
        <>
            <div className="filter-bar">
                <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                    <Search size={15} className="search-icon" />
                    <input type="text" placeholder="Search broker..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {(['all', 'custom'] as const).map(t => (
                        <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', color: filterType === t ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                            <input type="radio" name="commFilter" value={t} checked={filterType === t} onChange={() => setFilterType(t)} style={{ accentColor: 'var(--primary)' }} />
                            {t === 'all' ? 'All Time' : 'Custom'}
                        </label>
                    ))}
                </div>
                {filterType === 'custom' && (
                    <>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} style={{ height: '2.25rem', borderRadius: 'var(--radius)', width: 140 }} />
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>to</span>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} style={{ height: '2.25rem', borderRadius: 'var(--radius)', width: 140 }} />
                    </>
                )}
            </div>

            <div style={{ padding: '0.75rem 1rem', background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
                Total Commission: {formatCurrency(totalCommission)}
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-lg)' }} />)}
                </div>
            ) : brokers.length === 0 ? (
                <EmptyState icon={DollarSign} title="No Commission Data" description="Commission data appears once sales are linked to brokers." />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {brokers.map(broker => (
                        <div key={broker.broker_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', cursor: 'pointer' }} onClick={() => toggleBroker(broker.broker_id)}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-purple)', flexShrink: 0 }}>
                                    {broker.broker_name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{broker.broker_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{broker.total_sales} sales · {formatCurrency(broker.total_sale_value)}</div>
                                </div>
                                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>{formatCurrency(broker.total_commission)}</div>
                                <div style={{ color: 'var(--muted-foreground)' }}>{expandedBroker === broker.broker_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                            </div>
                            {expandedBroker === broker.broker_id && brokerDetails[broker.broker_id] && (
                                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)', padding: '0.75rem 1.25rem' }}>
                                    {brokerDetails[broker.broker_id].length === 0 ? (
                                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', margin: 0 }}>No sales in this period.</p>
                                    ) : brokerDetails[broker.broker_id].map((sale: any) => (
                                        <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                                            <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{sale.invoice_number}</span>
                                            <span style={{ color: 'var(--muted-foreground)' }}>{formatDate(sale.date)}</span>
                                            <span>{sale.customer_name}</span>
                                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(sale.broker_commission)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
