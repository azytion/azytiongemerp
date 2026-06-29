'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getSettings } from '@/app/actions/settings';
import { generateFinancialReportPDF, downloadPDF, printPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import InputModal from '@/components/ui/InputModal';

interface FinancialReportPrintButtonProps {
    stats: any;
    aging: any;
    banks: any;
    receivables: any[];
}

export default function FinancialReportPrintButton({ stats, aging, banks, receivables }: FinancialReportPrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const generatePDF = async () => {
        const settings = await getSettings();

        const companyInfo = buildCompanyInfo(settings);

        const currencySymbol = settings.currency_symbol || 'LKR';

        // Transform data for PDF
        const pdfData = {
            date: formatDate(new Date(), { showTime: true }),
            metrics: {
                total_sales: stats.totalSales || 0,
                total_profit: stats.totalProfit || 0,
                profit_margin: stats.profitMargin || 0,
                sales_returns: stats.returns?.sales || 0,
                inventory_value: stats.inventory?.costValue || 0,
                total_outstanding: receivables.reduce((sum: number, r: any) => sum + (r.balance || 0), 0)
            },
            aging: {
                upcoming: aging.upcoming.length,
                overdue: aging.overdue.length,
                cleared: aging.cleared.length,
                bounced: aging.bounced.length
            },
            banks: Object.entries(banks).map(([name, data]: [string, any]) => ({
                name,
                count: data.count,
                amount: data.amount
            })),
            receivables: receivables
                .sort((a: any, b: any) => b.balance - a.balance)
                .slice(0, 20) // Top 20 only
                .map((r: any) => ({
                    name: r.name,
                    balance: r.balance,
                    utilization: 0
                })),
            currency_symbol: currencySymbol
        };

        return generateFinancialReportPDF(pdfData, companyInfo);
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const doc = await generatePDF();
            printPDF(doc);
            toast.success('Printing financial report');
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
            downloadPDF(doc, `Financial-Report-${new Date().toISOString().split('T')[0]}.pdf`);
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
                `Financial Report - ${new Date().toLocaleDateString()}`,
                `Please find attached the Financial Summary Report.`,
                `Financial-Report-${new Date().toISOString().split('T')[0]}.pdf`
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
                title="Email Report"
                description="Enter recipient email address to send this financial report."
                placeholder="office@example.com"
                inputType="email"
                confirmLabel="Send Email"
            />
        </div>
    );
}
