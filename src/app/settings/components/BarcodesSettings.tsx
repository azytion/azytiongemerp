'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getSettings } from '@/app/actions/settings';
import { getProductsWithoutBarcodes, getProductsWithBarcodes, generateBarcode, generateBulkBarcodes } from '@/app/actions/barcodes';
import { Plus, Printer, Search, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { toast } from 'sonner';
import Link from 'next/link';
import { getCurrentCurrencySymbol } from '@/lib/utils';

type PrintItem = {
    id: number;
    name: string;
    barcode: string;
    price: number;
    copies: number;
    carat_weight?: number;
    shape?: string;
};

import { Pagination } from '@/components/ui/Pagination';
import { PaginatedResult } from '@/app/actions/types';
import Modal from '@/components/ui/Modal';

export default function BarcodesSettings() {
    const [productsWithoutResult, setProductsWithoutResult] = useState<PaginatedResult<any> | null>(null);
    const [productsWithResult, setProductsWithResult] = useState<PaginatedResult<any> | null>(null);
    const [withoutPage, setWithoutPage] = useState(1);
    const [withPage, setWithPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [printList, setPrintList] = useState<PrintItem[]>([]);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [currencySymbol, setCurrencySymbol] = useState(getCurrentCurrencySymbol());

    const loadWithout = useCallback(async (page: number) => {
        const result = await getProductsWithoutBarcodes('', page, 10);
        setProductsWithoutResult(result);
    }, []);

    const loadWith = useCallback(async (page: number, search: string) => {
        const result = await getProductsWithBarcodes(search, page, 12);
        setProductsWithResult(result);
    }, []);

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        const settingsData = await getSettings();
        if (settingsData.currency_symbol) setCurrencySymbol(settingsData.currency_symbol);
        await Promise.all([loadWithout(1), loadWith(1, '')]);
        setLoading(false);
    }, [loadWithout, loadWith]);

    useLoadEffect(() => loadInitialData(), [loadInitialData]);
    useLoadEffect(() => loadWithout(withoutPage), [withoutPage, loadWithout]);
    useLoadEffect(() => loadWith(withPage, searchTerm), [withPage, searchTerm, loadWith]);

    async function handleGenerateSingle(productId: number) {
        const result = await generateBarcode(productId);
        if (result.success) {
            toast.success('Barcode generated successfully! Reloading...');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            toast.error(`Error: ${result.error}`);
        }
    }

    async function handleGenerateBulk() {
        if (selectedIds.length === 0) {
            toast.error('Please select products first');
            return;
        }

        const result = await generateBulkBarcodes(selectedIds);
        if (result.success) {
            setSelectedIds([]);
            toast.success(`Generated ${selectedIds.length} barcodes successfully! Reloading...`);
            setTimeout(() => window.location.reload(), 1000);
        } else {
            toast.error(`Error: ${result.error}`);
        }
    }

    function handlePrepareSelectedForPrint() {
        const selected = productsWithResult?.data.filter(p => selectedIds.includes(p.id)) || [];
        const items: PrintItem[] = selected.map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            price: p.price,
            copies: 1,
            carat_weight: p.carat_weight,
            shape: p.shape
        }));
        setPrintList(items);
        setShowPrintModal(true);
    }

    function handlePrintAll() {
        if (!productsWithResult) return;
        const items: PrintItem[] = productsWithResult.data.map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            price: p.price,
            copies: 1,
            carat_weight: p.carat_weight,
            shape: p.shape
        }));
        setPrintList(items);
        setShowPrintModal(true);
    }

    if (loading && !productsWithResult) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Barcode Management
                    </h2>
                    <p style={{ color: 'var(--muted)' }}>Generate and print product barcodes</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link href="/barcodes/manual" className="btn btn-outline">
                        <Plus size={20} />
                        Manual Generator
                    </Link>
                    {selectedIds.length > 0 && (
                        <button onClick={handlePrepareSelectedForPrint} className="btn btn-primary">
                            <Printer size={20} />
                            Print Selected ({selectedIds.length})
                        </button>
                    )}
                    {productsWithResult && productsWithResult.total > 0 && selectedIds.length === 0 && (
                        <button onClick={handlePrintAll} className="btn btn-primary">
                            <Printer size={20} />
                            Print All
                        </button>
                    )}
                </div>
            </header>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>With Barcodes</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{productsWithResult?.total || 0}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Without Barcodes</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{productsWithoutResult?.total || 0}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Selected</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{selectedIds.length}</div>
                </div>
            </div>

            {/* Products Without Barcodes */}
            {productsWithoutResult && productsWithoutResult.data.length > 0 && (
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Products Without Barcodes</h3>
                        {selectedIds.length > 0 && (
                            <button onClick={handleGenerateBulk} className="btn btn-primary">
                                <Plus size={16} />
                                Generate {selectedIds.length} Barcodes
                            </button>
                        )}
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(productsWithoutResult.data.map(p => p.id));
                                                } else {
                                                    setSelectedIds([]);
                                                }
                                            }}
                                            checked={selectedIds.length === productsWithoutResult.data.length && productsWithoutResult.data.length > 0}
                                        />
                                    </th>
                                    <th>Product Name</th>
                                    <th style={{ textAlign: 'right' }}>Price</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productsWithoutResult.data.map((product) => (
                                    <tr key={product.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(product.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds([...selectedIds, product.id]);
                                                    } else {
                                                        setSelectedIds(selectedIds.filter(id => id !== product.id));
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td>{product.name}</td>
                                        <td style={{ textAlign: 'right' }}>{currencySymbol}{product.price.toFixed(2)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleGenerateSingle(product.id)}
                                                className="btn btn-outline"
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                                            >
                                                Generate
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {productsWithoutResult.totalPages > 1 && (
                        <Pagination
                            currentPage={withoutPage}
                            totalPages={productsWithoutResult.totalPages}
                            onPageChange={setWithoutPage}
                            totalItems={productsWithoutResult.total}
                            pageSize={productsWithoutResult.pageSize}
                        />
                    )}
                </div>
            )}

            {/* Products With Barcodes */}
            {productsWithResult && (
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Products With Barcodes</h3>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Search by name or barcode..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setWithPage(1); }}
                                style={{ paddingLeft: '2.5rem', height: '2.5rem' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="select-all-with"
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setSelectedIds(productsWithResult.data.map(p => p.id));
                                } else {
                                    setSelectedIds([]);
                                }
                            }}
                            checked={selectedIds.length === productsWithResult.data.length && productsWithResult.data.length > 0}
                        />
                        <label htmlFor="select-all-with" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                            Select Current Page ({productsWithResult.data.length})
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                        {productsWithResult.data.map((product) => (
                            <BarcodeCard
                                key={product.id}
                                product={product}
                                isSelected={selectedIds.includes(product.id)}
                                onToggleSelect={(id) => {
                                    if (selectedIds.includes(id)) {
                                        setSelectedIds(selectedIds.filter(i => i !== id));
                                    } else {
                                        setSelectedIds([...selectedIds, id]);
                                    }
                                }}
                                currencySymbol={currencySymbol}
                            />
                        ))}
                    </div>
                    {productsWithResult.totalPages > 1 && (
                        <div style={{ marginTop: '1rem' }}>
                            <Pagination
                                currentPage={withPage}
                                totalPages={productsWithResult.totalPages}
                                onPageChange={setWithPage}
                                totalItems={productsWithResult.total}
                                pageSize={productsWithResult.pageSize}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Print Modal */}
            {showPrintModal && (
                <PrintModal
                    items={printList}
                    onClose={() => setShowPrintModal(false)}
                    onUpdateItem={(id, updates) => {
                        setPrintList(printList.map(item =>
                            item.id === id ? { ...item, ...updates } : item
                        ));
                    }}
                    onRemoveItem={(id) => {
                        setPrintList(printList.filter(item => item.id !== id));
                    }}
                    currencySymbol={currencySymbol}
                />
            )}
        </div>
    );
}

function BarcodeCard({ product, isSelected, onToggleSelect, currencySymbol }: { product: any; isSelected: boolean; onToggleSelect: (id: number) => void; currencySymbol: string }) {
    useEffect(() => {
        try {
            JsBarcode(`#barcode-${product.id}`, product.barcode, {
                format: "CODE128",
                width: 2,
                height: 50,
                displayValue: true,
                fontSize: 12
            });
        } catch (error) {
            console.error('Error generating barcode:', error);
        }
    }, [product]);

    return (
        <div
            className="card"
            style={{
                padding: '1rem',
                textAlign: 'center',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer'
            }}
            onClick={() => onToggleSelect(product.id)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: '500', fontSize: '0.875rem', textAlign: 'left', flex: 1 }}>{product.name}</div>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => { }}
                    style={{ marginLeft: '0.5rem' }}
                />
            </div>
            <svg id={`barcode-${product.id}`}></svg>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                {currencySymbol}{product.price.toFixed(2)}
            </div>
        </div>
    );
}

function PrintModal({ items, onClose, onUpdateItem, onRemoveItem, currencySymbol }: {
    items: PrintItem[];
    onClose: () => void;
    onUpdateItem: (id: number, updates: Partial<PrintItem>) => void;
    onRemoveItem: (id: number) => void;
    currencySymbol: string;
}) {
    const [tagType, setTagType] = useState<'standard' | 'gemstone'>('standard');

    function handlePrint() {
        const labels = items.flatMap(item => Array(item.copies).fill(item));

        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Barcode Labels</title>
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
                        border: 1px dashed #ddd; /* Helper for cutting, can be removed */
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
                    .gem-tag {
                        display: flex;
                        flex-direction: row;
                        width: 100%;
                        height: 1.5cm;
                        padding: 1mm;
                        gap: 2mm;
                        align-items: center;
                        border: 1px solid #eee;
                        page-break-inside: avoid;
                    }
                    .gem-side {
                        width: 35%;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        font-size: 8px;
                    }
                    .gem-barcode-side {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .gem-spec {
                        font-weight: bold;
                        color: #333;
                    }
                    svg { width: 100%; height: auto; max-height: 1.5cm; }
                    .gem-tag svg { max-height: 1cm; }
                    @media print {
                        body { padding: 0; }
                        .print-container { gap: 2mm; }
                        .label, .gem-tag { border: none; } /* Hide border for actual print */
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    ${labels.map((item, index) => {
            if (tagType === 'gemstone') {
                return `
                                <div class="gem-tag">
                                    <div class="gem-side">
                                        <div style="font-weight:bold; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${item.name}</div>
                                        <div class="gem-spec">${item.carat_weight ? item.carat_weight + ' ct' : ''} ${item.shape || ''}</div>
                                        <div class="gem-spec">${currencySymbol}${item.price.toFixed(2)}</div>
                                    </div>
                                    <div class="gem-barcode-side">
                                        <svg id="barcode-${index}"></svg>
                                    </div>
                                </div>
                            `;
            }
            return `
                            <div class="label">
                                <div class="label-content">
                                    <div class="label-name">${item.name}</div>
                                    <svg id="barcode-${index}"></svg>
                                </div>
                                <div class="label-price-vertical">${currencySymbol}${item.price.toFixed(2)}</div>
                            </div>
                        `;
        }).join('')}
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>
                    ${labels.map((item, index) => `
                        JsBarcode("#barcode-${index}", "${item.barcode}", {
                            format: "CODE128",
                            width: ${tagType === 'gemstone' ? 1.2 : 1.5},
                            height: ${tagType === 'gemstone' ? 30 : 40},
                            displayValue: ${tagType === 'standard'},
                            fontSize: 9,
                            margin: 0
                        });
                    `).join('\n')}
                    setTimeout(() => window.print(), 500);
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        onClose();
    }

    const totalLabels = items.reduce((sum, item) => sum + item.copies, 0);

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`Print Preview (${totalLabels} labels)`}
            maxWidth="800px"
        >
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setTagType('standard')}
                    className={`btn ${tagType === 'standard' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                >
                    Standard Label
                </button>
                <button
                    onClick={() => setTagType('gemstone')}
                    className={`btn ${tagType === 'gemstone' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                >
                    Gemstone Tag
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {items.map((item) => (
                    <div key={item.id} className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{item.name}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                                {item.barcode} • {currencySymbol}{item.price.toFixed(2)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem' }}>Copies:</label>
                            <input
                                type="number"
                                className="input"
                                min="1"
                                max="100"
                                value={item.copies}
                                onChange={(e) => onUpdateItem(item.id, { copies: parseInt(e.target.value) || 1 })}
                                style={{ width: '80px', height: '2rem' }}
                            />
                        </div>
                        <button
                            onClick={() => onRemoveItem(item.id)}
                            className="btn btn-outline"
                            style={{ padding: '0.5rem' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="btn btn-outline">
                    Cancel
                </button>
                <button onClick={handlePrint} className="btn btn-primary">
                    <Printer size={16} />
                    Print {totalLabels} Labels
                </button>
            </div>
        </Modal>
    );
}
