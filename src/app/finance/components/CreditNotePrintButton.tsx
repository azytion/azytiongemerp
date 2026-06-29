'use client';

import { Printer, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { getCreditNoteWithItems } from '@/app/actions/credit-notes';
import { getSettings } from '@/app/actions/settings';
import { generateCreditNotePDF, printPDF, downloadPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { toast } from 'sonner';
import InputModal from '@/components/ui/InputModal';

interface CreditNotePrintButtonProps {
    creditNoteId: number;
}

export default function CreditNotePrintButton({ creditNoteId }: CreditNotePrintButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const [note, settings] = await Promise.all([
                getCreditNoteWithItems(creditNoteId),
                getSettings()
            ]);

            if (!note) {
                toast.error('Credit note not found');
                return;
            }

            const companyInfo = buildCompanyInfo(settings);

            const currencySymbol = settings.currency_symbol || 'LKR';

            const pdfData = {
                credit_note_number: note.credit_note_number,
                date: note.date,
                type: note.type,
                reference_number: note.reference_invoice_id?.toString(),
                customer_name: note.type === 'sales_return' ? note.party_name : undefined,
                supplier_name: note.type === 'purchase_return' ? note.party_name : undefined,
                total_amount: note.amount,
                items: note.items.map((item: any) => ({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    price: item.price
                })),
                reason: note.reason,
                currency_symbol: currencySymbol
            };

            const doc = generateCreditNotePDF(pdfData, companyInfo);
            printPDF(doc);
            toast.success('Printing credit note');
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
            const [note, settings] = await Promise.all([
                getCreditNoteWithItems(creditNoteId),
                getSettings()
            ]);

            if (!note) {
                toast.error('Credit note not found');
                return;
            }

            const companyInfo = buildCompanyInfo(settings);

            const currencySymbol = settings.currency_symbol || 'LKR';

            const pdfData = {
                credit_note_number: note.credit_note_number,
                date: note.date,
                type: note.type,
                reference_number: note.reference_invoice_id?.toString(),
                customer_name: note.type === 'sales_return' ? note.party_name : undefined,
                supplier_name: note.type === 'purchase_return' ? note.party_name : undefined,
                total_amount: note.amount,
                items: note.items.map((item: any) => ({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    price: item.price
                })),
                reason: note.reason,
                currency_symbol: currencySymbol
            };

            const doc = generateCreditNotePDF(pdfData, companyInfo);
            downloadPDF(doc, `CN-${note.credit_note_number}.pdf`);
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
            const [note, settings] = await Promise.all([
                getCreditNoteWithItems(creditNoteId),
                getSettings()
            ]);

            if (!note) {
                toast.error('Credit note not found');
                return;
            }

            const companyInfo = buildCompanyInfo(settings);

            const currencySymbol = settings.currency_symbol || 'LKR';

            const pdfData = {
                credit_note_number: note.credit_note_number,
                date: note.date,
                type: note.type,
                reference_number: note.reference_invoice_id?.toString(),
                customer_name: note.type === 'sales_return' ? note.party_name : undefined,
                supplier_name: note.type === 'purchase_return' ? note.party_name : undefined,
                total_amount: note.amount,
                items: note.items.map((item: any) => ({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    price: item.price
                })),
                reason: note.reason,
                currency_symbol: currencySymbol
            };

            const doc = generateCreditNotePDF(pdfData, companyInfo);
            await sendPDFEmail(
                doc,
                email,
                `Credit Note - ${note.credit_note_number}`,
                `Please find attached Credit Note ${note.credit_note_number}.`,
                `CN-${note.credit_note_number}.pdf`
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
                title="Print Credit Note"
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
                title="Email Credit Note"
                description="Enter recipient email address to send this credit note."
                placeholder="customer@example.com"
                inputType="email"
                confirmLabel="Send Email"
            />
        </div>
    );
}

