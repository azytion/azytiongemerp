'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Package, ShoppingCart, Tag, ClipboardCheck, Boxes, Gem } from 'lucide-react';
import InventoryTab from './components/InventoryTab';
import PurchaseOrdersTab from './components/PurchaseOrdersTab';
import ProductsTab from './components/ProductsTab';
import StockTakeTab from './components/StockTakeTab';
import CategoriesTab from './components/CategoriesTab';
import LotManagementTab from './components/LotManagementTab';

type TabId = 'inventory' | 'purchase-orders' | 'products' | 'stock-take' | 'categories' | 'lots';

const VALID_TABS: TabId[] = ['inventory', 'purchase-orders', 'products', 'stock-take', 'categories', 'lots'];

export default function InventoryManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'inventory';

  const handleTabChange = (tabId: TabId) => {
    router.push(`/inventory-management?tab=${tabId}`, { scroll: false });
  };

  const tabs = [
    { id: 'inventory' as const,       label: 'Inventory',       icon: Boxes },
    { id: 'purchase-orders' as const, label: 'Purchase Orders', icon: ShoppingCart },
    { id: 'products' as const,        label: 'Products',        icon: Package },
    { id: 'categories' as const,      label: 'Categories',      icon: Tag },
    { id: 'stock-take' as const,      label: 'Stock Take',      icon: ClipboardCheck },
    { id: 'lots' as const,            label: 'Lot Tracking',    icon: Gem },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: 36, height: 36, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={18} color="var(--accent-amber)" />
            </div>
            <h1 className="page-title">Inventory Management</h1>
          </div>
          <p className="page-subtitle">Manage products, stock levels, purchase orders, and suppliers</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="page-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`page-tab-btn ${activeTab === tab.id ? 'active' : ''}`}>
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'inventory'       && <InventoryTab />}
        {activeTab === 'purchase-orders' && <PurchaseOrdersTab />}
        {activeTab === 'products'        && <ProductsTab />}
        {activeTab === 'categories'      && <CategoriesTab />}
        {activeTab === 'stock-take'      && <StockTakeTab />}
        {activeTab === 'lots'            && <LotManagementTab />}
      </div>
    </div>
  );
}
