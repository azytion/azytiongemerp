'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import { formatCurrency, formatDate } from '@/lib/utils';
import { PaginatedResult } from '@/app/actions/types';

import { useEffect, useState } from 'react';
import ReportLayout from './components/ReportLayout';
import ReportTable from './components/ReportTable';
import StaffPerformanceDashboard from './components/StaffPerformanceDashboard';
import StaffProductivityTab from './components/StaffProductivityTab';
import SalesTrendsTab from './components/SalesTrendsTab';
import InventoryAnalyticsTab from './components/InventoryAnalyticsTab';
import AIInsightsDashboard from './components/AIInsightsDashboard';
import GemStockReportView from './components/GemStockReportView';
import {
    getStatementReport,
    getTransactionsReport,
    getPayablesReport,
    getReceivablesReport,
    getItemListReport,
    getSupplierWiseReport,
    getReorderLevelReport,
    getPurchaseOrderReport,
    getSoldItemsReport,
    getTypeWiseReport,
    getAdjustmentReport,
    getActivityLogReport,
    getBalanceSheetReport,
    getIncomeStatementReport,
    getCashFlowReport,
    getSaleItemsDrillDown,
    getCustomerSalesDrillDown,
    getSupplierPurchasesDrillDown,
    getProductSalesDrillDown,
    type DateRange
} from '../actions/reports_comprehensive';
import {
    getCustomerListReport,
    getCustomerPurchaseHistoryReport,
    getCustomerOutstandingReport,
    getSupplierListReport,
    getSupplierPurchaseHistoryReport,
    getSupplierOutstandingReport,
    getSalesInvoicesReport,
    getPurchaseInvoicesReport,
    getCreditNotesReport,
    getChequesInHandReport,
    getTodayReceivedChequesReport,
    getTodayDatedChequesReport,
    getBouncedChequesReport,
    getReceivedPartyChequesReport,
    getReceivedOwnChequesReport,
    getGivenPartyChequesReport,
    getGivenOwnChequesReport
} from '../actions/reports_extended';
import { getTopSellingItems, getInventoryValuation } from '../actions/analytics';
import { getGemOriginReport, getCaratAnalysisReport, getGemTreatmentReport } from '../actions/reports_gem';

const TABS = [
    {
        id: 'main',
        label: 'Main',
        subTabs: [
            { id: 'analytics', label: 'Analytics' },
            { id: 'statement', label: 'Statement' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'payables', label: 'Payables' },
            { id: 'receivables', label: 'Receivables' }
        ]
    },
    {
        id: 'inventory',
        label: 'Inventory',
        subTabs: [
            { id: 'analytics', label: 'Analytics' },
            { id: 'item_list', label: 'Item List' },
            { id: 'stock_adjustments', label: 'Stock Adjustments' },
            { id: 'supplier_wise', label: 'Supplier Wise' },
            { id: 'reorder_level', label: 'Re-order Level' },
            { id: 'purchase_order', label: 'Purchase Order' },
            { id: 'sold_items', label: 'Sold Items' },
            { id: 'type_wise', label: 'Type Wise' }
        ]
    },
    {
        id: 'finance',
        label: 'Finance',
        subTabs: [
            { id: 'balance_sheet', label: 'Balance Sheet' },
            { id: 'income_statement', label: 'Income Statement' },
            { id: 'cash_flow', label: 'Cash Flow' }
        ]
    },
    {
        id: 'customer',
        label: 'Customer',
        subTabs: [
            { id: 'customer_list', label: 'Customer List' },
            { id: 'purchase_history', label: 'Purchase History' },
            { id: 'outstanding', label: 'Outstanding' }
        ]
    },
    {
        id: 'supplier',
        label: 'Supplier',
        subTabs: [
            { id: 'supplier_list', label: 'Supplier List' },
            { id: 'purchase_history', label: 'Purchase History' },
            { id: 'outstanding', label: 'Outstanding' }
        ]
    },
    {
        id: 'invoicing',
        label: 'Invoicing',
        subTabs: [
            { id: 'sales_invoices', label: 'Sales Invoices' },
            { id: 'purchase_invoices', label: 'Purchase Invoices' },
            { id: 'credit_notes', label: 'Credit Notes' }
        ]
    },
    {
        id: 'cheques',
        label: 'Cheques',
        subTabs: [
            { id: 'in_hand', label: 'Cheques in Hand' },
            { id: 'today_received', label: 'Today Received' },
            { id: 'today_dated', label: 'Today Dated' },
            { id: 'bounced', label: 'Bounced Cheques' },
            { id: 'received_party', label: 'Received Party' },
            { id: 'received_own', label: 'Received Own' },
            { id: 'given_party', label: 'Given Party' },
            { id: 'given_own', label: 'Given Own' }
        ]
    },
    {
        id: 'staff',
        label: 'Staff',
        subTabs: [
            { id: 'performance', label: 'Performance' },
            { id: 'productivity', label: 'Productivity' }
        ]
    },
    {
        id: 'gemstones',
        label: 'Gemstones',
        subTabs: [
            { id: 'stock_summary', label: 'Stock Summary' },
            { id: 'origin_breakdown', label: 'Origin Breakdown' },
            { id: 'carat_analysis', label: 'Carat Analysis' },
            { id: 'treatment_report', label: 'Treatment Report' },
        ]
    },
    {
        id: 'analytics',
        label: 'Analytics',
        subTabs: [
            { id: 'top_selling', label: 'Top Selling Items' },
            { id: 'valuation', label: 'Inventory Valuation' },
            { id: 'audit_log', label: 'Audit Log' },
            { id: 'ai_insights', label: 'AI Business Insights' }
        ]
    }
];

function PageContent({ activeTab, activeSubTab, dateRange, search }: { activeTab: string, activeSubTab: string | null, dateRange?: DateRange, search: string }) {
    const [data, setData] = useState<any[]>([]);
    const [paginatedResult, setPaginatedResult] = useState<PaginatedResult<any> | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 15;

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [activeTab, activeSubTab, dateRange?.start, dateRange?.end, debouncedSearch]);

    useEffect(() => {
        const load = async () => {
            if (!navigator.onLine) {
                setIsOffline(true);
                setLoading(false);
                return;
            }
            setIsOffline(false);
            setLoading(true);
            try {
                let res: any;
                switch (activeTab) {
                    case 'main':
                        if (activeSubTab === 'statement') res = await getStatementReport(dateRange, page, pageSize, debouncedSearch);
                        else if (activeSubTab === 'transactions') res = await getTransactionsReport(dateRange, page, pageSize, debouncedSearch);
                        else if (activeSubTab === 'payables') res = await getPayablesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'receivables') res = await getReceivablesReport(dateRange, debouncedSearch);
                        break;
                    case 'inventory':
                        if (activeSubTab === 'item_list') res = await getItemListReport(debouncedSearch);
                        else if (activeSubTab === 'stock_adjustments') res = await getAdjustmentReport(dateRange, page, pageSize, debouncedSearch);
                        else if (activeSubTab === 'supplier_wise') res = await getSupplierWiseReport(debouncedSearch);
                        else if (activeSubTab === 'reorder_level') res = await getReorderLevelReport(debouncedSearch);
                        else if (activeSubTab === 'purchase_order') res = await getPurchaseOrderReport(dateRange, page, pageSize, debouncedSearch);
                        else if (activeSubTab === 'sold_items') res = await getSoldItemsReport(dateRange, page, pageSize, debouncedSearch);
                        else if (activeSubTab === 'type_wise') res = await getTypeWiseReport(debouncedSearch);
                        break;
                    case 'finance':
                        if (activeSubTab === 'balance_sheet') {
                            const bs = await getBalanceSheetReport();
                            res = [...bs.assets, ...bs.liabilities];
                        }
                        else if (activeSubTab === 'income_statement') res = await getIncomeStatementReport(dateRange);
                        else if (activeSubTab === 'cash_flow') res = await getCashFlowReport(dateRange);
                        break;
                    case 'customer':
                        if (activeSubTab === 'customer_list') res = await getCustomerListReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'purchase_history') res = await getCustomerPurchaseHistoryReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'outstanding') res = await getCustomerOutstandingReport(dateRange, debouncedSearch);
                        break;
                    case 'supplier':
                        if (activeSubTab === 'supplier_list') res = await getSupplierListReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'purchase_history') res = await getSupplierPurchaseHistoryReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'outstanding') res = await getSupplierOutstandingReport(dateRange, debouncedSearch);
                        break;
                    case 'invoicing':
                        if (activeSubTab === 'sales_invoices') res = await getSalesInvoicesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'purchase_invoices') res = await getPurchaseInvoicesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'credit_notes') res = await getCreditNotesReport(dateRange, debouncedSearch);
                        break;
                    case 'cheques':
                        if (activeSubTab === 'in_hand') res = await getChequesInHandReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'today_received') res = await getTodayReceivedChequesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'today_dated') res = await getTodayDatedChequesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'bounced') res = await getBouncedChequesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'received_party') res = await getReceivedPartyChequesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'received_own') res = await getReceivedOwnChequesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'given_party') res = await getGivenPartyChequesReport(dateRange, debouncedSearch);
                        else if (activeSubTab === 'given_own') res = await getGivenOwnChequesReport(dateRange, debouncedSearch);
                        break;
                    case 'analytics':
                        if (activeSubTab === 'top_selling') res = await getTopSellingItems();
                        else if (activeSubTab === 'valuation') {
                            const val = await getInventoryValuation();
                            res = [{ ...val, id: 1 }]; // Table expects array
                        }
                        else if (activeSubTab === 'audit_log') res = await getActivityLogReport(dateRange, page, pageSize, debouncedSearch);
                        break;
                }

                if (res && typeof res === 'object' && 'data' in res && 'total' in res && 'totalPages' in res) {
                    setPaginatedResult(res);
                    setData(res.data);
                } else {
                    setPaginatedResult(null);
                    setData(res || []);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        load();
    }, [activeTab, activeSubTab, dateRange?.start, dateRange?.end, page, debouncedSearch]);

    const getColumns = (tab: string, subTab: string | null) => {
        // Main Tab Columns
        if (tab === 'main') {
            if (subTab === 'statement') return [
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
                { key: 'type', label: 'Type' },
                { key: 'reference', label: 'Reference' },
                { key: 'description', label: 'Description' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'transactions') return [
                { key: 'invoice_number', label: 'Invoice' },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
                { key: 'total_amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'payment_method', label: 'Payment Method' },
                { key: 'status', label: 'Status' }
            ];
            if (subTab === 'payables') return [
                { key: 'supplier', label: 'Supplier' },
                { key: 'amount_due', label: 'Amount Due', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'last_date', label: 'Last Date', format: (v: string) => formatDate(v) }
            ];
            if (subTab === 'receivables') return [
                { key: 'customer', label: 'Customer' },
                { key: 'amount_due', label: 'Amount Due', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'last_date', label: 'Last Date', format: (v: string) => formatDate(v) }
            ];
        }
        // Inventory Tab Columns
        else if (tab === 'inventory') {
            if (subTab === 'item_list') return [
                { key: 'name', label: 'Product Name' },
                { key: 'barcode', label: 'Barcode' },
                { key: 'category', label: 'Category' },
                { key: 'stock', label: 'Stock', align: 'right' as const },
                { key: 'cost_price', label: 'Cost', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'selling_price', label: 'Price', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'stock_adjustments') return [
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) },
                { key: 'product', label: 'Product' },
                { key: 'type', label: 'Type' },
                { key: 'quantity', label: 'Qty', align: 'right' as const },
                { key: 'reason', label: 'Reason' },
                { key: 'notes', label: 'Notes' }
            ];
            if (subTab === 'supplier_wise') return [
                { key: 'supplier_name', label: 'Supplier' },
                { key: 'total_products', label: 'Products', align: 'right' as const },
                { key: 'total_stock', label: 'Total Stock', align: 'right' as const }
            ];
            if (subTab === 'reorder_level') return [
                { key: 'name', label: 'Product' },
                { key: 'stock', label: 'Current Stock', align: 'right' as const },
                { key: 'reorder_level', label: 'Reorder Level', align: 'right' as const },
                { key: 'shortage', label: 'Shortage', align: 'right' as const }
            ];
            if (subTab === 'purchase_order') return [
                { key: 'po_number', label: 'PO Number' },
                { key: 'supplier_name', label: 'Supplier' },
                { key: 'date_created', label: 'Date', format: (v: string) => formatDate(v) },
                { key: 'total_amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'status', label: 'Status' }
            ];
            if (subTab === 'sold_items') return [
                { key: 'product_name', label: 'Product' },
                { key: 'quantity', label: 'Quantity', align: 'right' as const },
                { key: 'total_sale_value', label: 'Total Value', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'invoice_number', label: 'Invoice' }
            ];
            if (subTab === 'type_wise') return [
                { key: 'category', label: 'Category' },
                { key: 'total_items', label: 'Items', align: 'right' as const },
                { key: 'total_stock', label: 'Stock', align: 'right' as const },
                { key: 'total_value', label: 'Value', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
        }
        // Finance Tab Columns
        else if (tab === 'finance') {
            if (subTab === 'balance_sheet' || subTab === 'income_statement') return [
                { key: 'account', label: 'Account' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'cash_flow') return [
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) },
                { key: 'cash_inflow', label: 'Cash Inflow', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'cash_outflow', label: 'Cash Outflow', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'net_cash_flow', label: 'Net Cash Flow', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
        }
        // Customer Tab Columns
        else if (tab === 'customer') {
            if (subTab === 'customer_list') return [
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' }
            ];
            if (subTab === 'purchase_history') return [
                { key: 'customer_name', label: 'Customer' },
                { key: 'invoice_number', label: 'Invoice' },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
                { key: 'total_amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'outstanding') return [
                { key: 'customer', label: 'Customer' },
                { key: 'amount_due', label: 'Amount Due', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) }
            ];
        }
        // Supplier Tab Columns
        else if (tab === 'supplier') {
            if (subTab === 'supplier_list') return [
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'address', label: 'Address' }
            ];
            if (subTab === 'purchase_history') return [
                { key: 'supplier_name', label: 'Supplier' },
                { key: 'invoice', label: 'Invoice' },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'outstanding') return [
                { key: 'supplier', label: 'Supplier' },
                { key: 'amount_due', label: 'Amount Due', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) }
            ];
        }
        // Invoicing Tab Columns
        else if (tab === 'invoicing') {
            if (subTab === 'sales_invoices') return [
                { key: 'invoice', label: 'Invoice' },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
                { key: 'customer', label: 'Customer' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'payment_method', label: 'Payment Method' }
            ];
            if (subTab === 'purchase_invoices') return [
                { key: 'invoice', label: 'Invoice' },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) },
                { key: 'supplier', label: 'Supplier' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'payment_method', label: 'Payment Method' }
            ];
            if (subTab === 'credit_notes') return [
                { key: 'note', label: 'Note #' },
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v) },
                { key: 'type', label: 'Type' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
        }
        // Cheques Tab Columns
        else if (tab === 'cheques') {
            if (subTab === 'in_hand' || subTab === 'today_received' || subTab === 'today_dated') return [
                { key: 'cheque_number', label: 'Cheque #' },
                { key: 'customer_name', label: 'Customer' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'cheque_date', label: 'Cheque Date', format: (v: string) => formatDate(v) },
                { key: 'status', label: 'Status' }
            ];
            if (subTab === 'bounced') return [
                { key: 'cheque_number', label: 'Cheque #' },
                { key: 'customer_name', label: 'Customer' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'cheque_date', label: 'Cheque Date', format: (v: string) => formatDate(v) },
                { key: 'bounce_date', label: 'Bounce Date', format: (v: string) => formatDate(v) }
            ];
            if (subTab === 'received_party' || subTab === 'received_own') return [
                { key: 'cheque_number', label: 'Cheque #' },
                { key: 'customer_name', label: 'From' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'cheque_date', label: 'Cheque Date', format: (v: string) => formatDate(v) }
            ];
            if (subTab === 'given_party') return [
                { key: 'cheque_number', label: 'Cheque #' },
                { key: 'supplier_name', label: 'To' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'cheque_date', label: 'Cheque Date', format: (v: string) => formatDate(v) }
            ];
            if (subTab === 'given_own') return [
                { key: 'cheque_number', label: 'Cheque #' },
                { key: 'payee', label: 'Payee' },
                { key: 'amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'cheque_date', label: 'Cheque Date', format: (v: string) => formatDate(v) }
            ];
        }
        else if (tab === 'analytics') {
            if (subTab === 'top_selling') return [
                { key: 'name', label: 'Product' },
                { key: 'total_qty', label: 'Qty Sold', align: 'right' as const },
                { key: 'total_revenue', label: 'Revenue', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'valuation') return [
                { key: 'totalItems', label: 'Total Products' },
                { key: 'totalStock', label: 'Total Stock' },
                { key: 'costValue', label: 'Cost Value (Asset)', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'retailValue', label: 'Retail Value', align: 'right' as const, format: (v: number) => formatCurrency(v) },
                { key: 'potentialProfit', label: 'Potential Profit', align: 'right' as const, format: (v: number) => formatCurrency(v) }
            ];
            if (subTab === 'audit_log') return [
                { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
                { key: 'user', label: 'User' },
                { key: 'action', label: 'Action' },
                { key: 'entity_type', label: 'Entity' },
                { key: 'details', label: 'Details', format: (v: string) => v ? (v.length > 50 ? v.substring(0, 50) + '...' : v) : '-' }
            ];
        }

        return [];
    };

    const getDrillDownColumns = (tab: string, subTab: string | null) => {
        if (tab === 'main' && subTab === 'transactions') return [
            { key: 'product_name', label: 'Product' },
            { key: 'quantity', label: 'Qty', align: 'right' as const },
            { key: 'price', label: 'Price', align: 'right' as const, format: (v: number) => formatCurrency(v) },
            { key: 'discount', label: 'Discount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
        ];
        if (tab === 'customer' && subTab === 'customer_list') return [
            { key: 'invoice_number', label: 'Invoice' },
            { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
            { key: 'total_amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
            { key: 'payment_method', label: 'Method' },
            { key: 'payment_status', label: 'Status' },
        ];
        if (tab === 'supplier' && subTab === 'supplier_list') return [
            { key: 'po_number', label: 'PO Number' },
            { key: 'date_created', label: 'Date', format: (v: string) => formatDate(v) },
            { key: 'total_amount', label: 'Amount', align: 'right' as const, format: (v: number) => formatCurrency(v) },
            { key: 'status', label: 'Status' },
        ];
        if (tab === 'inventory' && subTab === 'sold_items') return [
            { key: 'invoice_number', label: 'Invoice' },
            { key: 'date', label: 'Date', format: (v: string) => formatDate(v, { showTime: true }) },
            { key: 'quantity', label: 'Qty', align: 'right' as const },
            { key: 'price', label: 'Price', align: 'right' as const, format: (v: number) => formatCurrency(v) },
            { key: 'customer_name', label: 'Customer' },
        ];
        return undefined;
    };

    const getDrillDownFn = (tab: string, subTab: string | null) => {
        if (tab === 'main' && subTab === 'transactions') return (row: any) => getSaleItemsDrillDown(row.id);
        if (tab === 'customer' && subTab === 'customer_list') return (row: any) => getCustomerSalesDrillDown(row.id);
        if (tab === 'supplier' && subTab === 'supplier_list') return (row: any) => getSupplierPurchasesDrillDown(row.id);
        if (tab === 'inventory' && subTab === 'sold_items') return (row: any) => getProductSalesDrillDown(row.product_id);
        return undefined;
    };

    const getDrillDownTitle = (tab: string, subTab: string | null) => {
        if (tab === 'main' && subTab === 'transactions') return (row: any) => `Items — ${row.invoice_number}`;
        if (tab === 'customer' && subTab === 'customer_list') return (row: any) => `Purchases — ${row.name}`;
        if (tab === 'supplier' && subTab === 'supplier_list') return (row: any) => `Orders — ${row.name}`;
        if (tab === 'inventory' && subTab === 'sold_items') return (row: any) => `Sales — ${row.product_name}`;
        return undefined;
    };

    const getTitle = (tab: string, subTab: string | null) => {
        const tabObj = TABS.find(t => t.id === tab);
        const subTabObj = tabObj?.subTabs?.find(st => st.id === subTab);
        return subTabObj?.label || tabObj?.label || 'Report';
    };

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>;
    }

    if (activeTab === 'main' && activeSubTab === 'analytics') {
        return <SalesTrendsTab />;
    }

    if (activeTab === 'inventory' && activeSubTab === 'analytics') {
        return <InventoryAnalyticsTab />;
    }

    if (activeTab === 'analytics' && activeSubTab === 'ai_insights') {
        return <AIInsightsDashboard />;
    }

    if (activeTab === 'staff') {
        if (activeSubTab === 'performance') return <StaffPerformanceDashboard />;
        if (activeSubTab === 'productivity') return <StaffProductivityTab />;
        return <StaffPerformanceDashboard />;
    }

    if (activeTab === 'gemstones') {
        if (activeSubTab === 'stock_summary' || !activeSubTab) return <GemStockReportView />;
        if (activeSubTab === 'origin_breakdown') {
            return (
                <GemAnalyticsTab
                    title="Origin Breakdown"
                    fetchFn={getGemOriginReport}
                    columns={[
                        { key: 'origin', label: 'Origin' },
                        { key: 'product_count', label: 'Products', align: 'right' as const },
                        { key: 'total_pieces', label: 'Pieces', align: 'right' as const },
                        { key: 'total_weight', label: 'Total Weight (ct)', align: 'right' as const, format: (v: number) => (Number(v) || 0).toFixed(2) },
                        { key: 'total_value', label: 'Total Value', align: 'right' as const, format: (v: number) => formatCurrency(Number(v) || 0) },
                        { key: 'avg_price', label: 'Avg Price', align: 'right' as const, format: (v: number) => formatCurrency(Number(v) || 0) },
                    ]}
                />
            );
        }
        if (activeSubTab === 'carat_analysis') {
            return (
                <GemAnalyticsTab
                    title="Carat Weight Analysis"
                    fetchFn={getCaratAnalysisReport}
                    columns={[
                        { key: 'weight_range', label: 'Weight Range' },
                        { key: 'product_count', label: 'Products', align: 'right' as const },
                        { key: 'total_pieces', label: 'Pieces', align: 'right' as const },
                        { key: 'total_carats', label: 'Total Carats', align: 'right' as const, format: (v: number) => (Number(v) || 0).toFixed(2) },
                        { key: 'total_value', label: 'Total Value', align: 'right' as const, format: (v: number) => formatCurrency(Number(v) || 0) },
                        { key: 'avg_price_per_carat', label: 'Avg $/ct', align: 'right' as const, format: (v: number) => formatCurrency(Number(v) || 0) },
                    ]}
                />
            );
        }
        if (activeSubTab === 'treatment_report') {
            return (
                <GemAnalyticsTab
                    title="Treatment Analysis"
                    fetchFn={getGemTreatmentReport}
                    columns={[
                        { key: 'treatment', label: 'Treatment' },
                        { key: 'product_count', label: 'Products', align: 'right' as const },
                        { key: 'total_pieces', label: 'Pieces', align: 'right' as const },
                        { key: 'total_weight', label: 'Total Weight (ct)', align: 'right' as const, format: (v: number) => (Number(v) || 0).toFixed(2) },
                        { key: 'total_value', label: 'Total Value', align: 'right' as const, format: (v: number) => formatCurrency(Number(v) || 0) },
                    ]}
                />
            );
        }
        return <GemStockReportView />;
    }

    return (
        <>
            {isOffline && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    background: 'rgba(249,115,22,0.06)',
                    border: '1px solid rgba(249,115,22,0.2)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--warning)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                }}>
                    <span>📡</span>
                    Reports require a server connection. Connect to the internet to view live report data.
                </div>
            )}
        <ReportTable
            title={getTitle(activeTab, activeSubTab)}
            columns={getColumns(activeTab, activeSubTab)}
            data={data}
            drillDownColumns={getDrillDownColumns(activeTab, activeSubTab)}
            drillDownData={getDrillDownFn(activeTab, activeSubTab)}
            drillDownTitle={getDrillDownTitle(activeTab, activeSubTab)}
            pagination={paginatedResult ? {
                currentPage: page,
                totalPages: paginatedResult.totalPages,
                onPageChange: setPage,
                totalItems: paginatedResult.total,
                pageSize: paginatedResult.pageSize
            } : undefined}
        />
        </>
    );
}

export default function ReportsPage() {
    return (
        <ReportLayout tabs={TABS}>
            {(activeTab, activeSubTab, dateRange, search) => (
                <PageContent
                    activeTab={activeTab}
                    activeSubTab={activeSubTab}
                    dateRange={dateRange}
                    search={search}
                />
            )}
        </ReportLayout>
    );
}

// ── Reusable gem analytics table component ───────────────────────────────────
function GemAnalyticsTab({ title, fetchFn, columns }: {
    title: string;
    fetchFn: () => Promise<any[]>;
    columns: { key: string; label: string; align?: 'left' | 'right' | 'center'; format?: (v: any) => string }[];
}) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFn().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{data.length} records</span>
            </div>
            {data.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                    No data available
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                {columns.map(col => (
                                    <th key={col.key} style={{ textAlign: col.align || 'left' }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, idx) => (
                                <tr key={idx}>
                                    {columns.map(col => (
                                        <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                                            {col.format ? col.format(row[col.key]) : (row[col.key] ?? '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
