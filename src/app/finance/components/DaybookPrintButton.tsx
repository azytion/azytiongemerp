'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { generateDaybookPDF, downloadPDF, printPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from '@/components/ui/InputModal';

interface DaybookPrintButtonProps {
    date: string;
    entries: any[];
    stats: any;
}

export default function DaybookPrintButton({ date, entries, stats }: DaybookPrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();

        const companyInfo = buildCompanyInfo(settings);

        const currencySymbol = settings.currency_symbol || 'LKR';

        const pdfData = {
            date,
            stats: {
                total_income: stats.total_credit || 0,
                total_expenses: stats.total_debit || 0,
                net_cash_flow: (stats.total_credit || 0) - (stats.total_debit || 0)
            },
            entries: entries.map(entry => ({
                time: new Date(entry.time ? `${entry.date}T${entry.time}` : entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                description: entry.description || 'No description',
                type: entry.transaction_type,
                amount: (entry.credit || 0) + (entry.debit || 0),
                user: entry.username || 'System'
            })),
            currency_symbol: currencySymbol
        };

        // We need to implement generateDaybookPDF in pdf-generator.ts first
        return generateDaybookPDF(pdfData, companyInfo);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing daybook');
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
            downloadPDF(doc, `Daybook-${date}.pdf`);
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
                `Daybook Report - ${date}`,
                `Please find attached the Daybook report for ${date}.`,
                `Daybook-${date}.pdf`,
                settings.company_name || 'Azytion GemERP'
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
                className="btn btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
                title="Print Daybook"
            >
                <Printer size={18} />
                {generating ? 'Generating...' : 'Print'}
            </button>
            <button
                onClick={handleDownload}
                className="btn btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
                title="Download Daybook PDF"
            >
                <Download size={18} />
            </button>
            <button
                onClick={handleEmail}
                className="btn btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
                title="Email Daybook PDF"
            >
                <Mail size={18} />
            </button>

            <InputModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                onConfirm={confirmEmail}
                title="Email Daybook"
                description="Enter recipient email address to send this daybook report."
                placeholder="accountant@example.com"
                inputType="email"
                confirmLabel="Send Email"
            />
        </div>
    );
}
