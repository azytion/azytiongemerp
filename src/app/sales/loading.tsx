import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Sales History</h1>
                    <p style={{ color: 'var(--muted)' }}>View and manage past transactions</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Skeleton style={{ width: '120px', height: '40px' }} />
                    <Skeleton style={{ width: '120px', height: '40px' }} />
                </div>
            </header>

            <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                <Skeleton style={{ flex: 1, height: '40px' }} />
                <Skeleton style={{ width: '40px', height: '40px' }} />
            </div>

            <div className="card table-wrapper">
                <table style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '1rem' }}><Skeleton style={{ width: '80px', height: '16px' }} /></th>
                            <th style={{ padding: '1rem' }}><Skeleton style={{ width: '120px', height: '16px' }} /></th>
                            <th style={{ padding: '1rem' }}><Skeleton style={{ width: '100px', height: '16px' }} /></th>
                            <th style={{ padding: '1rem' }}><Skeleton style={{ width: '80px', height: '16px' }} /></th>
                            <th style={{ padding: '1rem' }}><Skeleton style={{ width: '100px', height: '16px' }} /></th>
                            <th style={{ padding: '1rem', textAlign: 'right' }}><Skeleton style={{ width: '80px', height: '16px', marginLeft: 'auto' }} /></th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}><Skeleton style={{ width: '80px', height: '16px', margin: '0 auto' }} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem' }}><Skeleton style={{ width: '60px', height: '16px' }} /></td>
                                <td style={{ padding: '1rem' }}><Skeleton style={{ width: '140px', height: '16px' }} /></td>
                                <td style={{ padding: '1rem' }}><Skeleton style={{ width: '100px', height: '16px' }} /></td>
                                <td style={{ padding: '1rem' }}><Skeleton style={{ width: '60px', height: '16px' }} /></td>
                                <td style={{ padding: '1rem' }}><Skeleton style={{ width: '80px', height: '16px' }} /></td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}><Skeleton style={{ width: '80px', height: '16px', marginLeft: 'auto' }} /></td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}><Skeleton style={{ width: '80px', height: '32px', margin: '0 auto', borderRadius: '16px' }} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
