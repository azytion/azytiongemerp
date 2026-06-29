'use client';

import { GemStockReportData } from '@/app/actions/reports_gem';
import { formatCurrency } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getGemStockReport } from '@/app/actions/reports_gem';
import { generateGemStockReportPDF, downloadPDF, buildCompanyInfo } from '@/lib/pdf-generator';
import { getSettings } from '@/app/actions/settings';
import { toast } from 'sonner';
import { Download, Gem, Layers, Scale, DollarSign, Calendar, TrendingUp } from 'lucide-react';

export default function GemStockReportView() {
    const [data, setData] = useState<GemStockReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const report = await getGemStockReport();
            setData(report);
        } catch (error) {
            console.error('Failed to load gem stock report', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!data) return;
        setGenerating(true);
        try {
            const settings = await getSettings();
            const companyInfo = buildCompanyInfo(settings);

            const doc = generateGemStockReportPDF(data, companyInfo);
            downloadPDF(doc, `Gem_Stock_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('Report downloaded');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', minHeight: '400px' }}>
            <div style={{ position: 'relative' }}>
                <div style={{
                    width: '3rem', height: '3rem', border: '2px solid transparent',
                    borderTopColor: 'var(--primary)', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
            </div>
        </div>
    );

    if (!data) return (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--error)', background: 'var(--error-light)', padding: '1rem', borderRadius: '0.5rem', display: 'inline-block' }}>
                Failed to load data
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header Section */}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--foreground)' }}>
                        <span style={{
                            padding: '0.5rem', background: 'rgba(139, 92, 246, 0.1)',
                            color: '#8b5cf6', borderRadius: '0.5rem', display: 'flex', alignItems: 'center'
                        }}>
                            <Gem size={24} />
                        </span>
                        Gemstone Stock Report
                    </h2>
                    <p style={{ color: 'var(--muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <Calendar size={14} />
                        Generated: {new Date(data.generated_at).toLocaleString()}
                    </p>
                </div>
                <button
                    onClick={handlePrint}
                    disabled={generating}
                    className="btn btn-primary"
                    style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    {generating ? 'Generating...' : <><Download size={18} /> Download PDF Report</>}
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {/* Total Item Count */}
                <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>
                        <Layers size={18} style={{ color: '#8b5cf6' }} />
                        Total Inventory
                    </div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--foreground)' }}>
                        {data.grand_total.count}
                        <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 500, marginLeft: '0.5rem' }}>Pcs</span>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 500 }}>
                        <TrendingUp size={14} /> Active Stock
                    </div>
                </div>

                {/* Total Weight */}
                <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>
                        <Scale size={18} style={{ color: 'var(--primary)' }} />
                        Total Weight
                    </div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--foreground)' }}>
                        {data.grand_total.weight.toFixed(2)}
                        <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 500, marginLeft: '0.5rem' }}>Cts</span>
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
                        Combined carat weight
                    </div>
                </div>

                {/* Total Value */}
                <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>
                        <DollarSign size={18} style={{ color: '#10b981' }} />
                        Total Valuation
                    </div>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${data.currency_symbol}${formatCurrency(data.grand_total.value)}`}>
                        <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 500, marginRight: '0.25rem' }}>{data.currency_symbol}</span>
                        {formatCurrency(data.grand_total.value)}
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
                        Current asset value
                    </div>
                </div>
            </div>

            {/* Grouped Tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {data.groups.map((group, idx) => (
                    <div key={idx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Card Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
                            background: 'var(--secondary)', display: 'flex', flexWrap: 'wrap',
                            justifyContent: 'space-between', alignItems: 'center', gap: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{
                                    width: '3rem', height: '3rem', borderRadius: '0.75rem',
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#8b5cf6'
                                }}>
                                    <Gem size={20} />
                                </span>
                                <div>
                                    <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'var(--foreground)' }}>
                                        {group.category}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <span style={{
                                            padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                                            fontSize: '0.75rem', fontWeight: 600,
                                            background: 'rgba(0,0,0,0.05)', color: 'var(--muted)',
                                            textTransform: 'uppercase', letterSpacing: '0.05em'
                                        }}>
                                            {group.shape}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Header Stats */}
                            <div style={{ display: 'flex', gap: '2rem' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', color: 'var(--muted)', marginBottom: '0.25rem' }}>Qty</div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{group.total.count}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', color: 'var(--muted)', marginBottom: '0.25rem' }}>Weight</div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{group.total.weight.toFixed(2)}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', color: 'var(--muted)', marginBottom: '0.25rem' }}>Value</div>
                                    <div style={{ fontWeight: 'bold', color: '#10b981' }}>{data.currency_symbol}{formatCurrency(group.total.value)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', color: 'var(--muted)' }}>Weight Range</th>
                                        <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', color: 'var(--muted)' }}>Pieces</th>
                                        <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', color: 'var(--muted)' }}>Weight (cts)</th>
                                        <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', color: 'var(--muted)' }}>Total Value</th>
                                        <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', color: 'var(--muted)' }}>Avg Price/Ct</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(group.ranges).map(([range, stats]) => {
                                        if (stats.count === 0) return null;
                                        const avgPricePerCarat = stats.weight > 0 ? stats.value / stats.weight : 0;
                                        return (
                                            <tr key={range} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                                                <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--foreground)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#8b5cf6' }}></div>
                                                        {range} cts
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 500, color: 'var(--muted)' }}>{stats.count}</td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--muted)' }}>{stats.weight.toFixed(2)}</td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--foreground)' }}>
                                                    {data.currency_symbol}{formatCurrency(stats.value)}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--muted)', fontSize: '0.75rem' }}>
                                                    {data.currency_symbol}{formatCurrency(avgPricePerCarat)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {data.groups.length === 0 && (
                    <div className="card" style={{ padding: '5rem', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}>
                        <div style={{ width: '5rem', height: '5rem', borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Gem size={40} style={{ color: 'var(--muted)' }} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '0.5rem' }}>No Stock Available</h3>
                        <p style={{ color: 'var(--muted)', maxWidth: '24rem', margin: '0 auto' }}>
                            Gemstone inventory is currently empty. Add items to your inventory to see the stock report here.
                        </p>
                    </div>
                )}
            </div>
        </div >
    );
}
