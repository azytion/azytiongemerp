'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { User, getUsers, createUser, updateUser, deleteUser } from '@/app/actions/users';
import { Plus, Edit, Trash2, X, Shield, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/utils';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const { confirm } = useConfirm();

    const loadUsers = useCallback(async () => {
        const data = await getUsers();
        setUsers(data.data);
    }, []);

    useLoadEffect(() => loadUsers(), [loadUsers]);

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
            toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
        } else {
            toast.error(res.error);
        }
        setLoading(false);
    }

    async function handleDelete(id: number) {
        if (!await confirm({ title: 'Delete User', message: 'Are you sure? This cannot be undone.', type: 'danger' })) return;
        const res = await deleteUser(id);
        if (res.success) {
            loadUsers();
            toast.success('User deleted successfully');
        } else {
            toast.error(res.error);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <style>{`
                @media (max-width: 640px) {
                    .users-col-dates { display: none; }
                    .users-header { flex-wrap: wrap; }
                    .users-header h1 { font-size: 1.375rem !important; white-space: normal !important; }
                }
            `}</style>
            <div className="users-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Staff Management</h1>
                    <p style={{ color: 'var(--muted)' }}>Manage users and roles</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                >
                    <Plus size={18} /> New User
                </button>
            </div>

            <div className="card table-wrapper" style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Role</th>
                            <th className="users-col-dates">Created At</th>
                            <th className="users-col-dates">Last Login</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td style={{ fontWeight: 500 }}>
                                    {user.role === 'admin' ? <Shield size={16} color="var(--primary)" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> : <ShieldAlert size={16} color="var(--muted)" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />}
                                    {user.username}
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    <span style={{
                                        background: user.role === 'admin' ? 'rgba(37,99,235,0.1)' : 'var(--secondary)',
                                        color: user.role === 'admin' ? 'var(--primary)' : 'var(--muted)',
                                        padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                        textTransform: 'capitalize'
                                    }}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="users-col-dates" style={{ fontSize: '0.875rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                    {formatDate(user.created_at || new Date(), { showTime: false })}
                                </td>
                                <td className="users-col-dates" style={{ fontSize: '0.875rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                    {user.last_login ? formatDate(user.last_login) : 'Never'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '0.25rem 0.5rem' }}
                                            onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            className="btn btn-destructive"
                                            style={{ padding: '0.25rem 0.5rem' }}
                                            onClick={() => handleDelete(user.id)}
                                            disabled={user.id === 1}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3>{editingUser ? 'Edit User' : 'New User'}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none' }}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {!editingUser && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Username</label>
                                    <input name="username" type="text" className="input" required />
                                </div>
                            )}

                            {editingUser && (
                                <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--muted)' }}>
                                    Editing user: <strong>{editingUser.username}</strong>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {editingUser ? 'New Password (leave blank to keep)' : 'Password'}
                                </label>
                                <input name="password" type="password" className="input" required={!editingUser} />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Role</label>
                                <select
                                    name="role"
                                    className="input"
                                    defaultValue={editingUser?.role || 'cashier'}
                                >
                                    <option value="cashier">Cashier</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                                {loading ? 'Saving...' : 'Save User'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
