'use client';

import { deleteCustomer } from '@/app/actions/customers';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, FileText, Send, Eye, Banknote, FileSpreadsheet, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { PaginatedResult } from '@/app/actions/types';
import { Customer } from '@/app/actions/customers';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import CustomerStatementModal from '@/components/CustomerStatementModal';
import { DueCollectionModal } from '@/components/DueCollectionModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

interface CustomersTabProps {
    customersResult: PaginatedResult<Customer>;
    query: string;
    page: number;
}

export default function CustomersTab({ customersResult, query, page }: CustomersTabProps) {
    const router = useRouter();
    const [_isPending, startTransition] = useTransition();
    const [selectedStatementCustomerId, setSelectedStatementCustomerId] = useState<number | null>(null);
    const [isDueModalOpen, setIsDueModalOpen] = useState(false);
    const [sendingStatement, setSendingStatement] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const { confirm } = useConfirm();

    const allIds = customersResult.data.map(c => c.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    function handleExportExcel() {
        const toExport = selectedIds.length > 0
            ? customersResult.data.filter(c => selectedIds.includes(c.id))
            : customersResult.data;
        const rows = toExport.map(c => ({
            Name: c.name,
            Phone: c.phone || '',
            Email: c.email || '',
            Address: c.address || '',
            Balance: formatCurrency(c.balance || 0),
        }));
        void downloadRowsAsXlsx(rows, 'Customers', `Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    async function handleSendStatement(customer: Customer) {
        if (!customer.email) {
            toast.error(`${customer.name} has no email address on file.`);
            return;
        }
        setSendingStatement(customer.id);
        try {
            const { sendEmail } = await import('@/app/actions/email');
            const html = `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                    <h2>Account Statement</h2>
                    <p>Dear ${customer.name},</p>
                    <p>Your current account balance is: <strong>${formatCurrency(customer.balance || 0)}</strong></p>
                    <p>Please contact us if you have any questions.</p>
                    <p>Thank you for your business.</p>
                </div>
            `;
            const res = await sendEmail(customer.email, `Account Statement — ${customer.name}`, html);
            if (res.success) toast.success(`Statement sent to ${customer.email}`);
            else toast.error('Failed to send: ' + res.error);
        } catch (e: any) {
            toast.error('Failed to send statement: ' + e.message);
        } finally {
            setSendingStatement(null);
        }
    }

    function handleSearch(term: string) {
        const params = new URLSearchParams(window.location.search);
        if (term) {
            params.set('q', term);
        } else {
            params.delete('q');
        }
        params.set('page', '1'); // Reset to first page on search
        startTransition(() => {
            router.replace(`/customers?${params.toString()}`);
        });
    }

    function handlePageChange(newPage: number) {
        const params = new URLSearchParams(window.location.search);
        params.set('page', newPage.toString());
        startTransition(() => {
            router.replace(`/customers?${params.toString()}`);
        });
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Actions bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        defaultValue={query}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {selectedIds.length > 0 && (
                        <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
                            <X size={14} /> {selectedIds.length} selected
                        </button>
                    )}
                    <button onClick={handleExportExcel} className="btn btn-secondary btn-sm" title="Export to Excel">
                        <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button 
                        onClick={() => setIsDueModalOpen(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ gap: '0.375rem', color: 'var(--success)' }}
                    >
                        <Banknote size={15} /> Due Settlement
                    </button>
                    <Link href="/customers/new" className="btn btn-primary btn-sm">
                        <Plus size={15} /> Add Customer
                    </Link>
                </div>
            </div>

            <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                </th>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th>Balance</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customersResult.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted-foreground)' }}>
                                        No customers found. Add your first customer!
                                    </td>
                                </tr>
                            ) : (
                                customersResult.data.map((customer) => (
                                    <tr key={customer.id} style={{ background: selectedIds.includes(customer.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                        <td style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleSelect(customer.id)} style={{ cursor: 'pointer' }} />
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)', flexShrink: 0 }}>
                                                    {customer.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{customer.name}</div>
                                                    {customer.address && (
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
                                                            <MapPin size={10} />
                                                            <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8125rem' }}>
                                                {customer.phone && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--foreground-2)' }}>
                                                        <Phone size={12} color="var(--muted-foreground)" />
                                                        {customer.phone}
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--muted-foreground)' }}>
                                                        <Mail size={12} color="var(--muted-foreground)" />
                                                        {customer.email}
                                                    </div>
                                                )}
                                                {!customer.phone && !customer.email && <span style={{ color: 'var(--muted)' }}>—</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: (customer.balance || 0) > 0 ? 'var(--destructive)' : (customer.balance || 0) < 0 ? 'var(--success)' : 'var(--muted-foreground)' }}>
                                                    {formatCurrency(Math.abs(customer.balance || 0))}
                                                    {(customer.balance || 0) > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 500, marginLeft: 4 }}>due</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                                                <button
                                                    onClick={() => setSelectedStatementCustomerId(customer.id)}
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ padding: '0.25rem 0.5rem' }}
                                                    title="View Statement"
                                                >
                                                    <FileText size={13} />
                                                </button>
                                                {customer.email && (
                                                    <button
                                                        onClick={() => handleSendStatement(customer)}
                                                        disabled={sendingStatement === customer.id}
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        title={`Email statement to ${customer.email}`}
                                                    >
                                                        {sendingStatement === customer.id
                                                            ? <span style={{ fontSize: '0.625rem' }}>...</span>
                                                            : <Send size={13} />
                                                        }
                                                    </button>
                                                )}
                                                <Link href={`/customers/${customer.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} title="View Profile">
                                                    <Eye size={13} />
                                                </Link>
                                                <Link href={`/customers/${customer.id}/edit`} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                                                    <Edit size={13} />
                                                </Link>
                                                <button
                                                    onClick={async () => {
                                                        if (await confirm({ title: 'Delete Customer', message: 'Are you sure you want to delete this customer?', type: 'danger' })) {
                                                            await deleteCustomer(customer.id);
                                                            router.refresh();
                                                        }
                                                    }}
                                                    className="btn btn-sm"
                                                    style={{ padding: '0.25rem 0.5rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--destructive)' }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                <Pagination
                    currentPage={page}
                    totalPages={customersResult.totalPages}
                    onPageChange={handlePageChange}
                    totalItems={customersResult.total}
                    pageSize={customersResult.pageSize}
                />
            </div>

            {selectedStatementCustomerId && (
                <CustomerStatementModal
                    customerId={selectedStatementCustomerId}
                    onClose={() => setSelectedStatementCustomerId(null)}
                />
            )}

            <DueCollectionModal
                isOpen={isDueModalOpen}
                onClose={() => {
                    setIsDueModalOpen(false);
                    router.refresh();
                }}
            />
        </div>
    );
}
