'use client';

import { useState, useEffect } from 'react';
import { getForecastingInsights, detectAnomalies, getDetailedBusinessReport } from '@/app/actions/ai';
import { Brain, TrendingUp, AlertTriangle, Package, RefreshCw, Send, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function AIInsightsDashboard() {
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<string | null>(null);
    const [anomalies, setAnomalies] = useState<string | null>(null);
    const [pulse, setPulse] = useState<string | null>(null);
    const [reorderSuggestions, setReorderSuggestions] = useState<any[]>([]);
    const [query, setQuery] = useState('');
    const [_report, setReport] = useState<any>(null);

    useEffect(() => {
        loadBaseStats();
    }, []);

    async function loadBaseStats() {
        const [reportRes, suggestions, pulseRes] = await Promise.all([
            getDetailedBusinessReport(),
            import('@/app/actions/ai').then(m => m.getSmartReorderSuggestions()),
            import('@/app/actions/ai').then(m => m.getDailyPulse())
        ]);

        setReport(reportRes);
        setReorderSuggestions(suggestions);
        if (pulseRes.success) setPulse(pulseRes.text || null);
    }

    async function handleAskAI(e?: React.FormEvent) {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        const res = await getForecastingInsights(query);
        setLoading(false);

        if (res.success) {
            setInsights(res.text || 'No insights generated.');
        } else {
            toast.error(res.error || 'Failed to get insights');
        }
    }

    async function handleDetectAnomalies() {
        setLoading(true);
        const res = await detectAnomalies();
        setLoading(false);

        if (res.success) {
            setAnomalies(res.text || 'No anomalies detected.');
        } else {
            toast.error(res.error || 'Failed to detect anomalies');
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)', color: '#fff', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                        <Brain size={32} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, color: '#fff' }}>Azytion GemERP Business Intelligence</h2>
                        <p style={{ opacity: 0.9 }}>Neural analysis of your sales, trends, and inventory.</p>
                    </div>
                </div>

                <form onSubmit={handleAskAI} style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: 'var(--radius)' }}>
                    <input
                        type="text"
                        placeholder="Ask Gemini: 'Forecast next week's sales' or 'Which stock should I reorder?'"
                        style={{ flex: 1, border: 'none', background: 'transparent', color: '#fff', padding: '0.75rem' }}
                        className="placeholder-white"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" disabled={loading} className="btn" style={{ background: '#fff', color: 'var(--primary)' }}>
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                        Analyze
                    </button>
                </form>
            </div>

            {pulse && (
                <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'var(--secondary)', opacity: 0.9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Brain size={24} className="text-primary" />
                        <div style={{ fontStyle: 'italic', color: 'var(--foreground)', fontSize: '0.95rem' }}>
                            <ReactMarkdown>{pulse}</ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* AI Forecasting/Answer Box */}
                <div className="card" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={20} className="text-primary" />
                            <h3 style={{ margin: 0 }}>Business Forecasting</h3>
                        </div>
                    </div>

                    {insights ? (
                        <div className="prose dark:prose-invert max-w-none" style={{ fontSize: '0.875rem' }}>
                            <ReactMarkdown>{insights}</ReactMarkdown>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textAlign: 'center' }}>
                            <HelpCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>Ask a question about your business trends above to see AI-driven forecasts.</p>
                        </div>
                    )}
                </div>

                {/* Anomalies & Security Box */}
                <div className="card" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={20} style={{ color: 'var(--destructive)' }} />
                            <h3 style={{ margin: 0 }}>Anomaly Detection</h3>
                        </div>
                        <button onClick={handleDetectAnomalies} disabled={loading} className="btn btn-outline" style={{ fontSize: '0.75rem' }}>
                            Scan for Issues
                        </button>
                    </div>

                    {anomalies ? (
                        <div className="prose dark:prose-invert max-w-none" style={{ fontSize: '0.875rem' }}>
                            <ReactMarkdown>{anomalies}</ReactMarkdown>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textAlign: 'center' }}>
                            <AlertTriangle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>Run a scan to detect suspicious activities, extreme discounts, or unusual voids.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Smart Reordering Suggestion */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Package size={20} style={{ color: '#f59e0b' }} />
                    <h3 style={{ margin: 0 }}>Smart Reordering (Low Stock Insight)</h3>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>On Hand</th>
                                <th>Velocity (Daily)</th>
                                <th>Runway (Days)</th>
                                <th>AI Suggestion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reorderSuggestions.slice(0, 5).map((p: any, i: number) => (
                                <tr key={i}>
                                    <td>{p.name}</td>
                                    <td>{p.stock}</td>
                                    <td>{p.velocity}</td>
                                    <td>
                                        <span style={{ color: p.runway < 7 ? 'var(--destructive)' : 'inherit' }}>
                                            {p.runway} days
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ padding: '0.25rem 0.5rem', background: 'var(--secondary)', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Brain size={12} /> Suggest order of <strong>{p.suggestion}</strong> units
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reorderSuggestions.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No reordering suggestions currently. High inventory levels detected.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
