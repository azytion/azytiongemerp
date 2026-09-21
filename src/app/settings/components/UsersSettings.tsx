'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { User, getUsers, createUser, updateUser, deleteUser } from '@/app/actions/users';
import { getSession } from '@/app/actions/auth';
import { Plus, Edit, Trash2, X, Shield, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

export default function UsersSettings() {
    const [usersResult, setUsersResult] = useState<PaginatedResult<User> | null>(null);
    const [usersPage, setUsersPage] = useState(1);
    const pageSize = 20;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [_session, setSession] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const { confirm } = useConfirm();

    const loadData = useCallback(async () => {
        const sessionData = await getSession();
        setSession(sessionData);
    }, []);

    const loadUsers = useCallback(async (page: number = usersPage) => {
        const res = await getUsers(page, pageSize, searchQuery, roleFilter);
        setUsersResult(res);
    }, [usersPage, pageSize, searchQuery, roleFilter]);

    useLoadEffect(() => loadData(), [loadData]);

    useEffect(() => {
        const timer = window.setTimeout(() => { void loadUsers(usersPage); }, 300);
        return () => window.clearTimeout(timer);
    }, [usersPage, searchQuery, roleFilter, loadUsers]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        let res;
        if (editingUser) {
            formData.append('id', editingUser.id.toString());
            res = await updateUser(formData);
        } else {
            res = await createUser(formData);
        }
        if (res.success) {
            await loadUsers();
            setIsModalOpen(false);
            setEditingUser(null);
            toast.success(editingUser ? 'User updated successfully!' : 'User created successfully!');
        } else {
            toast.error(res.error);
        }
        setLoading(false);
    }

    async function handleDelete(id: number) {
        if (!await confirm({ title: 'Delete User', message: 'Permanently delete this user? Their sales history will be reassigned to admin.', type: 'danger' })) return;
        const res = await deleteUser(id);
        if (res.success) {
            loadUsers();
            toast.success((res as any).message || 'User deleted successfully');
        } else {
            toast.error(res.error);
        }
    }

    const users = usersResult?.data || [];
    const selectableIds = users.filter(user => user.id !== 1 && user.username !== 'azytionlk' && user.role !== 'super_admin').map(user => user.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !selectableIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...selectableIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Users',
            message: `Permanently delete ${selectedIds.length} selected user${selectedIds.length === 1 ? '' : 's'}? Sales history will be reassigned according to existing rules.`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deleteUser(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await loadUsers();
        if (failed.length) toast.error(`${failed.length} user${failed.length === 1 ? '' : 's'} could not be deleted`);
        else toast.success('Selected users deleted');
    }

    const roleColors: Record<string, { bg: string; color: string }> = {
        admin:       { bg: 'rgba(212,175,55,0.1)',  color: 'var(--primary)' },
        manager:     { bg: 'rgba(124,58,237,0.1)',  color: '#7c3aed' },
        cashier:     { bg: 'rgba(5,150,105,0.1)',   color: '#059669' },
        staff:       { bg: 'rgba(100,116,139,0.1)', color: 'var(--muted-foreground)' },
        super_admin: { bg: 'rgba(212,175,55,0.15)', color: 'var(--primary)' },
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>System Users</h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                        Manage user accounts and access roles
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {selectedIds.length > 0 && (
                        <>
                            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
                                <X size={14} /> {selectedIds.length} selected
                            </button>
                            <button onClick={handleBulkDelete} disabled={deletingSelected} className="btn btn-destructive btn-sm">
                                <Trash2 size={14} /> {deletingSelected ? 'Deleting...' : `Delete (${selectedIds.length})`}
                            </button>
                        </>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingUser(null); setIsModalOpen(true); }}>
                        <Plus size={15} /> New User
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                    <Search size={15} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by username..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setUsersPage(1); }}
                    />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setUsersPage(1); }}
                            style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={14} color="var(--muted-foreground)" />
                    <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setUsersPage(1); }}
                        style={{ height: '2.5rem', minWidth: 130, borderRadius: 'var(--radius-full)', paddingRight: '2rem' }}>
                        <option value="all">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="cashier">Cashier</option>
                        <option value="staff">Staff</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                            </th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Last Login</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!usersResult?.data.length ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>No users found</td></tr>
                        ) : usersResult.data.map(user => {
                            const rc = roleColors[user.role] || roleColors.staff;
                            const canSelect = user.id !== 1 && user.username !== 'azytionlk' && user.role !== 'super_admin';
                            return (
                                <tr key={user.id} style={{ background: selectedIds.includes(user.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                    <td style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(user.id)}
                                            onChange={() => toggleSelect(user.id)}
                                            disabled={!canSelect}
                                            style={{ cursor: canSelect ? 'pointer' : 'not-allowed' }}
                                        />
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: rc.color, flexShrink: 0 }}>
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.username}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ background: rc.bg, color: rc.color, padding: '0.2rem 0.625rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                            {user.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                                        {formatDate(user.created_at || '', { showTime: false })}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                                        {user.last_login ? formatDate(user.last_login) : 'Never'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}
                                                onClick={() => { setEditingUser(user); setIsModalOpen(true); }}>
                                                <Edit size={13} />
                                            </button>
                                            <button className="btn btn-sm" style={{ padding: '0.25rem 0.5rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--destructive)' }}
                                                onClick={() => handleDelete(user.id)}
                                                disabled={user.id === 1}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {usersResult && usersResult.totalPages > 1 && (
                <Pagination currentPage={usersPage} totalPages={usersResult.totalPages} onPageChange={setUsersPage} totalItems={usersResult.total} pageSize={usersResult.pageSize} />
            )}

            {/* User Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'New User'} maxWidth="420px">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Username</label>
                        <input name="username" type="text" className="input" defaultValue={editingUser?.username || ''} required />
                    </div>
                    <div className="form-group">
                        <label>{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                        <input name="password" type="password" className="input" required={!editingUser} />
                    </div>
                    {editingUser?.username === 'azytionlk' ? (
                        <div className="form-group">
                            <label>Role</label>
                            <div style={{ padding: '0.625rem 1rem', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 'var(--radius)', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={15} /> Super Admin (Locked)
                            </div>
                            <input type="hidden" name="role" value="super_admin" />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>Role</label>
                            <select name="role" className="input" defaultValue={editingUser?.role || 'cashier'}>
                                <option value="cashier">Cashier — POS access</option>
                                <option value="manager">Manager — Reports + POS</option>
                                <option value="admin">Admin — Full Access</option>
                            </select>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
                        {loading ? 'Saving...' : 'Save User'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
