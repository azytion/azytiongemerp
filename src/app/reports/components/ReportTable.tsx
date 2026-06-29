'use client';

import { FileText, X, ChevronRight, FileDown, FileSpreadsheet } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (value: any) => string;
}

interface ReportTableProps {
  title: string;
  columns: Column[];
  data: any[];
  exportFilename?: string;
  onRowClick?: (row: any) => void;
  drillDownColumns?: Column[];
  drillDownData?: (row: any) => Promise<any[]>;
  drillDownTitle?: (row: any) => string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    pageSize: number;
  };
}

export default function ReportTable({
  title, columns, data, exportFilename,
  onRowClick, drillDownColumns, drillDownData, drillDownTitle,
  pagination
}: ReportTableProps) {
  const [drillRow, setDrillRow] = useState<any | null>(null);
  const [drillRows, setDrillRows] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const handleExportExcel = () => {
    const rows = data.map(row => {
      const formatted: Record<string, any> = {};
      columns.forEach(col => {
        formatted[col.label] = col.format ? col.format(row[col.key]) : (row[col.key] ?? '');
      });
      return formatted;
    });
    void downloadRowsAsXlsx(rows, title.slice(0, 31), `${exportFilename || title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    try {
      const { generateGenericReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
      const { getSettings } = await import('@/app/actions/settings');
      const settings = await getSettings();

      const pdfColumns = columns.map(c => ({ label: c.label, align: c.align }));
      const pdfRows = data.map(row =>
        columns.map(col => {
          const val = col.format ? col.format(row[col.key]) : row[col.key];
          return val != null ? String(val) : '';
        })
      );

      const doc = generateGenericReportPDF(
        title,
        pdfColumns,
        pdfRows,
        buildCompanyInfo(settings)
      );

      downloadPDF(doc, `${exportFilename || title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
    }
  };

  const handleRowClick = async (row: any) => {
    if (onRowClick) { onRowClick(row); return; }
    if (!drillDownData || !drillDownColumns) return;
    setDrillRow(row);
    setDrillLoading(true);
    try {
      const rows = await drillDownData(row);
      setDrillRows(rows);
    } catch { setDrillRows([]); }
    setDrillLoading(false);
  };

  const isClickable = !!(onRowClick || drillDownData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{title}</h2>
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
          {isClickable && data.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ChevronRight size={12} /> Click row for details
            </span>
          )}
          {data.length > 0 && (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <button onClick={handleExportExcel} className="btn btn-secondary btn-sm" style={{ gap: '0.375rem', flex: '1 1 auto' }}>
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={handleExportPDF} className="btn btn-secondary btn-sm" style={{ gap: '0.375rem', flex: '1 1 auto' }}>
                <FileDown size={14} /> PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={FileText} title="No Data Available" description="No records found for the selected filters." />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} style={{ textAlign: col.align || 'left' }}>{col.label}</th>
                  ))}
                  {isClickable && <th style={{ width: 32 }} />}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleRowClick(row)}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  >
                    {columns.map(col => (
                      <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                        {col.format ? col.format(row[col.key]) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                    {isClickable && (
                      <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                        <ChevronRight size={14} color="var(--muted-foreground)" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!pagination && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', textAlign: 'right' }}>
              {data.length} record{data.length !== 1 ? 's' : ''}
            </div>
          )}

          {pagination && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.onPageChange}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
            />
          )}
        </>
      )}

      {/* Drill-down modal */}
      {drillRow && typeof window !== 'undefined' && createPortal(
        <div className="modal-blur-overlay" style={{ zIndex: 99999 }}>
          <div className="card" style={{ width: '100%', maxWidth: 760, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                {drillDownTitle ? drillDownTitle(drillRow) : 'Details'}
              </h3>
              <button className="btn-close" onClick={() => { setDrillRow(null); setDrillRows([]); }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {drillLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>
              ) : drillRows.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>No detail records found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      {(drillDownColumns || []).map(col => (
                        <th key={col.key} style={{ textAlign: col.align || 'left', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        {(drillDownColumns || []).map(col => (
                          <td key={col.key} style={{ padding: '0.75rem 1rem', textAlign: col.align || 'left', color: 'var(--foreground-2)' }}>
                            {col.format ? col.format(row[col.key]) : (row[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
