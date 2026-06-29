'use client';

/* eslint-disable @next/next/no-img-element */
import { breakSet } from "@/app/actions/inventory";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Layers, Unlock, Package, Diamond, Download, X, Eye, FileText, Trash2, Upload } from "lucide-react";
import { Product } from "@/app/actions/products";
import { generateProductCardPDF, downloadPDF, buildCompanyInfo } from "@/lib/pdf-generator";
import { getSettings } from "@/app/actions/settings";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import SplitLotModal from "./inventory/SplitLotModal";
import MergeLotModal from "./inventory/MergeLotModal";
import { useConfirm } from "@/components/ConfirmDialog";
import { getGemGradingHistory } from "@/app/actions/products";
import { getSupplierDocuments, uploadSupplierDocument, deleteSupplierDocument, SupplierDocument } from "@/app/actions/supplier-documents";

interface ProductDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
}

export function ProductDetailsModal({ isOpen, onClose, product }: ProductDetailsModalProps) {
    const [downloading, setDownloading] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [isBreaking, setIsBreaking] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'grading' | 'documents'>('details');
    const [gradingHistory, setGradingHistory] = useState<any[]>([]);
    const [documents, setDocuments] = useState<SupplierDocument[]>([]);
    const [_docLoading, _setDocLoading] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const router = useRouter();
    const { confirm } = useConfirm();

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen && product) {
            setActiveTab('details');
            getGemGradingHistory(product.id).then(setGradingHistory).catch(() => {});
            getSupplierDocuments(product.id).then(setDocuments).catch(() => {});
        }
    }, [isOpen, product]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !product || !mounted) return null;

    const handleDownloadPDF = async () => {
        try {
            setDownloading(true);
            const settings = await getSettings();

            const companyInfo = buildCompanyInfo(settings);
            const companyWithCurrency = { ...companyInfo, currency_symbol: settings.currency_symbol || settings.currency_code || '$' };
            const doc = generateProductCardPDF(product, companyWithCurrency);
            downloadPDF(doc, `Product_${product.barcode || product.id}.pdf`);
            toast.success("PDF Downloaded successfully");
        } catch (error) {
            console.error("Failed to download PDF:", error);
            toast.error("Failed to download PDF");
        } finally {
            setDownloading(false);
        }
    };

    const handleBreakSet = async () => {
        if (!product || !await confirm({ title: 'Break Set', message: `Break "${product.name}"? All items will return to individual inventory.`, type: 'warning' })) return;

        try {
            setIsBreaking(true);
            const res = await breakSet(product.id);
            if (res.success) {
                toast.success("Set broken successfully");
                onClose();
                router.refresh();
            } else {
                toast.error(res.error || "Failed to break set");
            }
        } catch (_e) {
            toast.error("Failed to break set");
        } finally {
            setIsBreaking(false);
        }
    };


    return createPortal(
        <div
            className="modal-blur-overlay"
            style={{ zIndex: 999999 }}
            onClick={onClose}
        >
            <div
                className="product-details-modal modal-card"
                style={{
                    width: '900px',
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-xl), 0 0 0 1px rgba(255,255,255,0.03)',
                    overflow: 'hidden',
                    animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Gold top accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-primary)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }} />
                {/* Header */}
                <div className="product-details-modal__header" style={{
                    padding: '1.125rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-2)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flexWrap: 'wrap' }}>
                        <div style={{ width: 32, height: 32, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Diamond size={16} color="var(--primary)" />
                        </div>
                        <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {product.name}
                        </h2>
                        {product.type === 'lot' && (
                            <span className="badge badge-gold" style={{ fontSize: '0.6875rem', flexShrink: 0 }}>LOT</span>
                        )}
                        {product.type === 'set' && (
                            <span style={{ fontSize: '0.6875rem', background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.2)', padding: '0.2rem 0.5rem', borderRadius: 99, display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                <Layers size={11} /> SET
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                        {product.type === 'lot' && (
                            <>
                                <button onClick={() => setShowSplitModal(true)} className="btn btn-primary btn-sm">Split Lot</button>
                                <button onClick={() => setShowMergeModal(true)} className="btn btn-secondary btn-sm">Merge</button>
                            </>
                        )}
                        {product.type === 'set' && (
                            <button onClick={handleBreakSet} disabled={isBreaking} className="btn btn-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--destructive)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Unlock size={13} /> {isBreaking ? 'Breaking...' : 'Break Set'}
                            </button>
                        )}
                        <button onClick={onClose} className="btn-close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="product-details-modal__body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                    {/* Tabs */}
                    <div className="sub-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                        {(['details', 'grading', 'documents'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '0.375rem 0.875rem',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                    color: activeTab === tab ? '#000' : 'var(--muted-foreground)',
                                    borderColor: activeTab === tab ? 'var(--primary)' : 'var(--border-strong)',
                                }}
                            >
                                {tab === 'details' ? 'Details' : tab === 'grading' ? `Grading History${gradingHistory.length > 0 ? ` (${gradingHistory.length})` : ''}` : `Documents${documents.length > 0 ? ` (${documents.length})` : ''}`}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'details' && (
                    <div className="product-details-modal__grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
                        {/* Left Column: Image & Price */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{
                                position: 'relative',
                                paddingTop: '100%',
                                width: '100%',
                                borderRadius: '0.75rem',
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                background: 'var(--secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {product.image_url ? (
                                    <>
                                        <img
                                            src={product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`}
                                            alt={product.name}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = 'flex';
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                        <div style={{
                                            display: 'none',
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            color: 'var(--muted)',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💎</div>
                                            <div>Image Missing</div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        color: 'var(--muted)',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💎</div>
                                        <div>No Image</div>
                                    </div>
                                )}
                            </div>

                            <div style={{
                                background: 'var(--primary-subtle)',
                                border: '1px solid rgba(212,175,55,0.2)',
                                padding: '1.25rem',
                                borderRadius: 'var(--radius-lg)',
                            }}>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>Selling Price</div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.03em', marginBottom: '0.875rem' }}>
                                    {formatCurrency(product.selling_price)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                        <span style={{ color: 'var(--muted-foreground)' }}>Stock</span>
                                        <span style={{ fontWeight: 700, color: product.stock > 0 ? 'var(--success)' : 'var(--destructive)' }}>
                                            {product.stock} {product.pricing_method === 'per_carat' ? 'ct' : 'pcs'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                        <span style={{ color: 'var(--muted-foreground)' }}>Barcode</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.75rem' }}>{product.barcode || 'N/A'}</span>
                                    </div>
                                    {product.parent_lot_id && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                            <span style={{ color: 'var(--muted-foreground)' }}>Split from Lot</span>
                                            <span style={{ fontWeight: 600 }}>#{product.parent_lot_id}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Gemstone Specifics */}
                            {product.gem_details ? (
                                <div>
                                    <h3 style={{ fontWeight: 700, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Diamond size={15} color="var(--primary)" /> Gemstone Details
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.875rem' }}>
                                        <DetailRow label="Carat Weight" value={`${product.gem_details.carat_weight} ct`} />
                                        <DetailRow label="Shape" value={product.gem_details.shape} />
                                        <DetailRow label="Color" value={product.gem_details.color} />
                                        <DetailRow label="Clarity" value={product.gem_details.clarity} />
                                        <DetailRow label="Cut Grade" value={product.gem_details.cut_grade} />
                                        <DetailRow label="Origin" value={product.gem_details.origin} />
                                        <DetailRow label="Treatment" value={product.gem_details.treatment} />
                                        <DetailRow label="Dimensions" value={product.gem_details.dimensions} />
                                        {product.gem_details.lot_origin_weight && (
                                            <DetailRow label="Original Lot Weight" value={`${product.gem_details.lot_origin_weight} ct`} />
                                        )}
                                    </div>

                                    {/* Lot tracking history */}
                                    {product.gem_details.lot_tracking && (() => {
                                        try {
                                            const history = JSON.parse(product.gem_details.lot_tracking as string) as any[];
                                            if (!history?.length) return null;
                                            return (
                                                <div style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 'var(--radius-md)' }}>
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.625rem' }}>
                                                        Lot History
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                                        {history.map((entry: any, i: number) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.25rem 0', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                                <span style={{ color: 'var(--muted-foreground)' }}>{entry.action || entry.type || 'Event'}</span>
                                                                <span style={{ fontWeight: 600 }}>{entry.weight ? `${entry.weight} ct` : ''} {entry.date ? new Date(entry.date).toLocaleDateString() : ''}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        } catch { return null; }
                                    })()}

                                    {product.gem_details.certificate_number && (
                                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59,130,246,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.15)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Certificate</div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                        {product.gem_details.certificate_provider || 'Unknown Lab'}
                                                    </div>
                                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--foreground-2)' }}>
                                                        {product.gem_details.certificate_number}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const provider = (product.gem_details?.certificate_provider || '').toUpperCase();
                                                        const num = product.gem_details?.certificate_number;
                                                        let url = '';
                                                        if (provider.includes('GIA')) url = `https://www.gia.edu/report-check?reportno=${num}`;
                                                        else if (provider.includes('IGI')) url = `https://www.igi.org/reports/verify-your-report?reportnumber=${num}`;
                                                        else if (product.gem_details?.certificate_url) url = product.gem_details.certificate_url;
                                                        if (url) window.open(url, '_blank');
                                                        else toast.info('Manual verification required for this lab.');
                                                    }}
                                                    className="btn btn-primary btn-sm"
                                                    style={{ flexShrink: 0 }}
                                                >
                                                    <Eye size={13} /> Verify
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: '1.5rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                    No gemstone details recorded.
                                </div>
                            )}

                            {/* General Info */}
                            <div>
                                <h3 style={{
                                    fontWeight: 600,
                                    marginBottom: '1rem',
                                    paddingBottom: '0.5rem',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '1rem'
                                }}>General Info</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                                    <DetailRow label="Category" value={product.category_name || 'Uncategorized'} />
                                    <DetailRow label="Pricing" value={product.pricing_method === 'per_carat' ? 'Per Carat' : 'Per Piece'} />
                                </div>
                                {product.notes && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Notes</div>
                                        <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{product.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Set/Lot Contents */}
                            {(product.children && product.children.length > 0) && (
                                <div style={{
                                    background: 'var(--secondary)',
                                    padding: '1.25rem',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--border)',
                                    marginTop: '1.5rem'
                                }}>
                                    <h3 style={{
                                        fontWeight: 600,
                                        margin: '0 0 1rem 0',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <Package size={16} />
                                        {product.type === 'set' ? 'Items in this Set' : 'Items Split from this Lot'}
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {product.children.map(child => (
                                            <div key={child.id} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.5rem',
                                                background: 'var(--surface)',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Diamond size={14} style={{ color: 'var(--primary)' }} />
                                                    <span>{child.name}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{child.gem_details?.carat_weight} ct</span>
                                                    <span style={{ fontWeight: 600 }}>{formatCurrency(child.selling_price)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    )} {/* end details tab */}

                    {activeTab === 'grading' && (
                        <div>
                            {gradingHistory.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                    No grading history recorded yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {gradingHistory.map((entry, i) => (
                                        <div key={i} style={{ padding: '0.875rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Grading Update</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                                    {entry.username || 'System'} · {new Date(entry.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                                {Object.keys(entry.new_values).map(field => (
                                                    <div key={field} style={{ padding: '0.375rem 0.625rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                        <div style={{ fontSize: '0.625rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.125rem' }}>{field}</div>
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                            <span style={{ color: 'var(--destructive)', textDecoration: 'line-through', fontSize: '0.75rem' }}>{entry.old_values[field] || '—'}</span>
                                                            <span style={{ color: 'var(--muted-foreground)' }}>→</span>
                                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{entry.new_values[field] || '—'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Upload */}
                            <div style={{ padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>Upload Document</div>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.currentTarget);
                                    const file = fd.get('file') as File;
                                    const docName = fd.get('doc_name') as string;
                                    const docType = fd.get('doc_type') as string;
                                    if (!file || !docName) return;
                                    setUploadingDoc(true);
                                    try {
                                        // Upload file first
                                        const uploadFd = new FormData();
                                        uploadFd.append('file', file);
                                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFd });
                                        const uploadData = await uploadRes.json();
                                        if (!uploadData.url) throw new Error('Upload failed');
                                        await uploadSupplierDocument({
                                            product_id: product!.id,
                                            document_name: docName,
                                            document_url: uploadData.url,
                                            document_type: docType || 'invoice',
                                        });
                                        const updated = await getSupplierDocuments(product!.id);
                                        setDocuments(updated);
                                        (e.target as HTMLFormElement).reset();
                                        toast.success('Document uploaded');
                                    } catch (err: any) {
                                        toast.error('Upload failed: ' + err.message);
                                    } finally {
                                        setUploadingDoc(false);
                                    }
                                }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                    <div style={{ flex: '2 1 160px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>Document Name</label>
                                        <input name="doc_name" className="input" placeholder="e.g. GIA Certificate" required style={{ height: '2.25rem' }} />
                                    </div>
                                    <div style={{ flex: '1 1 120px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>Type</label>
                                        <select name="doc_type" className="input" style={{ height: '2.25rem' }}>
                                            <option value="invoice">Invoice</option>
                                            <option value="certificate">Certificate</option>
                                            <option value="provenance">Provenance</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: '2 1 160px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>File</label>
                                        <input name="file" type="file" className="input" required style={{ height: '2.25rem', padding: '0.25rem' }} />
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={uploadingDoc} style={{ height: '2.25rem' }}>
                                        {uploadingDoc ? 'Uploading...' : <><Upload size={13} /> Upload</>}
                                    </button>
                                </form>
                            </div>

                            {/* Document list */}
                            {documents.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                    No documents uploaded yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {documents.map(doc => (
                                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                            <FileText size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.document_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{doc.document_type} · {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                                            </div>
                                            <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                                                <Eye size={12} /> View
                                            </a>
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--destructive)', flexShrink: 0 }}
                                                onClick={async () => {
                                                    if (!await confirm({ title: 'Delete Document', message: `Delete "${doc.document_name}"?`, type: 'danger' })) return;
                                                    await deleteSupplierDocument(doc.id);
                                                    setDocuments(prev => prev.filter(d => d.id !== doc.id));
                                                    toast.success('Document deleted');
                                                }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '0.875rem 1.5rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.625rem',
                    background: 'var(--surface-2)',
                    flexShrink: 0,
                }}>
                    <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
                    <button onClick={handleDownloadPDF} disabled={downloading} className="btn btn-primary btn-sm">
                        {downloading ? 'Generating...' : <><Download size={14} /> Download PDF</>}
                    </button>
                </div>
            </div>

            <SplitLotModal isOpen={showSplitModal} onClose={() => setShowSplitModal(false)} lot={product} />
            <MergeLotModal isOpen={showMergeModal} onClose={() => setShowMergeModal(false)} targetLot={product} />
        </div>,
        document.body
    );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
    if (!value) return null;
    return (
        <div style={{ padding: '0.5rem 0.625rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.5625rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>{label}</div>
            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--foreground)' }}>{value}</div>
        </div>
    );
}

