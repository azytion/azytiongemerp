'use client';

import { useQuery } from '@tanstack/react-query';
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
    getBalanceSheetReport,
    getIncomeStatementReport,
    getCashFlowReport,
    type DateRange
} from '@/app/actions/reports_comprehensive';


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
} from '@/app/actions/reports_extended';

import { getTopSellingItems, getInventoryValuation } from '@/app/actions/analytics';

// Generic hook for reports with date range
export function useReport(reportType: string, dateRange?: DateRange) {
    return useQuery({
        queryKey: ['reports', reportType, dateRange],
        queryFn: async () => {
            switch (reportType) {
                // Main Reports
                case 'statement':
                    return getStatementReport(dateRange);
                case 'transactions':
                    return getTransactionsReport(dateRange);
                case 'payables':
                    return getPayablesReport(dateRange);
                case 'receivables':
                    return getReceivablesReport(dateRange);

                // Inventory Reports
                case 'itemList':
                    return getItemListReport();
                case 'supplierWise':
                    return getSupplierWiseReport();
                case 'reorderLevel':
                    return getReorderLevelReport();
                case 'purchaseOrder':
                    return getPurchaseOrderReport();
                case 'soldItems':
                    return getSoldItemsReport(dateRange);
                case 'typeWise':
                    return getTypeWiseReport();
                case 'topSelling':
                    return getTopSellingItems(10);
                case 'inventoryValuation':
                    return getInventoryValuation();

                // Financial Reports
                case 'balanceSheet':
                    return getBalanceSheetReport();
                case 'incomeStatement':
                    return getIncomeStatementReport(dateRange);
                case 'cashFlow':
                    return getCashFlowReport(dateRange);

                // Customer Reports
                case 'customerList':
                    return getCustomerListReport();
                case 'customerPurchaseHistory':
                    return getCustomerPurchaseHistoryReport(dateRange);
                case 'customerOutstanding':
                    return getCustomerOutstandingReport();

                // Supplier Reports
                case 'supplierList':
                    return getSupplierListReport();
                case 'supplierPurchaseHistory':
                    return getSupplierPurchaseHistoryReport(dateRange);
                case 'supplierOutstanding':
                    return getSupplierOutstandingReport();

                // Invoice Reports
                case 'salesInvoices':
                    return getSalesInvoicesReport(dateRange);
                case 'purchaseInvoices':
                    return getPurchaseInvoicesReport(dateRange);
                case 'creditNotes':
                    return getCreditNotesReport(dateRange);

                // Cheque Reports
                case 'chequesInHand':
                    return getChequesInHandReport();
                case 'todayReceivedCheques':
                    return getTodayReceivedChequesReport();
                case 'todayDatedCheques':
                    return getTodayDatedChequesReport();
                case 'bouncedCheques':
                    return getBouncedChequesReport();
                case 'receivedPartyCheques':
                    return getReceivedPartyChequesReport();
                case 'receivedOwnCheques':
                    return getReceivedOwnChequesReport();
                case 'givenPartyCheques':
                    return getGivenPartyChequesReport();
                case 'givenOwnCheques':
                    return getGivenOwnChequesReport();

                default:
                    return [];
            }
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: navigator?.onLine ? 1000 * 60 : false,
        refetchOnWindowFocus: true,
        enabled: !!reportType,
        retry: 1,
        networkMode: 'offlineFirst' as const,
    });
}
