'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { generateStockTakePDF, downloadPDF, printPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from '@/components/ui/InputModal';

interface StockTakePrintButtonProps {
    items: any[];
    date: string;
}

export default function StockTakePrintButton({ items, date }: StockTakePrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();

        const companyInfo = buildCompanyInfo(settings);

        const currencySymbol = settings.currency_symbol || 'LKR';

        const pdfItems = items.map(item => ({
            product_name: item.product_name || item.name,
            barcode: item.barcode,
            expected_qty: item.expected_qty || item.stock || 0,
            actual_qty: item.actual_qty || 0,
            variance: (item.actual_qty || 0) - (item.expected_qty || item.stock || 0),
            value: ((item.actual_qty || 0) - (item.expected_qty || item.stock || 0)) * (item.purchase_price || 0)
        }));

        const total_variance_value = pdfItems.reduce((sum, item) => sum + item.value, 0);

        const pdfData = {
            date,
            items: pdfItems,
            total_variance_value,
            currency_symbol: currencySymbol
        };

        return generateStockTakePDF(pdfData, companyInfo);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing stock take report');
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
            downloadPDF(doc, `StockTake-${date}.pdf`);
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
                `Stock Take Report - ${date}`,
                `Please find attached the Stock Take report for ${date}.`,
                `StockTake-${date}.pdf`,
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
                className="btn btn-primary"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                disabled={generating}
            >
                <Printer size={20} />
                {generating ? 'Generating...' : 'Print Report'}
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
                title="Email Stock Take"
                description="Enter recipient email address to send this stock take report."
                placeholder="office@example.com"
                inputType="email"
                confirmLabel="Send Email"
            />
        </div>
    );
}
