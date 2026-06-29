'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { X, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildSalesInvoicePDFFromSaleRecord, downloadPDF } from '@/lib/pdf-generator';

interface ReceiptPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: any;
    items: any[];
    settings: Record<string, string>;
}

export default function ReceiptPreviewModal({ isOpen, onClose, sale, items, settings }: ReceiptPreviewModalProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setPdfUrl(null);
            return;
        }
        const doc = buildSalesInvoicePDFFromSaleRecord(sale, items, settings);
        const out = doc.output('bloburl');
        const url = typeof out === 'string' ? out : (out as URL).href;
        setPdfUrl(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [isOpen, sale, items, settings]);

    if (!isOpen) return null;

    const handleDownloadPDF = () => {
        const doc = buildSalesInvoicePDFFromSaleRecord(sale, items, settings);
        downloadPDF(doc, `Invoice_${sale.invoice_number}.pdf`);
    };

    return createPortal(
        <div
            onClick={onClose}
            className="modal-blur-overlay"
            style={{ zIndex: 1000000 }}
        >
            <div
                className="card modal-portal-content modal-card receipt-preview-modal"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(920px, 98vw)',
                    maxWidth: '98%',
                    maxHeight: '95vh',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="receipt-preview-modal__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Invoice preview (A4)</h3>
                    <button type="button" onClick={onClose} className="btn-close" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, minHeight: '60vh', background: '#525659', padding: '1rem' }}>
                    {pdfUrl ? (
                        <iframe
                            title="Invoice PDF preview"
                            src={pdfUrl}
                            style={{ width: '100%', height: 'min(72vh, 800px)', border: 'none', borderRadius: '4px', background: 'white' }}
                        />
                    ) : (
                        <div style={{ color: 'white', textAlign: 'center', padding: '2rem' }}>Loading preview…</div>
                    )}
                </div>

                <div className="modal-action-row" style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button type="button" onClick={handleDownloadPDF} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={16} /> Download PDF
                    </button>
                    <button type="button" onClick={onClose} className="btn btn-outline">Close</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
