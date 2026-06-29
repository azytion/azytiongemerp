'use client';

import { Users } from 'lucide-react';
import CustomersTab from './CustomersTab';
import { PaginatedResult } from '@/app/actions/types';
import { Customer } from '@/app/actions/customers';
import Link from 'next/link';
import { TrendingDown } from 'lucide-react';

interface CustomersClientPageProps {
  customersResult: PaginatedResult<Customer>;
  query: string;
  settings: Record<string, string>;
  page: number;
}

export default function CustomersClientPage({ customersResult, query, settings: _settings, page }: CustomersClientPageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: 36, height: 36, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="var(--info)" />
            </div>
            <h1 className="page-title">Customers</h1>
          </div>
          <p className="page-subtitle">Manage customer profiles and relationships</p>
        </div>
        <Link href="/customers/aging" className="btn btn-secondary btn-sm" style={{ gap: '0.375rem' }}>
          <TrendingDown size={14} /> Aging Report
        </Link>
      </header>
      <CustomersTab customersResult={customersResult} query={query} page={page} />
    </div>
  );
}
