'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { generateChequePDF, downloadPDF, printPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from '@/components/ui/InputModal';

interface ChequePrintButtonProps {
    cheque: any;
}

export default function ChequePrintButton({ cheque }: ChequePrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();

        const companyInfo = buildCompanyInfo(settings);

        const currencySymbol = settings.currency_symbol || 'LKR';

        const pdfData = {
            cheque_number: cheque.cheque_number,
            date: cheque.date,
            payee: cheque.payee,
            amount: cheque.amount,
            bank: cheque.bank,
            status: cheque.status,
            currency_symbol: currencySymbol
        };

        return generateChequePDF(pdfData, companyInfo);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing cheque record');
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
            downloadPDF(doc, `Cheque-${cheque.cheque_number}.pdf`);
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
            const doc = await generatePDF();
            await sendPDFEmail(
                doc,
                email,
                `Cheque Record - ${cheque.cheque_number}`,
                `Please find attached the Cheque Record for ${cheque.cheque_number}.`,
                `Cheque-${cheque.cheque_number}.pdf`
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
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}
                disabled={generating}
                title="Print Cheque Record"
            >
                <Printer size={16} />
                {generating ? 'Generating...' : 'Print'}
            </button>
            <button
                onClick={handleDownload}
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}
                disabled={generating}
                title="Download PDF"
            >
                <Download size={16} />
            </button>
            <button
                onClick={handleEmail}
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}
                disabled={generating}
                title="Email PDF"
            >
                <Mail size={16} />
            </button>

            <InputModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                onConfirm={confirmEmail}
                title="Email Cheque"
                description="Enter recipient email address to send this cheque record."
                placeholder="office@example.com"
                inputType="email"
                confirmLabel="Send Email"
            />
        </div>
    );
}
