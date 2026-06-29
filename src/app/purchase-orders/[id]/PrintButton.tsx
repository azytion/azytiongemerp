'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { generatePurchaseOrderPDF, downloadPDF, printPDF } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from '@/components/ui/InputModal';

interface PrintButtonProps {
    order: any;
    companyInfo: {
        name: string;
        address?: string;
        phone?: string;
        phone2?: string;
        email?: string;
        website?: string;
    };
    currencySymbol: string;
}

export default function PrintButton({ order, companyInfo, currencySymbol }: PrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const pdfData = {
                po_number: order.po_number,
                date_created: order.date_created,
                expected_date: order.expected_date,
                status: order.status,
                supplier_name: order.supplier_name,
                supplier_phone: order.supplier_phone,
                supplier_email: order.supplier_email,
                total_amount: order.total_amount,
                items: order.items,
                notes: order.notes,
                currency_symbol: currencySymbol
            };

            const doc = generatePurchaseOrderPDF(pdfData, companyInfo);
            printPDF(doc);
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
            const pdfData = {
                po_number: order.po_number,
                date_created: order.date_created,
                expected_date: order.expected_date,
                status: order.status,
                supplier_name: order.supplier_name,
                supplier_phone: order.supplier_phone,
                supplier_email: order.supplier_email,
                total_amount: order.total_amount,
                items: order.items,
                notes: order.notes,
                currency_symbol: currencySymbol
            };

            const doc = generatePurchaseOrderPDF(pdfData, companyInfo);
            downloadPDF(doc, `PO-${order.po_number}.pdf`);
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
            const pdfData = {
                po_number: order.po_number,
                date_created: order.date_created,
                expected_date: order.expected_date,
                status: order.status,
                supplier_name: order.supplier_name,
                supplier_phone: order.supplier_phone,
                supplier_email: order.supplier_email,
                total_amount: order.total_amount,
                items: order.items,
                notes: order.notes,
                currency_symbol: currencySymbol
            };

            const doc = generatePurchaseOrderPDF(pdfData, companyInfo);
            await sendPDFEmail(
                doc,
                email,
                `Purchase Order - ${order.po_number}`,
                `Please find attached Purchase Order ${order.po_number}.`,
                `PO-${order.po_number}.pdf`
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
                {generating ? 'Generating...' : 'Print PO'}
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
                title="Email PO"
                description={`Enter recipient email address to send PO ${order.po_number}.`}
                placeholder="supplier@example.com"
                inputType="email"
                confirmLabel="Send Email"
                defaultValue={order.supplier_email || ''}
            />
        </div>
    );
}
