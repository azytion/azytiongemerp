'use client';

import { Users2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Brokers management has been moved to the dedicated /brokers page
// This tab now redirects there for a cleaner UX
export default function BrokersTab() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1.5rem', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users2 size={32} color="var(--accent-purple)" />
            </div>
            <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Brokers Moved</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.6 }}>
                    Broker management and commission tracking have been consolidated into a dedicated page for a better experience.
                </p>
            </div>
            <Link href="/brokers" className="btn btn-primary" style={{ gap: '0.5rem' }}>
                <Users2 size={16} /> Go to Brokers Page <ArrowRight size={16} />
            </Link>
        </div>
    );
}
