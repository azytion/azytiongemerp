'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Printer } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getCurrentCurrencySymbol } from '@/lib/utils';

type ManualItem = {
    id: string;
    label: string;
    code: string;
    price: string;
    copies: number;
};

function createManualItem(): ManualItem {
    return { id: crypto.randomUUID(), label: '', code: '', price: '', copies: 1 };
}

export default function ManualBarcodePage() {
    const [items, setItems] = useState<ManualItem[]>(() => [createManualItem()]);
    const [currencySymbol] = useState(getCurrentCurrencySymbol());

    useEffect(() => {}, []);

    function addItem() {
        setItems([...items, createManualItem()]);
    }

    function removeItem(id: string) {
        setItems(items.filter(i => i.id !== id));
    }

    function updateItem(id: string, updates: Partial<ManualItem>) {
        setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
    }

    function handlePrint() {
        const labels = items.flatMap(item => Array(item.copies).fill(item));
        if (labels.length === 0) {
            toast.error('No labels to print');
            return;
        }

        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Manual Barcodes</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
                    .print-container {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                        width: 100%;
                    }
                    .label { 
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        justify-content: space-between;
                        width: 100%;
                        height: 2.5cm;
                        padding: 2mm;
                        box-sizing: border-box;
                        border: 1px dashed #ddd;
                        page-break-inside: avoid;
                        overflow: hidden;
                    }
                    .label-content {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .label-name { 
                        font-size: 8px; 
                        margin-bottom: 2px; 
                        font-weight: bold; 
                        white-space: nowrap; 
                        overflow: hidden; 
                        text-overflow: ellipsis; 
                        max-width: 100%;
                        text-align: center;
                    }
                    .label-price-vertical { 
                        writing-mode: vertical-rl;
                        text-orientation: mixed;
                        transform: rotate(180deg);
                        font-size: 10px; 
                        font-weight: bold; 
                        margin-left: 4px;
                        white-space: nowrap;
                        height: 100%;
                        text-align: center;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-left: 1px solid #eee;
                        padding-left: 2px;
                    }
                    svg { width: 100%; height: auto; max-height: 1.5cm; }
                    @media print {
                        body { padding: 0; }
                        .print-container { gap: 2mm; }
                        .label { border: none; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    ${labels.map((item, index) => `
                        <div class="label">
                            <div class="label-content">
                                <div class="label-name">${item.label || 'Product'}</div>
                                <svg id="barcode-${index}"></svg>
                            </div>
                            <div class="label-price-vertical">${item.price ? currencySymbol + item.price : ''}</div>
                        </div>
                    `).join('')}
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>
                    ${labels.map((item, index) => `
                        try {
                            JsBarcode("#barcode-${index}", "${item.code || '00000'}", {
                                format: "CODE128",
                                width: 1.5,
                                height: 40,
                                displayValue: true,
                                fontSize: 9,
                                margin: 0
                            });
                        } catch (_e) {}
                    `).join('\n')}
                    setTimeout(() => window.print(), 500);
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/settings?tab=barcodes" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Manual Barcode Generator</h1>
                        <p style={{ color: 'var(--muted)' }}>Generate random barcodes for non-stock items</p>
                    </div>
                </div>
                <button onClick={handlePrint} className="btn btn-primary">
                    <Printer size={20} />
                    Print Labels
                </button>
            </header>

            <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {items.map((item, index) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 50px', gap: '1rem', alignItems: 'end' }}>
                            <div className="form-group">
                                {index === 0 && <label className="label">Label Name</label>}
                                <input
                                    className="input"
                                    placeholder="e.g. Gift Card"
                                    value={item.label}
                                    onChange={(e) => updateItem(item.id, { label: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                {index === 0 && <label className="label">Barcode Code</label>}
                                <input
                                    className="input"
                                    placeholder="e.g. 12345678"
                                    value={item.code}
                                    onChange={(e) => updateItem(item.id, { code: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                {index === 0 && <label className="label">Price ({currencySymbol})</label>}
                                <input
                                    className="input"
                                    placeholder="0.00"
                                    value={item.price}
                                    onChange={(e) => updateItem(item.id, { price: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                {index === 0 && <label className="label">Copies</label>}
                                <input
                                    type="number"
                                    className="input"
                                    min="1"
                                    value={item.copies}
                                    onChange={(e) => updateItem(item.id, { copies: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                            <button
                                onClick={() => removeItem(item.id)}
                                className="btn btn-outline"
                                style={{ color: 'var(--destructive)', padding: '0.5rem' }}
                                disabled={items.length === 1}
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}

                    <button onClick={addItem} className="btn btn-outline" style={{ marginTop: '1rem', width: 'fit-content' }}>
                        <Plus size={20} />
                        Add Another Label
                    </button>
                </div>
            </div>
        </div>
    );
}
