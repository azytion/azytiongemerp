'use client';

import { Printer, Download } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { getCustomer, getCustomerTransactions } from '@/app/actions/customers';
import { getSupplier, getSupplierTransactions } from '@/app/actions/suppliers';
import { generateStatementPDF, downloadPDF, printPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { toast } from 'sonner';

interface StatementPrintButtonProps {
    partyId: number;
    partyName: string;
    partyType: 'customer' | 'supplier';
}

export default function StatementPrintButton({ partyId, partyName, partyType }: StatementPrintButtonProps) {
    const [generating, setGenerating] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();
        const companyInfo = buildCompanyInfo(settings);
        const currencySymbol = settings.currency_symbol || 'LKR';
        const statementDate = new Date().toISOString().slice(0, 10);

        let closingBalance = 0;
        let rawTransactions: Array<Record<string, unknown>> = [];

        if (partyType === 'customer') {
            const customer = await getCustomer(partyId);
            closingBalance = Number(customer?.balance || 0);
            rawTransactions = await getCustomerTransactions(partyId) as Array<Record<string, unknown>>;
        } else {
            const supplier = await getSupplier(partyId);
            closingBalance = Number(supplier?.balance || 0);
            rawTransactions = await getSupplierTransactions(partyId) as unknown as Array<Record<string, unknown>>;
        }

        const transactions = rawTransactions.map((tx) => ({
            date: String(tx.date || '').slice(0, 10),
            reference: String(tx.invoice_number || tx.description || tx.id || ''),
            description: tx.type === 'payment' ? 'Payment received' : String(tx.type || 'Transaction'),
            debit: tx.type === 'sale' ? Number(tx.total_amount || 0) : 0,
            credit: tx.type === 'payment' ? Number(tx.total_amount || tx.credit || 0) : Number(tx.received_cash || 0),
            balance: 0,
        }));

        const pdfData = {
            party_name: partyName,
            party_type: partyType,
            statement_date: statementDate,
            opening_balance: closingBalance,
            transactions,
            closing_balance: closingBalance,
            currency_symbol: currencySymbol,
        };

        return generateStatementPDF(pdfData, companyInfo);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing statement');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            const date = new Date().toISOString().slice(0, 10);
            downloadPDF(doc, `Statement-${partyName}-${date}.pdf`);
            toast.success('PDF downloaded');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
                onClick={handlePrint}
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}
                disabled={generating}
                title="Print Statement"
            >
                <Printer size={16} />
                {generating ? 'Generating...' : 'Statement'}
            </button>
            <button
                onClick={handleDownload}
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}
                disabled={generating}
                title="Download Statement PDF"
            >
                <Download size={16} />
            </button>
        </div>
    );
}
