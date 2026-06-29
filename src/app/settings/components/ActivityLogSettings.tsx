'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getActivityLog, getActivityStats } from '@/app/actions/activity-log';
import { formatDate } from '@/lib/utils';
import { getUsers } from '@/app/actions/users';
import { getSession } from '@/app/actions/auth';
import { User } from 'lucide-react';
import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';

export default function ActivityLogSettings() {
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<PaginatedResult<any> | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [page, setPage] = useState(1);
    const pageSize = 50;

    // Filters state
    const [filters, setFilters] = useState({
        userId: '',
        action: '',
        entityType: '',
        startDate: '',
        endDate: '',
        search: '',
    });
    const [users, setUsers] = useState<any[]>([]);
    const [_session, setSession] = useState<any>(null);

    const loadData = useCallback(async (targetPage: number = page) => {
        setLoading(true);
        try {
            const apiFilters = {
                userId: filters.userId ? Number(filters.userId) : undefined,
                action: filters.action || undefined,
                entityType: filters.entityType || undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                search: filters.search || undefined,
                page: targetPage,
                pageSize: pageSize
            };

            const [logsResult, statsData, usersData, sessionData] = await Promise.all([
                getActivityLog(apiFilters),
                getActivityStats(),
                getUsers(),
                getSession()
            ]);

            setResult(logsResult);
            setStats(statsData);
            setUsers(usersData.data);
            setSession(sessionData);
        } catch (error) {
            console.error("Error loading activity logs:", error);
        }
        setLoading(false);
    }, [filters, page, pageSize]);

    useEffect(() => { setPage(1); }, [filters]);
    useLoadEffect(() => loadData(1), [filters, loadData]);
    useLoadEffect(() => { if (page !== 1) void loadData(page); }, [page, loadData]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleClearFilters = () => {
        setFilters({
            userId: '',
            action: '',
            entityType: '',
            startDate: '',
            endDate: '',
            search: '',
        });
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'var(--success)';
            case 'UPDATE': return 'var(--primary)';
            case 'DELETE': return 'var(--destructive)';
            case 'LOGIN': return 'var(--info)';
            case 'LOGOUT': return 'var(--muted)';
            default: return 'var(--text)';
        }
    };

    if (loading && !stats) { // Show loading only on initial load or full reload if needed, but here we want to keep UI responsive
        // Actually, let's just show loading spinner if it's the first load
        return <div style={{ padding: '2rem' }}>Loading activity logs...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    User Activity Log
                </h2>
                <p style={{ color: 'var(--muted)' }}>Complete audit trail of all system activities</p>
            </header>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Total Activities</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total_activities}</div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Today</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {stats.today_activities}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Creates</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                            {stats.creates}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Updates</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {stats.updates}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Deletes</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--destructive)' }}>
                            {stats.deletes}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Active Users</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.active_users}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Filters</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label className="label">Search</label>
                        <input
                            type="text"
                            name="search"
                            className="input"
                            placeholder="Username or Action..."
                            value={filters.search}
                            onChange={handleFilterChange}
                        />
                    </div>
                    <div>
                        <label className="label">User</label>
                        <select name="userId" className="input" value={filters.userId} onChange={handleFilterChange}>
                            <option value="">All Users</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.username}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Action</label>
                        <select name="action" className="input" value={filters.action} onChange={handleFilterChange}>
                            <option value="">All Actions</option>
                            <option value="CREATE">Create</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                            <option value="LOGIN">Login</option>
                            <option value="LOGOUT">Logout</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Entity Type</label>
                        <select name="entityType" className="input" value={filters.entityType} onChange={handleFilterChange}>
                            <option value="">All Types</option>
                            <option value="product">Products</option>
                            <option value="sale">Sales</option>
                            <option value="customer">Customers</option>
                            <option value="supplier">Suppliers</option>
                            <option value="user">Users</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Start Date</label>
                        <input type="date" name="startDate" className="input" value={filters.startDate} onChange={handleFilterChange} />
                    </div>
                    <div>
                        <label className="label">End Date</label>
                        <input type="date" name="endDate" className="input" value={filters.endDate} onChange={handleFilterChange} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem' }}>
                        <button onClick={handleClearFilters} className="btn btn-outline" style={{ flex: 1 }}>
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* Activity Log Table */}
            <div className="card" style={{ padding: '1rem' }}>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                                <th>Entity Type</th>
                                <th>Entity ID</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!result || result.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                        No activity logs found
                                    </td>
                                </tr>
                            ) : (
                                result.data.map((log: any) => (
                                    <tr key={log.id}>
                                        <td style={{ fontSize: '0.875rem' }}>
                                            {formatDate(log.timestamp, { showTime: true })}
                                        </td>
                                        <td>
                                            <User size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                                            {log.username || 'Unknown'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                color: getActionColor(log.action),
                                                border: `1px solid ${getActionColor(log.action)}`
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ textTransform: 'capitalize' }}>{log.entity_type}</td>
                                        <td>{log.entity_id || 'N/A'}</td>
                                        <td style={{ fontSize: '0.875rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {log.new_values ? (
                                                <details>
                                                    <summary style={{ cursor: 'pointer', color: 'var(--primary)' }}>
                                                        View Changes
                                                    </summary>
                                                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            {JSON.stringify(JSON.parse(log.new_values), null, 2)}
                                                        </pre>
                                                    </div>
                                                </details>
                                            ) : (
                                                <span style={{ color: 'var(--muted)' }}>No details</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {result && (
                    <Pagination
                        currentPage={page}
                        totalPages={result.totalPages}
                        onPageChange={setPage}
                        totalItems={result.total}
                        pageSize={result.pageSize}
                    />
                )}
            </div>
        </div>
    );
}
