'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { generateLedgerPDF, downloadPDF, printPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from '@/components/ui/InputModal';

interface LedgerPrintButtonProps {
    accountName: string;
    accountCode: string;
    startDate: string;
    endDate: string;
    entries: any[];
    openingBalance: number;
    closingBalance: number;
}

export default function LedgerPrintButton({
    accountName,
    accountCode,
    startDate,
    endDate,
    entries,
    openingBalance,
    closingBalance
}: LedgerPrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();

        const companyInfo = buildCompanyInfo(settings);

        const currencySymbol = settings.currency_symbol || 'LKR';

        const pdfData = {
            account_name: accountName,
            account_code: accountCode,
            start_date: startDate,
            end_date: endDate,
            opening_balance: openingBalance,
            entries: entries.map(entry => ({
                date: entry.date,
                description: entry.description,
                reference: entry.reference || '',
                debit: entry.debit || 0,
                credit: entry.credit || 0,
                balance: entry.balance || 0
            })),
            closing_balance: closingBalance,
            currency_symbol: currencySymbol
        };

        return generateLedgerPDF(pdfData, companyInfo);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing ledger report');
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
            downloadPDF(doc, `Ledger-${accountName}-${startDate}-${endDate}.pdf`);
            toast.success('PDF downloaded');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    };

    const handleEmail = async () => {
        setIsEmailModalOpen(true);
    };

    const confirmEmail = async (email: string) => {
        if (!email) return;

        setGenerating(true);
        try {
            const [doc, settings] = await Promise.all([generatePDF(), getSettings()]);
            await sendPDFEmail(
                doc,
                email,
                `General Ledger - ${accountName}`,
                `Please find attached the Ledger for ${accountName} (${startDate} to ${endDate}).`,
                `Ledger-${accountName}-${startDate}-${endDate}.pdf`,
                settings.company_name || 'ZATION GemERP'
            );
        } catch (error) {
            console.error('Email error:', error);
            toast.error('Failed to email PDF');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
                onClick={handlePrint}
                className="btn btn-primary"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
            >
                <Printer size={20} />
                {generating ? 'Generating...' : 'Print Ledger'}
            </button>
            <button
                onClick={handleDownload}
                className="btn btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
            >
                <Download size={20} />
                Download
            </button>
            <button
                onClick={handleEmail}
                className="btn btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
            >
                <Mail size={20} />
                Email
            </button>

            <InputModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                onConfirm={confirmEmail}
                title="Email Ledger"
                description={`Enter recipient email address to send the ledger for ${accountName}.`}
                placeholder="accounting@example.com"
                inputType="email"
                confirmLabel="Send Email"
            />
        </div>
    );
}
