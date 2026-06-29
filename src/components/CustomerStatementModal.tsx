'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { getCustomer, getCustomerTransactions, type Customer } from '@/app/actions/customers';
import { formatDate, formatCurrency } from '@/lib/utils';
import { FileText, CreditCard, DollarSign, Check, Printer, Download, Mail } from 'lucide-react';
import { getSettings } from '@/app/actions/settings';
import { generateStatementPDF, downloadPDF, printPDF , buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from './ui/InputModal';
import Modal from './ui/Modal';

interface CustomerStatementModalProps {
    customerId: number;
    onClose: () => void;
}

export default function CustomerStatementModal({ customerId, onClose }: CustomerStatementModalProps) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, [customerId]);

    async function loadData() {
        setLoading(true);
        const [customerData, transactionData] = await Promise.all([
            getCustomer(customerId),
            getCustomerTransactions(customerId)
        ]);
        if (customerData) setCustomer(customerData);
        setTransactions(transactionData);
        setLoading(false);
    }

    function buildStatementData(settings: Record<string, string>) {
        if (!customer) return null;
        const currencySymbol = settings.currency_symbol || settings.currency_code || '$';
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

        // Sort oldest first, compute running balance
        let runningBalance = 0;
        const txWithBalance = [...transactions]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(tx => {
                const isPayment = tx.type === 'payment';
                if (isPayment) runningBalance -= Number(tx.total_amount) || 0;
                else runningBalance += Number(tx.total_amount) || 0;
                return {
                    date: tx.date,
                    description: isPayment ? 'Payment Received' : `Invoice ${tx.invoice_number}`,
                    debit: isPayment ? 0 : Number(tx.total_amount) || 0,
                    credit: isPayment ? Number(tx.total_amount) || 0 : 0,
                    balance: runningBalance,
                };
            });

        return {
            party_name: customer.name,
            party_type: 'customer' as const,
            statement_date: dateStr,
            opening_balance: 0,
            transactions: txWithBalance,
            closing_balance: customer.balance || 0,
            currency_symbol: currencySymbol,
        };
    }

    async function handlePrintPDF() {
        if (!customer) return;
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
        if (!customer) return;
        setGenerating(true);
        try {
            const settings = await getSettings();
            const companyInfo = buildCompanyInfo(settings);

            const statementData = buildStatementData(settings);
            if (!statementData) return;

            const doc = generateStatementPDF(statementData, companyInfo);
            downloadPDF(doc, `Statement-${customer.name}-${(() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })()}.pdf`);
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
        if (!customer || !email) return;

        setGenerating(true);
        try {
            const settings = await getSettings();
            const companyInfo = buildCompanyInfo(settings);

            const statementData = buildStatementData(settings);
            if (!statementData) return;

            const doc = generateStatementPDF(statementData, companyInfo);
            await sendPDFEmail(
                doc,
                email,
                `Customer Statement - ${customer.name}`,
                `Please find attached the statement for ${customer.name} as of ${(() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })()}.`,
                `Statement-${customer.name}.pdf`,
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
            <Modal isOpen={true} onClose={onClose} showClose={false}>
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading statement...</div>
            </Modal>
        );
    }

    if (!customer) return null;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Customer Statement"
            maxWidth="800px"
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}
            >
                {/* Summary Strip */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem',
                    padding: '1rem', backgroundColor: 'var(--secondary)',
                    borderRadius: 'var(--radius)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Current Balance</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--destructive)' }}>{formatCurrency(customer.balance || 0)}</div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div style={{ overflow: 'auto', maxHeight: '40vh' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Transaction History</h3>
                    <div className="table-wrapper">
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Invoice #</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                            No transactions found for this customer.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx.id + (tx.type || 'sale')}>
                                            <td>{formatDate(tx.date)}</td>
                                            <td style={{ fontWeight: 500 }}>
                                                {tx.type === 'payment' ? 'Payment Received' : tx.invoice_number}
                                            </td>
                                            <td style={{ textTransform: 'capitalize' }}>
                                                {tx.type === 'payment' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                                                        <Check size={14} /> Settlement
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        {tx.payment_method === 'Cash' && <DollarSign size={14} />}
                                                        {tx.payment_method === 'Bank' && <CreditCard size={14} />}
                                                        {tx.payment_method === 'Cheque' && <FileText size={14} />}
                                                        {tx.payment_method === 'Credit' && <FileText size={14} color="var(--destructive)" />}
                                                        {tx.payment_method}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem',
                                                    backgroundColor: tx.payment_status === 'paid' || tx.payment_status === 'completed' ? 'var(--success-light)' : '#fee2e2',
                                                    color: tx.payment_status === 'paid' || tx.payment_status === 'completed' ? 'var(--success)' : 'var(--destructive)',
                                                    fontWeight: 600
                                                }}>
                                                    {tx.payment_status === 'completed' ? 'Success' : (tx.payment_status || 'paid')}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'payment' ? 'var(--success)' : 'inherit' }}>
                                                {tx.type === 'payment' ? '+' : ''}{formatCurrency(tx.total_amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                description={`Enter recipient email address to send the statement for ${customer.name}.`}
                placeholder="customer@example.com"
                inputType="email"
                confirmLabel="Send Email"
                defaultValue={customer.email || ''}
            />
        </Modal>
    );
}







