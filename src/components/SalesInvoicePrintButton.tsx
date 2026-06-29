'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { buildSalesInvoicePDFFromSaleRecord, downloadPDF, printPDF } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from './ui/InputModal';

interface SalesInvoicePrintButtonProps {
    sale: any;
    items: any[];
}

export default function SalesInvoicePrintButton({ sale, items }: SalesInvoicePrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();
        return buildSalesInvoicePDFFromSaleRecord(sale, items, settings);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing invoice');
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
            downloadPDF(doc, `Invoice-${sale.invoice_number}.pdf`);
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
                `Sales Invoice - ${sale.invoice_number}`,
                `Please find attached Invoice ${sale.invoice_number}.`,
                `Invoice-${sale.invoice_number}.pdf`,
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
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                disabled={generating}
                title="Print Invoice (Standard Format)"
            >
                <Printer size={14} />
                {generating ? 'Generating...' : 'Invoice'}
            </button>
            <button
                onClick={handleDownload}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                disabled={generating}
                title="Download Invoice PDF"
            >
                <Download size={14} />
            </button>
            <button
                onClick={handleEmail}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                disabled={generating}
                title="Email Invoice PDF"
            >
                <Mail size={14} />
            </button>

            <InputModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                onConfirm={confirmEmail}
                title="Email Invoice"
                description="Enter recipient email address to send this invoice."
                placeholder="customer@example.com"
                inputType="email"
                confirmLabel="Send Email"
                defaultValue={sale.customer_email || ''}
            />
        </div>
    );
}
