'use client';

import { useState } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { generateExcelTemplate, exportToExcel, importFromExcel, EntityType } from '@/app/actions/excel';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

function toDownloadBlob(data: Buffer | ArrayBuffer | Uint8Array) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

export default function DataManagementSettings() {
    const _router = useRouter();
    const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
    const [selectedEntity, setSelectedEntity] = useState<EntityType>('products');
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

    async function handleDownloadTemplate() {
        const result = await generateExcelTemplate(selectedEntity);

        if (result.success && result.data) {
            const blob = toDownloadBlob(result.data);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    }

    async function handleExport() {
        setExporting(true);
        const result = await exportToExcel(selectedEntity);

        if (result.success && result.data) {
            const blob = toDownloadBlob(result.data);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename || 'export.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Exported ${selectedEntity} successfully!`);
        } else {
            toast.error(`Export failed: ${result.error}`);
        }

        setExporting(false);
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx')) {
            toast.error('Please select an Excel file (.xlsx)');
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const result = await importFromExcel(selectedEntity, buffer);

            if (result.success) {
                setImportResult(result.data);
                toast.success(`Imported ${selectedEntity} successfully! Reloading...`);
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error(`Import failed: ${result.error}`);
            }
        } catch (error) {
            toast.error(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        setImporting(false);
        // Reset file input
        e.target.value = '';
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Data Management</h2>
                <p style={{ color: 'var(--muted)' }}>Import and export data using Excel files</p>
            </header>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid var(--border)' }}>
                <button
                    onClick={() => setActiveTab('import')}
                    style={{
                        padding: '1rem 2rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'import' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === 'import' ? 'var(--primary)' : 'var(--muted)',
                        fontWeight: activeTab === 'import' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    <Upload size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Import Data
                </button>
                <button
                    onClick={() => setActiveTab('export')}
                    style={{
                        padding: '1rem 2rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'export' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === 'export' ? 'var(--primary)' : 'var(--muted)',
                        fontWeight: activeTab === 'export' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    <Download size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Export Data
                </button>
            </div>

            {/* Entity Selector */}
            <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Select Data Type</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    {(['products', 'customers', 'suppliers', 'users', 'sales'] as EntityType[]).map(entity => (
                        <button
                            key={entity}
                            onClick={() => setSelectedEntity(entity)}
                            className={selectedEntity === entity ? 'btn btn-primary' : 'btn btn-outline'}
                            style={{ textTransform: 'capitalize' }}
                        >
                            <FileSpreadsheet size={16} />
                            {entity}
                        </button>
                    ))}
                </div>
            </div>

            {/* Import Tab */}
            {activeTab === 'import' && (
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                        Import {selectedEntity.charAt(0).toUpperCase() + selectedEntity.slice(1)}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Step 1: Download Template */}
                        <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                Step 1: Download Template
                            </h4>
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                Download the Excel template with the correct column headers
                            </p>
                            <button
                                onClick={handleDownloadTemplate}
                                className="btn btn-outline"
                            >
                                <Download size={16} />
                                Download {selectedEntity} Template
                            </button>
                        </div>

                        {/* Step 2: Fill Template */}
                        <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                Step 2: Fill Template
                            </h4>
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                                Open the template in Excel, fill in your data, and save the file
                            </p>
                        </div>

                        {/* Step 3: Upload */}
                        <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                Step 3: Upload File
                            </h4>
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                Upload your filled template to import the data
                            </p>
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleImport}
                                disabled={importing}
                                style={{
                                    padding: '0.75rem',
                                    border: '2px dashed var(--border)',
                                    borderRadius: '8px',
                                    width: '100%',
                                    cursor: 'pointer'
                                }}
                            />
                            {importing && (
                                <div style={{ marginTop: '1rem', color: 'var(--primary)' }}>
                                    Importing... Please wait.
                                </div>
                            )}
                        </div>

                        {/* Import Results */}
                        {importResult && (
                            <div className="card" style={{
                                padding: '1.5rem',
                                background: importResult.errors?.length > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
                                border: `1px solid ${importResult.errors?.length > 0 ? 'var(--warning)' : 'var(--success)'}`
                            }}>
                                <h3 style={{
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    marginBottom: '1rem',
                                    color: importResult.errors?.length > 0 ? 'var(--warning)' : 'var(--success)'
                                }}>
                                    {importResult.errors?.length > 0 ? (
                                        <><AlertCircle size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />Import Completed with Warnings</>
                                    ) : (
                                        <><CheckCircle size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />Import Successful!</>
                                    )}
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Total Rows</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{importResult.total}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Imported</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                            {importResult.imported}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Skipped</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                                            {importResult.skipped}
                                        </div>
                                    </div>
                                </div>
                                {importResult.errors?.length > 0 && (
                                    <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                                        <strong>Errors:</strong>
                                        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                            {importResult.errors.slice(0, 5).map((err: string, i: number) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                        Export {selectedEntity.charAt(0).toUpperCase() + selectedEntity.slice(1)}
                    </h3>

                    <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
                        Export all {selectedEntity} data to an Excel file for backup or analysis
                    </p>

                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="btn btn-primary"
                        style={{ width: '100%', height: '3rem', fontSize: '1rem' }}
                    >
                        {exporting ? (
                            'Exporting...'
                        ) : (
                            <>
                                <Download size={20} />
                                Export {selectedEntity} to Excel
                            </>
                        )}
                    </button>

                    <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Export Info</h4>
                        <ul style={{ fontSize: '0.875rem', color: 'var(--muted)', paddingLeft: '1.5rem' }}>
                            <li>File format: Excel (.xlsx)</li>
                            <li>Includes all current data</li>
                            <li>Can be re-imported later</li>
                            <li>Filename includes export date</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
