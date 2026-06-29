'use client';

import { useState, useMemo } from 'react';
import { Calculator, Gem, Info, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type GemType = 'diamond' | 'ruby' | 'emerald' | 'sapphire' | 'other';
type CutGrade = 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Poor';
type ClarityGrade = 'FL' | 'IF' | 'VVS1' | 'VVS2' | 'VS1' | 'VS2' | 'SI1' | 'SI2' | 'I1' | 'I2' | 'I3';
type ColorGrade = 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';

// Simplified multipliers for estimation purposes
const BASE_PRICE_PER_CARAT: Record<GemType, number> = {
  diamond: 5000,
  ruby: 3000,
  emerald: 2500,
  sapphire: 2000,
  other: 500,
};

const CUT_MULTIPLIER: Record<CutGrade, number> = {
  Excellent: 1.3, 'Very Good': 1.15, Good: 1.0, Fair: 0.85, Poor: 0.7,
};

const CLARITY_MULTIPLIER: Record<ClarityGrade, number> = {
  FL: 2.0, IF: 1.8, VVS1: 1.5, VVS2: 1.4, VS1: 1.25, VS2: 1.15,
  SI1: 1.0, SI2: 0.9, I1: 0.75, I2: 0.6, I3: 0.5,
};

const COLOR_MULTIPLIER: Record<ColorGrade, number> = {
  D: 2.0, E: 1.8, F: 1.6, G: 1.4, H: 1.2, I: 1.05,
  J: 0.95, K: 0.85, L: 0.75, M: 0.65,
};

const CARAT_WEIGHT_MULTIPLIER = (carat: number) => {
  if (carat < 0.5) return 0.7;
  if (carat < 1.0) return 0.9;
  if (carat < 2.0) return 1.0;
  if (carat < 3.0) return 1.3;
  if (carat < 5.0) return 1.6;
  return 2.0;
};

export default function GemCalculatorPage() {
  const [gemType, setGemType] = useState<GemType>('diamond');
  const [caratWeight, setCaratWeight] = useState('1.00');
  const [cutGrade, setCutGrade] = useState<CutGrade>('Very Good');
  const [clarityGrade, setClarityGrade] = useState<ClarityGrade>('VS1');
  const [colorGrade, setColorGrade] = useState<ColorGrade>('G');
  const [treatment, setTreatment] = useState('none');
  const [origin, setOrigin] = useState('');
  const [marginPercent, setMarginPercent] = useState('40');
  const [_currency, _setCurrency] = useState('USD');

  const carat = parseFloat(caratWeight) || 0;

  const estimate = useMemo(() => {
    if (!carat || carat <= 0) return null;

    const base = BASE_PRICE_PER_CARAT[gemType];
    const cutM = CUT_MULTIPLIER[cutGrade];
    const clarityM = CLARITY_MULTIPLIER[clarityGrade];
    const colorM = gemType === 'diamond' ? COLOR_MULTIPLIER[colorGrade] : 1.0;
    const caratM = CARAT_WEIGHT_MULTIPLIER(carat);
    const treatmentM = treatment === 'none' ? 1.0 : treatment === 'minor' ? 0.85 : 0.7;
    const originM = origin.toLowerCase().includes('burma') || origin.toLowerCase().includes('myanmar') ? 1.3
      : origin.toLowerCase().includes('colombia') ? 1.25
      : origin.toLowerCase().includes('kashmir') ? 1.4
      : 1.0;

    const costPerCarat = base * cutM * clarityM * colorM * caratM * treatmentM * originM;
    const totalCost = costPerCarat * carat;
    const margin = parseFloat(marginPercent) / 100 || 0.4;
    const sellingPrice = totalCost * (1 + margin);
    const profit = sellingPrice - totalCost;

    return {
      costPerCarat,
      totalCost,
      sellingPrice,
      profit,
      margin: margin * 100,
    };
  }, [gemType, carat, cutGrade, clarityGrade, colorGrade, treatment, origin, marginPercent]);

  const reset = () => {
    setGemType('diamond');
    setCaratWeight('1.00');
    setCutGrade('Very Good');
    setClarityGrade('VS1');
    setColorGrade('G');
    setTreatment('none');
    setOrigin('');
    setMarginPercent('40');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'var(--primary-subtle)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calculator size={18} color="var(--primary)" />
            </div>
            <h1 className="page-title">Gem Price Calculator</h1>
          </div>
          <p className="page-subtitle">Estimate gemstone value based on the 4Cs and market factors</p>
        </div>
        <button onClick={reset} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Reset
        </button>
      </header>

      {/* Disclaimer */}
      <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>This calculator provides <strong>estimates only</strong> based on simplified market multipliers. Actual gemstone values depend on current market conditions, specific characteristics, and professional grading. Always consult a certified gemologist for accurate valuations.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}
        className="gem-calc-grid">
        {/* Input Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Gem Specifications</h3>

          <div className="form-group">
            <label>Gem Type</label>
            <select value={gemType} onChange={e => setGemType(e.target.value as GemType)}>
              <option value="diamond">Diamond</option>
              <option value="ruby">Ruby</option>
              <option value="emerald">Emerald</option>
              <option value="sapphire">Sapphire</option>
              <option value="other">Other Gemstone</option>
            </select>
          </div>

          <div className="form-group">
            <label>Carat Weight</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={caratWeight}
                onChange={e => setCaratWeight(e.target.value)}
                min="0.01"
                step="0.01"
                placeholder="e.g. 1.50"
                style={{ paddingRight: '3rem' }}
              />
              <span style={{
                position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600,
              }}>ct</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Cut Grade</label>
              <select value={cutGrade} onChange={e => setCutGrade(e.target.value as CutGrade)}>
                {Object.keys(CUT_MULTIPLIER).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Clarity</label>
              <select value={clarityGrade} onChange={e => setClarityGrade(e.target.value as ClarityGrade)}>
                {Object.keys(CLARITY_MULTIPLIER).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {gemType === 'diamond' && (
            <div className="form-group">
              <label>Color Grade (Diamond)</label>
              <select value={colorGrade} onChange={e => setColorGrade(e.target.value as ColorGrade)}>
                {Object.keys(COLOR_MULTIPLIER).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Treatment</label>
            <select value={treatment} onChange={e => setTreatment(e.target.value)}>
              <option value="none">None (Natural)</option>
              <option value="minor">Minor Treatment</option>
              <option value="significant">Significant Treatment</option>
            </select>
          </div>

          <div className="form-group">
            <label>Origin (optional)</label>
            <input
              type="text"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder="e.g. Burma, Colombia, Kashmir..."
            />
          </div>

          <div className="form-group">
            <label>Profit Margin (%)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={marginPercent}
                onChange={e => setMarginPercent(e.target.value)}
                min="0"
                max="500"
                step="5"
                style={{ paddingRight: '3rem' }}
              />
              <span style={{
                position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600,
              }}>%</span>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {estimate ? (
            <>
              {/* Main Result */}
              <div className="gem-card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  Estimated Selling Price
                </div>
                <div style={{
                  fontSize: '2.5rem', fontWeight: 900,
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.03em',
                  marginBottom: '0.5rem',
                }}>
                  {formatCurrency(estimate.sellingPrice)}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                  {carat} carat {gemType}
                </div>
              </div>

              {/* Breakdown */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Price Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {[
                    { label: 'Base Cost / Carat', value: formatCurrency(estimate.costPerCarat), color: 'var(--foreground)' },
                    { label: 'Total Cost', value: formatCurrency(estimate.totalCost), color: 'var(--foreground)' },
                    { label: `Profit (${estimate.margin.toFixed(0)}%)`, value: formatCurrency(estimate.profit), color: 'var(--success)' },
                    { label: 'Selling Price', value: formatCurrency(estimate.sellingPrice), color: 'var(--primary)', bold: true },
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      background: i === 3 ? 'var(--primary-subtle)' : 'var(--surface-2)',
                      borderRadius: 'var(--radius)',
                      border: i === 3 ? '1px solid rgba(212,175,55,0.2)' : '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{row.label}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: row.bold ? 800 : 600, color: row.color }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Factors */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.875rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Value Factors
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { label: 'Cut', value: cutGrade },
                    { label: 'Clarity', value: clarityGrade },
                    ...(gemType === 'diamond' ? [{ label: 'Color', value: colorGrade }] : []),
                    { label: 'Treatment', value: treatment === 'none' ? 'Natural' : treatment === 'minor' ? 'Minor' : 'Significant' },
                    ...(origin ? [{ label: 'Origin', value: origin }] : []),
                  ].map((f, i) => (
                    <div key={i} style={{
                      padding: '0.5rem 0.75rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: '0.625rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)', marginTop: '0.125rem' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <Gem size={48} color="var(--primary)" style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                Enter gem specifications to see the estimated value
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
