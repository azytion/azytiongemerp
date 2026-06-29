'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { getSupplier, getSupplierTransactions, type Supplier } from '@/app/actions/suppliers';
import { formatDate, formatCurrency } from '@/lib/utils';
import { X, ShoppingBag, Check, Printer, Download, Mail } from 'lucide-react';
import { getSettings } from '@/app/actions/settings';
import { generateStatementPDF, downloadPDF, printPDF , buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from './ui/InputModal';

interface SupplierStatementModalProps {
    supplierId: number;
    onClose: () => void;
}

export default function SupplierStatementModal({ supplierId, onClose }: SupplierStatementModalProps) {
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, [supplierId]);

    async function loadData() {
        setLoading(true);
        const [supplierData, transactionData] = await Promise.all([
            getSupplier(supplierId),
            getSupplierTransactions(supplierId)
        ]);
        if (supplierData) setSupplier(supplierData);
        setTransactions(transactionData);
        setLoading(false);
    }

    function buildStatementData(settings: Record<string, string>) {
        if (!supplier) return null;
        const currencySymbol = settings.currency_symbol || settings.currency_code || '$';
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

        // Sort oldest first, compute running balance
        let runningBalance = 0;
        const txWithBalance = [...transactions]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(tx => {
                const isPayment = tx.type === 'payment';
                const amt = Number(tx.amount) || 0;
                if (isPayment) runningBalance -= amt;
                else runningBalance += amt;
                return {
                    date: tx.date,
                    description: isPayment ? 'Payment Sent' : `PO ${tx.invoice_number}`,
                    debit: isPayment ? amt : 0,
                    credit: isPayment ? 0 : amt,
                    balance: runningBalance,
                };
            });

        return {
            party_name: supplier.name,
            party_type: 'supplier' as const,
            statement_date: dateStr,
            opening_balance: 0,
            transactions: txWithBalance,
            closing_balance: supplier.balance || 0,
            currency_symbol: currencySymbol,
        };
    }

    async function handlePrintPDF() {
        if (!supplier) return;
        setGenerating(true);
        try {
            const settings = await getSettings();
            const companyInfo = buildCompanyInfo(settings);
            const statementData = buildStatementData(settings);
            if (!statementData) return;
            const doc = generateStatementPDF(statementData, companyInfo);
            printPDF(doc);
            toast.success('Printing statement');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    }

    async function handleDownloadPDF() {
        if (!supplier) return;
        setGenerating(true);
        try {
            const settings = await getSettings();
            const companyInfo = buildCompanyInfo(settings);
            const statementData = buildStatementData(settings);
            if (!statementData) return;
            const doc = generateStatementPDF(statementData, companyInfo);
            const today = new Date();
            const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
            downloadPDF(doc, `Statement-${supplier.name}-${dateStr}.pdf`);
            toast.success('PDF downloaded');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    }

    async function handleEmailPDF() {
        setIsEmailModalOpen(true);
    }

    async function confirmEmail(email: string) {
        if (!supplier || !email) return;
        setGenerating(true);
        try {
            const settings = await getSettings();
            const companyInfo = buildCompanyInfo(settings);
            const statementData = buildStatementData(settings);
            if (!statementData) return;
            const doc = generateStatementPDF(statementData, companyInfo);
            const today = new Date();
            const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
            await sendPDFEmail(
                doc, email,
                `Supplier Statement - ${supplier.name}`,
                `Please find attached the statement for ${supplier.name} as of ${dateStr}.`,
                `Statement-${supplier.name}.pdf`,
                companyInfo.name
            );
        } catch (error) {
            console.error('Email error:', error);
            toast.error('Failed to email PDF');
        } finally {
            setGenerating(false);
        }
    }

    if (loading) {
        return (
            <div className="modal-blur-overlay">
                <div className="card" style={{ padding: '2rem' }}>Loading statement...</div>
            </div>
        );
    }

    if (!supplier) return null;

    return (
        <div
            className="modal-blur-overlay"
            onClick={onClose}
        >
            <div
                className="card"
                style={{
                    maxWidth: '800px', width: '100%', maxHeight: '90dvh', overflow: 'hidden',
                    padding: 0, display: 'flex', flexDirection: 'column', margin: '0 0.75rem',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'var(--surface)', flexShrink: 0,
                }}>
                    <div style={{ minWidth: 0 }}>
                        <h2 style={{ fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', fontWeight: 'bold', margin: 0 }}>Supplier Statement</h2>
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: '0.25rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supplier.name} - {supplier.phone || 'No phone'}</p>
                    </div>
                    <button onClick={onClose} className="btn btn-outline" style={{ padding: '0.5rem', borderRadius: '50%', flexShrink: 0, marginLeft: '0.75rem' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Summary Strip */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem',
                    padding: 'clamp(0.875rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem)',
                    backgroundColor: 'var(--secondary)', flexShrink: 0,
                }}>
                    <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Balance Due</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--destructive)' }}>{formatCurrency(supplier.balance || 0)}</div>
                    </div>
                    <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Contact</div>
                        <div style={{ fontSize: '1rem' }}>{supplier.phone || 'N/A'}</div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div style={{ padding: 'clamp(0.875rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem)', overflow: 'auto', flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Transaction History</h3>
                    <div className="table-wrapper">
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    <th>Type</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                            No transactions found for this supplier.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx.id}>
                                            <td>{formatDate(tx.date)}</td>
                                            <td style={{ fontWeight: 500 }}>
                                                {tx.type === 'payment' ? (
                                                    <span style={{ color: 'var(--success)' }}>Payment Sent</span>
                                                ) : (
                                                    <span>{tx.invoice_number}</span>
                                                )}
                                            </td>
                                            <td style={{ textTransform: 'capitalize' }}>
                                                {tx.type === 'payment' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                                                        <Check size={14} /> Settlement
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <ShoppingBag size={14} /> Purchase
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'payment' ? 'var(--success)' : 'inherit' }}>
                                                {tx.type === 'payment' ? '-' : ''}{formatCurrency(tx.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ padding: 'clamp(0.875rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={handlePrintPDF} disabled={generating} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Printer size={18} /> {generating ? 'Generating...' : 'Print PDF'}
                        </button>
                        <button onClick={handleDownloadPDF} disabled={generating} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Download size={18} /> Download
                        </button>
                        <button onClick={handleEmailPDF} disabled={generating} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={18} /> Email
                        </button>
                    </div>
                    <button onClick={onClose} className="btn btn-outline">Close</button>
                </div>
            </div>

            <InputModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                onConfirm={confirmEmail}
                title="Email Statement"
                description={`Enter recipient email address to send the statement for ${supplier.name}.`}
                placeholder="supplier@example.com"
                inputType="email"
                confirmLabel="Send Email"
                defaultValue={supplier.email || ''}
            />
        </div>
    );
}







