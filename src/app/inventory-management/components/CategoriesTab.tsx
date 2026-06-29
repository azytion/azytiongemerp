'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { deleteCategory, getCategories, createCategory, type Category } from '@/app/actions/categories';
import Modal from '@/components/ui/Modal';
import { Tag, Plus, Trash2, Edit2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';
import { useConfirm } from '@/components/ConfirmDialog';

export default function CategoriesTab() {
    const [result, setResult] = useState<PaginatedResult<any> | null>(null);
    const [loadingData, setLoadingData] = useState(true); // Renamed to avoid conflict with form loading
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [loading, setLoading] = useState(false); // For form submission
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const { confirm } = useConfirm();

    const loadData = useCallback(async (targetPage: number = page) => {
        setLoadingData(true);
        const res = await getCategories(searchQuery, targetPage, pageSize);
        setResult(res);
        setLoadingData(false);
    }, [searchQuery, page, pageSize]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            void loadData(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, loadData]);

    useEffect(() => {
        if (page !== 1) void loadData(page);
    }, [page, loadData]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget as HTMLFormElement);

        const res = await createCategory(formData);
        if (res.success) {
            toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully');
            setIsModalOpen(false);
            setEditingCategory(null);
            loadData();
        } else {
            toast.error(res.error || 'Failed to save category');
        }
        setLoading(false);
    }

    async function handleDeleteCategory(id: number) {
        if (!await confirm({
            title: 'Delete Category?',
            message: 'Are you sure? This will not work if products are using this category.',
            confirmText: 'Delete',
            type: 'danger'
        })) return;

        const res = await deleteCategory(id);
        if (res.success) {
            toast.success('Category deleted successfully');
            loadData();
        } else {
            toast.error(res.error || 'Failed to delete category');
        }
    }

    const categories = result?.data || [];
    const pageIds = categories.map(cat => cat.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Categories',
            message: `Delete ${selectedIds.length} selected categor${selectedIds.length === 1 ? 'y' : 'ies'}? Categories used by products will be skipped.`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deleteCategory(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await loadData();
        if (failed.length) toast.error(`${failed.length} categor${failed.length === 1 ? 'y was' : 'ies were'} not deleted`);
        else toast.success('Selected categories deleted');
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Product Categories</h2>
                    <p style={{ color: 'var(--muted)' }}>Organize your products into categories</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                    <button onClick={() => { setEditingCategory(null); setIsModalOpen(true); }} className="btn btn-primary" style={{ width: 'auto' }}>
                        <Plus size={20} />
                        Add Category
                    </button>
                </div>
            </header>

            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        className="input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                </th>
                                <th>Name</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingData ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading categories...</td></tr>
                            ) : categories.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No categories found</td></tr>
                            ) : (
                                categories.map(cat => (
                                    <tr key={cat.id} style={{ background: selectedIds.includes(cat.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                        <td style={{ width: 40 }}>
                                            <input type="checkbox" checked={selectedIds.includes(cat.id)} onChange={() => toggleSelect(cat.id)} style={{ cursor: 'pointer' }} />
                                        </td>
                                        <td style={{ fontWeight: '500' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Tag size={16} style={{ color: 'var(--primary)' }} />
                                                {cat.name}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{cat.description || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                                                className="btn btn-ghost"
                                                style={{ color: 'var(--primary)', padding: '0.5rem' }}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="btn btn-ghost"
                                                style={{ color: 'var(--destructive)', padding: '0.5rem' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
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

            {/* Add/Edit Category Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingCategory(null); }}
                title={editingCategory ? 'Edit Category' : 'New Category'}
                maxWidth="400px"
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Category Name</label>
                        <input
                            name="name"
                            type="text"
                            className="input"
                            defaultValue={editingCategory?.name || ''}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Description</label>
                        <textarea
                            name="description"
                            className="input"
                            defaultValue={editingCategory?.description || ''}
                            rows={3}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? 'Saving...' : 'Save Category'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
