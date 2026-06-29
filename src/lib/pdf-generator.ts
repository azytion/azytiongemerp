
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/utils';
import { ExchangeRateSnapshot, formatExchangeFromSnapshot, formatExchangeRateLine, getExchangeSnapshot } from '@/lib/exchange-rates';

// ─────────────────────────────────────────────────────────────────────────────
// ZATION GemERP — Unified PDF Template System
// Single source of truth for all PDF generation across the app.
// ─────────────────────────────────────────────────────────────────────────────

// ── Theme ────────────────────────────────────────────────────────────────────
const T = {
  navy:    [11,  19,  43]  as [number,number,number],
  gold:    [212, 175, 55]  as [number,number,number],
  goldDim: [166, 124, 0]   as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
  black:   [15,  15,  15]  as [number,number,number],
  gray1:   [60,  60,  60]  as [number,number,number],
  gray2:   [100, 100, 100] as [number,number,number],
  gray3:   [160, 160, 160] as [number,number,number],
  gray4:   [220, 220, 220] as [number,number,number],
  gray5:   [245, 245, 245] as [number,number,number],
  green:   [16,  185, 129] as [number,number,number],
  greenBg: [240, 253, 244] as [number,number,number],
  red:     [220, 38,  38]  as [number,number,number],
  redBg:   [254, 242, 242] as [number,number,number],
  amber:   [180, 83,  9]   as [number,number,number],
  amberBg: [255, 251, 235] as [number,number,number],
  blue:    [37,  99,  235] as [number,number,number],
  blueBg:  [239, 246, 255] as [number,number,number],
};

const M = 14; // left/right margin
const _PAGE_W = 210; // A4 width mm

// ── Types ────────────────────────────────────────────────────────────────────
export interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  website?: string;
  logo?: string;
  vatNumber?: string;
}

export interface SalesInvoiceData {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  salesman_name?: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  tax_amount?: number;
  tax_rate?: number;
  total_amount: number;
  paid_amount?: number;
  change_amount?: number;
  broker_name?: string;
  broker_commission?: number;
  exchange_rate?: ExchangeRateSnapshot | null;
  footer?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
    discount: number;
    carat_weight?: number;
    shape?: string;
    color?: string;
    clarity?: string;
    origin?: string;
    treatment?: string;
    certificate_number?: string;
  }>;
  currency_symbol: string;
}

export interface PurchaseOrderData {
  po_number: string;
  date_created: string;
  expected_date?: string | null;
  status: string;
  supplier_name: string;
  supplier_phone?: string;
  supplier_email?: string;
  total_amount: number;
  paid_amount?: number;
  payment_status?: string;
  notes?: string;
  items: Array<{
    product_name: string;
    barcode?: string;
    quantity: number;
    expected_price: number;
  }>;
  currency_symbol: string;
}

export interface CreditNoteData {
  credit_note_number: string;
  date: string;
  type: 'sales_return' | 'purchase_return';
  reference_number?: string;
  customer_name?: string;
  supplier_name?: string;
  total_amount: number;
  reason?: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
  currency_symbol: string;
}

export interface StatementData {
  party_name: string;
  party_type: 'customer' | 'supplier';
  party_phone?: string;
  party_email?: string;
  statement_date: string;
  opening_balance: number;
  transactions: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  closing_balance: number;
  currency_symbol: string;
}

export interface StockTakeData {
  date: string;
  items: Array<{
    product_name: string;
    barcode?: string;
    expected_qty: number;
    actual_qty: number;
    variance: number;
    value: number;
  }>;
  total_variance_value: number;
  currency_symbol: string;
}

export interface ChequeData {
  cheque_number: string;
  date: string;
  payee: string;
  amount: number;
  bank: string;
  status: string;
  currency_symbol: string;
}

export interface LedgerData {
  account_name: string;
  account_code: string;
  start_date: string;
  end_date: string;
  opening_balance: number;
  entries: Array<{
    date: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  closing_balance: number;
  currency_symbol: string;
}

export interface DaybookData {
  date: string;
  stats: { total_income: number; total_expenses: number; net_cash_flow: number };
  entries: Array<{ time: string; description: string; type: string; amount: number; user?: string }>;
  currency_symbol: string;
}

export interface FinancialReportData {
  date: string;
  metrics: {
    total_sales: number; total_profit: number; profit_margin: number;
    sales_returns: number; inventory_value: number; total_outstanding: number;
  };
  aging: { upcoming: number; overdue: number; cleared: number; bounced: number };
  banks: Array<{ name: string; count: number; amount: number }>;
  receivables: Array<{ name: string; balance: number; utilization: number }>;
  currency_symbol: string;
}

export interface GemStockReportData {
  generated_at: string;
  currency_symbol: string;
  grand_total: { count: number; weight: number; value: number };
  groups: Array<{
    category: string; shape: string;
    total: { count: number; weight: number; value: number };
    ranges: Record<string, { count: number; weight: number; value: number }>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITY: Build CompanyInfo from settings — use this in every caller
// ─────────────────────────────────────────────────────────────────────────────
export function buildCompanyInfo(settings: Record<string, string>): CompanyInfo {
  const showLogo =
    settings.receipt_show_logo === 'true' ||
    settings.receipt_logo_enabled === 'true';
  return {
    name:       settings.company_name     || 'ZATION GemERP',
    address:    settings.company_address,
    phone:      settings.company_phone,
    phone2:     settings.company_phone_2  || settings.company_phone2,
    email:      settings.company_email,
    website:    settings.company_website,
    vatNumber:  settings.vat_number,
    logo:       showLogo && settings.company_logo ? settings.company_logo : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Unified header — logo left, company info right, title below
// Returns Y position after header
// ─────────────────────────────────────────────────────────────────────────────
function addHeader(doc: jsPDF, company: CompanyInfo, title: string, subtitle?: string): number {
  const pw = doc.internal.pageSize.getWidth();

  // ── Navy header band ──────────────────────────────────────────────────────
  const BAND_H = 28;
  doc.setFillColor(...T.navy);
  doc.rect(0, 0, pw, BAND_H, 'F');

  // Gold accent stripe
  doc.setFillColor(...T.gold);
  doc.rect(0, BAND_H, pw, 1.5, 'F');

  // ── Logo (left side, vertically centred in band) ──────────────────────────
  const LOGO_SIZE = 22;
  const LOGO_X = M;
  const LOGO_Y = (BAND_H - LOGO_SIZE) / 2;
  let textStartX = M;

  if (company.logo) {
    try {
      let fmt = 'PNG';
      if (company.logo.includes('jpeg') || company.logo.includes('jpg')) fmt = 'JPEG';
      doc.addImage(company.logo, fmt, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      textStartX = LOGO_X + LOGO_SIZE + 4;
    } catch { /* skip bad logo */ }
  }

  // ── Company name (left, after logo) ──────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...T.white);
  doc.text(company.name.toUpperCase(), textStartX, 11);

  // Tagline / address under name
  if (company.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 230);
    doc.text(company.address, textStartX, 17);
  }

  // ── Contact block (right side of band) ───────────────────────────────────
  const rightX = pw - M;
  let ry = 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 210, 230);

  const contactLines: string[] = [];
  if (company.phone) {
    const ph = company.phone2 ? `${company.phone}  /  ${company.phone2}` : company.phone;
    contactLines.push(`Tel: ${ph}`);
  }
  if (company.email)   contactLines.push(`Email: ${company.email}`);
  if (company.website) contactLines.push(company.website);
  if (company.vatNumber) contactLines.push(`VAT: ${company.vatNumber}`);

  contactLines.forEach(line => {
    doc.text(line, rightX, ry, { align: 'right' });
    ry += 5;
  });

  // ── Document title (below band) ──────────────────────────────────────────
  let y = BAND_H + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...T.navy);
  doc.text(title, M, y);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...T.gray2);
    doc.text(subtitle, M, y + 6);
    y += 6;
  }

  // Divider
  doc.setDrawColor(...T.gray4);
  doc.setLineWidth(0.25);
  doc.line(M, y + 4, pw - M, y + 4);

  return y + 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Footer — company left, "Powered by ZATION" centre, page right
// ─────────────────────────────────────────────────────────────────────────────
const POWERED_BY = 'Powered By ZATION  |  +94752723544';

function addFooter(doc: jsPDF, company: CompanyInfo, customText?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const pages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Navy footer band
    doc.setFillColor(...T.navy);
    doc.rect(0, ph - 14, pw, 14, 'F');

    // Gold top line of footer
    doc.setFillColor(...T.gold);
    doc.rect(0, ph - 14, pw, 0.8, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 230);

    // Left: company name + custom text
    const leftText = customText || company.name;
    doc.text(leftText, M, ph - 5.5);

    // Centre: powered by
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...T.gold);
    doc.text(POWERED_BY, pw / 2, ph - 5.5, { align: 'center' });

    // Right: page number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 230);
    doc.text(`Page ${i} / ${pages}`, pw - M, ph - 5.5, { align: 'right' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Two-column info block — auto-aligns values based on widest label
// ─────────────────────────────────────────────────────────────────────────────
function addInfoBlock(
  doc: jsPDF,
  leftRows: [string, string][],
  rightRows: [string, string][],
  y: number
): number {
  const pw = doc.internal.pageSize.getWidth();
  const halfW = (pw - M * 2) / 2;
  const lineH = 5.8;
  const maxRows = Math.max(leftRows.length, rightRows.length);

  // Measure widest label in each column for alignment
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  let leftLabelW = 0;
  leftRows.forEach(r => { leftLabelW = Math.max(leftLabelW, doc.getTextWidth(r[0])); });
  let rightLabelW = 0;
  rightRows.forEach(r => { rightLabelW = Math.max(rightLabelW, doc.getTextWidth(r[0])); });

  const leftValX  = M + leftLabelW + 3;
  const rightColX = M + halfW + 4;
  const rightValX = rightColX + rightLabelW + 3;

  // Light background panel
  const boxH = maxRows * lineH + 4;
  doc.setFillColor(248, 249, 252);
  doc.setDrawColor(...T.gray4);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y - 2, pw - M * 2, boxH, 2, 2, 'FD');

  for (let i = 0; i < maxRows; i++) {
    const rowY = y + 2 + i * lineH;

    if (leftRows[i]) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...T.gray2);
      doc.text(leftRows[i][0], M + 3, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...T.black);
      // Truncate long values
      const val = leftRows[i][1] || '—';
      const maxW = halfW - leftLabelW - 10;
      const truncated = doc.splitTextToSize(val, maxW)[0];
      doc.text(truncated, leftValX + 2, rowY);
    }

    if (rightRows[i]) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...T.gray2);
      doc.text(rightRows[i][0], rightColX, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...T.black);
      const val = rightRows[i][1] || '—';
      const maxW = halfW - rightLabelW - 10;
      const truncated = doc.splitTextToSize(val, maxW)[0];
      doc.text(truncated, rightValX + 2, rowY);
    }
  }

  return y + boxH + 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Totals block — right-aligned, navy accent on TOTAL row
// ─────────────────────────────────────────────────────────────────────────────
function addTotalsBlock(
  doc: jsPDF,
  rows: Array<{ label: string; value: string; bold?: boolean; color?: [number,number,number] }>,
  y: number
): number {
  const pw = doc.internal.pageSize.getWidth();
  const BOX_W = 78;
  const boxX = pw - M - BOX_W;
  const labelX = boxX + 4;
  const valueX = pw - M - 3;
  const lineH = 6.5;
  const boxH = rows.length * lineH + 5;

  // Outer box
  doc.setFillColor(248, 249, 252);
  doc.setDrawColor(...T.gray4);
  doc.setLineWidth(0.2);
  doc.roundedRect(boxX, y - 2, BOX_W, boxH, 2, 2, 'FD');

  rows.forEach((row, i) => {
    const ry = y + 2 + i * lineH;
    const isBold = row.bold === true;

    // Highlight row for bold (TOTAL)
    if (isBold) {
      doc.setFillColor(...T.navy);
      doc.rect(boxX, ry - 4.5, BOX_W, lineH + 0.5, 'F');
    }

    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 10 : 9);

    if (isBold) {
      doc.setTextColor(...T.white);
    } else {
      doc.setTextColor(...(row.color || T.gray1));
    }

    if (row.value) {
      doc.text(row.label, labelX, ry);
      doc.text(row.value, valueX, ry, { align: 'right' });
    } else {
      doc.setFontSize(7.5);
      doc.setTextColor(...T.gray2);
      doc.text(row.label, labelX, ry);
    }
  });

  return y + boxH + 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Standardized table — used by all non-invoice PDFs
// ─────────────────────────────────────────────────────────────────────────────
function _addTable(
  doc: jsPDF,
  head: string[][],
  body: (string | { content: string; styles?: Record<string, any> })[][],
  startY: number,
  columnStyles?: Record<number, Record<string, any>>
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: T.navy,
      textColor: T.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8.5, textColor: T.black, cellPadding: 2.8 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: columnStyles || {},
    margin: { left: M, right: M },
    styles: { lineColor: T.gray4, lineWidth: 0.2, overflow: 'linebreak' },
    didDrawCell: (data: any) => {
      if (data.section === 'head' && data.column.index === 0) {
        doc.setFillColor(...T.gold);
        doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F');
      }
    },
  });
  return (doc as any).lastAutoTable.finalY;
}
function addSectionHeading(doc: jsPDF, text: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...T.navy);
  doc.rect(M, y, pw - M * 2, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...T.white);
  doc.text(text.toUpperCase(), M + 3, y + 4.5);
  return y + 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────
function fmt(sym: string, val: number): string {
  return `${sym} ${val.toFixed(2)}`;
}

function parseSaleExchangeSnapshot(sale: Record<string, any>, settings: Record<string, string>) {
  try {
    const details = typeof sale.payment_details === 'string' ? JSON.parse(sale.payment_details) : sale.payment_details;
    if (details?.exchange_rate?.baseCode && details?.exchange_rate?.targetCode) {
      return details.exchange_rate as ExchangeRateSnapshot;
    }
  } catch { /* ignore malformed legacy payment details */ }

  return getExchangeSnapshot(settings);
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function printPDF(doc: jsPDF) {
  const url = URL.createObjectURL(doc.output('blob'));
  const w = window.open(url);
  if (w) w.onload = () => w.print();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SALES INVOICE
// ─────────────────────────────────────────────────────────────────────────────
export function generateSalesInvoicePDF(data: SalesInvoiceData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const _pw = doc.internal.pageSize.getWidth();
  const sym = data.currency_symbol;

  let y = addHeader(doc, company, 'SALES INVOICE', `Invoice #${data.invoice_number}`);

  // Info block — two columns, clean grid layout
  const left: [string,string][] = [
    ['Invoice #:', data.invoice_number],
    ['Date:', formatDate(data.date, { showTime: true })],
    ['Payment:', data.payment_method],
    ['Status:', (data.payment_status || 'paid').toUpperCase()],
    ['Salesman:', data.salesman_name || '—'],
  ];
  if (data.broker_name) left.push(['Broker:', data.broker_name]);

  const right: [string,string][] = [
    ['Customer:', data.customer_name],
    ['Phone:', data.customer_phone || '—'],
    ['Email:', data.customer_email || '—'],
  ];
  if (company.vatNumber) right.push(['VAT No:', company.vatNumber]);

  y = addInfoBlock(doc, left, right, y);
  y += 2;

  // Items table
  const hasGemDetails = data.items.some(i => i.carat_weight || i.shape || i.origin);

  const head = hasGemDetails
    ? [['#', 'Product / Gem Details', 'Ct', 'Qty', 'Unit Price', 'Disc', 'Total']]
    : [['#', 'Product', 'Qty', 'Unit Price', 'Disc', 'Total']];

  const body = data.items.map((item, idx) => {
    const gemParts: string[] = [];
    if (item.carat_weight) gemParts.push(`${item.carat_weight}ct`);
    if (item.shape) gemParts.push(item.shape);
    if (item.color) gemParts.push(item.color);
    if (item.clarity) gemParts.push(item.clarity);
    if (item.origin) gemParts.push(`Origin: ${item.origin}`);
    if (item.treatment && item.treatment !== 'None') gemParts.push(`Treatment: ${item.treatment}`);
    if (item.certificate_number) gemParts.push(`Cert: ${item.certificate_number}`);

    const nameCell = gemParts.length
      ? `${item.product_name}\n${gemParts.join(' | ')}`
      : item.product_name;

    const lineTotal = item.price * item.quantity - item.discount;

    if (hasGemDetails) {
      return [
        (idx + 1).toString(),
        nameCell,
        item.carat_weight ? item.carat_weight.toFixed(2) : '—',
        item.quantity.toString(),
        fmt(sym, item.price),
        item.discount > 0 ? fmt(sym, item.discount) : '—',
        fmt(sym, lineTotal),
      ];
    }
    return [
      (idx + 1).toString(),
      nameCell,
      item.quantity.toString(),
      fmt(sym, item.price),
      item.discount > 0 ? fmt(sym, item.discount) : '—',
      fmt(sym, lineTotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: T.navy,
      textColor: T.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8.5, textColor: T.black, cellPadding: 3 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: hasGemDetails
      ? {
          0: { cellWidth: 8,  halign: 'center' },
          2: { halign: 'right', cellWidth: 14 },
          3: { halign: 'center', cellWidth: 12 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'right', cellWidth: 22 },
          6: { halign: 'right', cellWidth: 28 },
        }
      : {
          0: { cellWidth: 8,  halign: 'center' },
          2: { halign: 'center', cellWidth: 14 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'right', cellWidth: 30 },
        },
    margin: { left: M, right: M },
    styles: { lineColor: T.gray4, lineWidth: 0.2, overflow: 'linebreak' },
    didDrawCell: (data: any) => {
      // Gold left accent on first column header
      if (data.section === 'head' && data.column.index === 0) {
        doc.setFillColor(...T.gold);
        doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F');
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Totals
  const totalRows: Parameters<typeof addTotalsBlock>[1] = [
    { label: 'Subtotal', value: fmt(sym, data.subtotal) },
  ];
  if (data.discount > 0) totalRows.push({ label: 'Discount', value: `- ${fmt(sym, data.discount)}`, color: T.red });
  if (data.tax_amount && data.tax_amount > 0) totalRows.push({ label: `Tax (${data.tax_rate || 0}%)`, value: fmt(sym, data.tax_amount) });
  totalRows.push({ label: 'TOTAL', value: fmt(sym, data.total_amount), bold: true, color: T.navy });
  if (data.exchange_rate) {
    const exchangeTotal = formatExchangeFromSnapshot(data.total_amount, data.exchange_rate);
    if (exchangeTotal) {
      totalRows.push({ label: `${exchangeTotal.code} Equivalent`, value: exchangeTotal.formatted, color: T.gray2 });
    }
  }
  if (data.paid_amount !== undefined) totalRows.push({ label: 'Paid', value: fmt(sym, data.paid_amount), color: T.green });
  if (data.change_amount !== undefined && data.change_amount > 0) totalRows.push({ label: 'Change', value: fmt(sym, data.change_amount) });
  if (data.broker_commission && data.broker_commission > 0) totalRows.push({ label: 'Broker Commission', value: fmt(sym, data.broker_commission) });

  y = addTotalsBlock(doc, totalRows, y);

  // Item count summary (left side, aligned with totals top)
  const totalQty = data.items.reduce((s, i) => s + i.quantity, 0);
  const totalCt = data.items.reduce((s, i) => s + (i.carat_weight || 0), 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...T.gray2);
  const summaryParts = [`${data.items.length} line item(s)`, `${totalQty} unit(s)`];
  if (totalCt > 0) summaryParts.push(`${totalCt.toFixed(2)} ct total`);
  const exchangeLine = formatExchangeRateLine(data.exchange_rate || null);
  if (exchangeLine) summaryParts.push(`Rate: ${exchangeLine}`);
  doc.text(summaryParts.join('  ·  '), M, y - 2);

  // Footer note
  if (data.footer) {
    y += 6;
    // Thin gold divider
    doc.setDrawColor(...T.gold);
    doc.setLineWidth(0.4);
    doc.line(M, y - 2, doc.internal.pageSize.getWidth() - M, y - 2);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...T.gray2);
    const lines = doc.splitTextToSize(data.footer, doc.internal.pageSize.getWidth() - M * 2);
    doc.text(lines, doc.internal.pageSize.getWidth() / 2, y + 3, { align: 'center' });
  }

  // Diagonal PAID watermark for fully paid invoices
  const status = (data.payment_status || '').toLowerCase();
  if (status === 'paid' || status === 'completed') {
    const ph = doc.internal.pageSize.getHeight();
    const pw2 = doc.internal.pageSize.getWidth();
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(72);
    doc.setTextColor(...T.green);
    doc.text('PAID', pw2 / 2, ph / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();
  }

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSalesInvoicePDFFromSaleRecord — adapter used by POS + sales history
// ─────────────────────────────────────────────────────────────────────────────
export function buildSalesInvoicePDFFromSaleRecord(
  sale: Record<string, any>,
  items: Record<string, any>[],
  settings: Record<string, string>
): jsPDF {
  const company = buildCompanyInfo(settings);
  const sym = settings.currency_symbol || settings.currency_code || '$';

  // Discount reconciliation: DB stores total discount; items may have per-line discounts
  const itemDiscSum = items.reduce((a, i) => a + (Number(i.discount) || 0), 0);
  const dbDisc = Number(sale.discount) || 0;
  const totalDiscount = dbDisc >= itemDiscSum - 0.01 ? dbDisc : dbDisc + itemDiscSum;
  const subtotal = Number(sale.total_amount) + totalDiscount;
  const exchangeRate = parseSaleExchangeSnapshot(sale, settings);

  const data: SalesInvoiceData = {
    invoice_number: sale.invoice_number,
    date: sale.date,
    customer_name: sale.customer_name || 'Walk-in Customer',
    customer_phone: sale.customer_phone,
    customer_email: sale.customer_email,
    salesman_name: sale.salesman_name || sale.user_name,
    payment_method: sale.payment_method || 'Cash',
    payment_status: sale.payment_status || 'paid',
    subtotal,
    discount: totalDiscount,
    tax_amount: Number(sale.tax_amount) || 0,
    tax_rate: Number(sale.tax_rate) || 0,
    total_amount: Number(sale.total_amount),
    paid_amount: Number(sale.received_cash) || 0,
    change_amount: Number(sale.balance_to_return) || 0,
    broker_name: sale.broker_name,
    broker_commission: Number(sale.broker_commission) || 0,
    exchange_rate: exchangeRate,
    footer: settings.receipt_footer || 'Thank you for your business!',
    currency_symbol: sym,
    items: items.map(i => ({
      product_name: i.product_name || i.name || 'Item',
      quantity: Number(i.quantity),
      price: Number(i.price),
      discount: Number(i.discount) || 0,
      carat_weight: i.carat_weight ? Number(i.carat_weight) : undefined,
      shape: i.shape,
      color: i.color,
      clarity: i.clarity,
      origin: i.origin,
      treatment: i.treatment,
      certificate_number: i.certificate_number,
    })),
  };

  return generateSalesInvoicePDF(data, company);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PURCHASE ORDER
// ─────────────────────────────────────────────────────────────────────────────
export function generatePurchaseOrderPDF(data: PurchaseOrderData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;

  let y = addHeader(doc, company, 'PURCHASE ORDER', `PO #${data.po_number}`);

  const left: [string,string][] = [
    ['PO Number:', data.po_number],
    ['Date:', formatDate(data.date_created)],
    ['Expected:', data.expected_date ? formatDate(data.expected_date) : '—'],
    ['Status:', data.status.toUpperCase()],
  ];
  if (data.payment_status) left.push(['Payment:', data.payment_status.toUpperCase()]);

  const right: [string,string][] = [
    ['Supplier:', data.supplier_name],
    ['Phone:', data.supplier_phone || '—'],
    ['Email:', data.supplier_email || '—'],
  ];

  y = addInfoBlock(doc, left, right, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Barcode', 'Qty', 'Unit Price', 'Total']],
    body: data.items.map((item, i) => [
      (i + 1).toString(),
      item.product_name,
      item.barcode || '—',
      item.quantity.toString(),
      fmt(sym, item.expected_price),
      fmt(sym, item.quantity * item.expected_price),
    ]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 28 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  const totalRows: Parameters<typeof addTotalsBlock>[1] = [
    { label: 'ORDER TOTAL', value: fmt(sym, data.total_amount), bold: true, color: T.navy },
  ];
  if (data.paid_amount !== undefined) totalRows.push({ label: 'Paid', value: fmt(sym, data.paid_amount), color: T.green });
  if (data.paid_amount !== undefined) totalRows.push({ label: 'Balance Due', value: fmt(sym, data.total_amount - data.paid_amount), bold: true, color: T.red });

  addTotalsBlock(doc, totalRows, y);

  if (data.notes) {
    y += 30;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...T.gray2);
    doc.text(`Notes: ${data.notes}`, M, y);
  }

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CREDIT NOTE / RETURN
// ─────────────────────────────────────────────────────────────────────────────
export function generateCreditNotePDF(data: CreditNoteData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;
  const title = data.type === 'sales_return' ? 'CREDIT NOTE (SALES RETURN)' : 'DEBIT NOTE (PURCHASE RETURN)';

  let y = addHeader(doc, company, title, `CN #${data.credit_note_number}`);

  const partyName = data.type === 'sales_return' ? data.customer_name : data.supplier_name;
  const left: [string,string][] = [
    ['CN Number:', data.credit_note_number],
    ['Date:', formatDate(data.date)],
    ['Type:', data.type === 'sales_return' ? 'Sales Return' : 'Purchase Return'],
  ];
  if (data.reference_number) left.push(['Ref Invoice:', data.reference_number]);

  const right: [string,string][] = [
    [data.type === 'sales_return' ? 'Customer:' : 'Supplier:', partyName || '—'],
  ];
  if (data.reason) right.push(['Reason:', data.reason]);

  y = addInfoBlock(doc, left, right, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Qty', 'Unit Price', 'Total']],
    body: data.items.map((item, i) => [
      (i + 1).toString(),
      item.product_name,
      item.quantity.toString(),
      fmt(sym, item.price),
      fmt(sym, item.quantity * item.price),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [180, 30, 30], textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  addTotalsBlock(doc, [{ label: 'CREDIT TOTAL', value: fmt(sym, data.total_amount), bold: true, color: [180, 30, 30] }], y);

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CUSTOMER / SUPPLIER STATEMENT
// ─────────────────────────────────────────────────────────────────────────────
export function generateStatementPDF(data: StatementData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;
  const title = data.party_type === 'customer' ? 'CUSTOMER STATEMENT' : 'SUPPLIER STATEMENT';

  let y = addHeader(doc, company, title, `Statement for ${data.party_name}`);

  const left: [string,string][] = [
    [data.party_type === 'customer' ? 'Customer:' : 'Supplier:', data.party_name],
    ['Phone:', data.party_phone || '—'],
    ['Email:', data.party_email || '—'],
  ];
  const right: [string,string][] = [
    ['Statement Date:', formatDate(data.statement_date)],
    ['Opening Balance:', fmt(sym, data.opening_balance)],
  ];

  y = addInfoBlock(doc, left, right, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
    body: data.transactions.map(t => [
      formatDate(t.date),
      t.description,
      t.debit > 0 ? fmt(sym, t.debit) : '—',
      t.credit > 0 ? fmt(sym, t.credit) : '—',
      fmt(sym, t.balance),
    ]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 26 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  const isDebit = data.closing_balance > 0;
  addTotalsBlock(doc, [
    { label: 'CLOSING BALANCE', value: fmt(sym, Math.abs(data.closing_balance)), bold: true, color: isDebit ? T.red : T.green },
    { label: isDebit ? '(Amount Owed)' : '(Credit)', value: '', color: T.gray2 },
  ], y);

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STOCK TAKE REPORT
// ─────────────────────────────────────────────────────────────────────────────
export function generateStockTakePDF(data: StockTakeData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;

  let y = addHeader(doc, company, 'STOCK TAKE REPORT', `Date: ${formatDate(data.date)}`);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Barcode', 'Expected', 'Actual', 'Variance', 'Value']],
    body: data.items.map((item, i) => [
      (i + 1).toString(),
      item.product_name,
      item.barcode || '—',
      item.expected_qty.toString(),
      item.actual_qty.toString(),
      { content: item.variance.toString(), styles: { textColor: item.variance < 0 ? T.red : item.variance > 0 ? T.green : T.black } },
      fmt(sym, item.value),
    ]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  addTotalsBlock(doc, [{ label: 'TOTAL VARIANCE VALUE', value: fmt(sym, data.total_variance_value), bold: true, color: data.total_variance_value < 0 ? T.red : T.navy }], y);

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CHEQUE RECORD
// ─────────────────────────────────────────────────────────────────────────────
export function generateChequePDF(data: ChequeData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;
  const pw = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, company, 'CHEQUE RECORD', `Cheque #${data.cheque_number}`);

  const left: [string,string][] = [
    ['Cheque #:', data.cheque_number],
    ['Date:', formatDate(data.date)],
    ['Bank:', data.bank],
    ['Status:', data.status.toUpperCase()],
  ];
  const right: [string,string][] = [
    ['Payee:', data.payee],
    ['Amount:', fmt(sym, data.amount)],
  ];

  y = addInfoBlock(doc, left, right, y);
  y += 8;

  // Large amount display
  doc.setFillColor(...T.navy);
  doc.roundedRect(M, y, pw - M * 2, 20, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...T.gold);
  doc.text(fmt(sym, data.amount), pw / 2, y + 13, { align: 'center' });

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. LEDGER REPORT
// ─────────────────────────────────────────────────────────────────────────────
export function generateLedgerPDF(data: LedgerData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;

  let y = addHeader(doc, company, 'LEDGER REPORT', `${data.account_name} (${data.account_code})`);

  const left: [string,string][] = [
    ['Account:', `${data.account_name} — ${data.account_code}`],
    ['Period:', `${formatDate(data.start_date)} to ${formatDate(data.end_date)}`],
    ['Opening Balance:', fmt(sym, data.opening_balance)],
  ];

  y = addInfoBlock(doc, left, [], y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']],
    body: data.entries.map(e => [
      formatDate(e.date),
      e.description,
      e.reference || '—',
      e.debit > 0 ? fmt(sym, e.debit) : '—',
      e.credit > 0 ? fmt(sym, e.credit) : '—',
      fmt(sym, e.balance),
    ]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  addTotalsBlock(doc, [{ label: 'CLOSING BALANCE', value: fmt(sym, data.closing_balance), bold: true, color: T.navy }], y);

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. DAYBOOK REPORT
// ─────────────────────────────────────────────────────────────────────────────
export function generateDaybookPDF(data: DaybookData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;
  const pw = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, company, 'DAYBOOK REPORT', `Date: ${formatDate(data.date)}`);

  // Summary cards
  const cardW = (pw - M * 2 - 8) / 3;
  const cards = [
    { label: 'TOTAL INCOME', value: fmt(sym, data.stats.total_income), bg: T.greenBg, text: T.green },
    { label: 'TOTAL EXPENSES', value: fmt(sym, data.stats.total_expenses), bg: T.redBg, text: T.red },
    { label: 'NET CASH FLOW', value: fmt(sym, data.stats.net_cash_flow), bg: data.stats.net_cash_flow >= 0 ? T.greenBg : T.redBg, text: data.stats.net_cash_flow >= 0 ? T.green : T.red },
  ];

  cards.forEach((card, i) => {
    const cx = M + i * (cardW + 4);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.text);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...card.text);
    doc.text(card.label, cx + 4, y + 6);
    doc.setFontSize(11);
    doc.text(card.value, cx + 4, y + 14);
  });

  y += 24;

  autoTable(doc, {
    startY: y,
    head: [['Time', 'Description', 'Type', 'User', 'Amount']],
    body: data.entries.map(e => [
      e.time,
      e.description,
      e.type.charAt(0).toUpperCase() + e.type.slice(1),
      e.user || '—',
      fmt(sym, e.amount),
    ]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. FINANCIAL SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────────────
export function generateFinancialReportPDF(data: FinancialReportData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const sym = data.currency_symbol;

  let y = addHeader(doc, company, 'FINANCIAL SUMMARY', `Generated: ${formatDate(data.date)}`);

  y = addSectionHeading(doc, 'Key Performance Indicators', y);

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Sales', fmt(sym, data.metrics.total_sales)],
      ['Net Profit', fmt(sym, data.metrics.total_profit)],
      ['Profit Margin', `${data.metrics.profit_margin.toFixed(1)}%`],
      ['Sales Returns', `(${fmt(sym, data.metrics.sales_returns)})`],
      ['Inventory Value', fmt(sym, data.metrics.inventory_value)],
      ['Total Receivables', fmt(sym, data.metrics.total_outstanding)],
    ],
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
    tableWidth: 90,
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  y = addSectionHeading(doc, 'Top Receivables', y);

  autoTable(doc, {
    startY: y,
    head: [['Customer / Party', 'Balance', 'Utilization %']],
    body: data.receivables.map(r => [r.name, fmt(sym, r.balance), `${r.utilization.toFixed(1)}%`]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. GEM STOCK REPORT
// ─────────────────────────────────────────────────────────────────────────────
export function generateGemStockReportPDF(data: GemStockReportData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' });
  const sym = data.currency_symbol;

  let y = addHeader(doc, company, 'GEMSTONE STOCK REPORT', `Generated: ${formatDate(data.generated_at)}`);

  // Grand total summary
  const pw = doc.internal.pageSize.getWidth();
  const cardW = (pw - M * 2 - 8) / 3;
  const summaryCards = [
    { label: 'TOTAL PIECES', value: data.grand_total.count.toString() },
    { label: 'TOTAL WEIGHT', value: `${data.grand_total.weight.toFixed(2)} ct` },
    { label: 'TOTAL VALUE', value: fmt(sym, data.grand_total.value) },
  ];
  summaryCards.forEach((card, i) => {
    const cx = M + i * (cardW + 4);
    doc.setFillColor(...T.navy);
    doc.roundedRect(cx, y, cardW, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...T.gold);
    doc.text(card.label, cx + 4, y + 6);
    doc.setFontSize(11);
    doc.setTextColor(...T.white);
    doc.text(card.value, cx + 4, y + 13);
  });

  y += 22;

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Shape', 'Weight Range', 'Pieces', 'Weight (ct)', 'Value']],
    body: data.groups.flatMap(g =>
      Object.entries(g.ranges).map(([range, r]) => [
        g.category,
        g.shape,
        range,
        r.count.toString(),
        r.weight.toFixed(2),
        fmt(sym, r.value),
      ])
    ),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. PRODUCT CARD (single product detail sheet)
// ─────────────────────────────────────────────────────────────────────────────
export function generateProductCardPDF(product: Record<string, any>, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, company, 'PRODUCT DETAIL SHEET', product.name);

  const sym = (company as any).currency_symbol || '';

  // ── Layout: info block on left, image on right ────────────────────────────
  const IMG_W = 50;
  const IMG_H = 50;
  const IMG_X = pw - M - IMG_W;
  const IMG_Y = y;
  const INFO_RIGHT_BOUND = IMG_X - 6; // info block stays left of image

  // Draw image first (behind info block visually, but placed at same y)
  if (product.image_url) {
    try {
      let fmt = 'JPEG';
      if (product.image_url.includes('.png') || product.image_url.startsWith('data:image/png')) fmt = 'PNG';
      doc.addImage(product.image_url, fmt, IMG_X, IMG_Y, IMG_W, IMG_H);
      doc.setDrawColor(...T.gray4);
      doc.setLineWidth(0.3);
      doc.rect(IMG_X, IMG_Y, IMG_W, IMG_H);
    } catch { /* skip if image fails */ }
  }

  // Info block (left side, constrained width)
  const lineH = 5.8;
  const labelW = 32;
  const rows: [string, string][] = [
    ['Product Name:', product.name],
    ['Barcode / SKU:', product.barcode || '—'],
    ['Category:', product.category_name || product.category || '—'],
    ['Pricing Method:', product.pricing_method === 'per_carat' ? 'Per Carat' : 'Per Piece'],
    ['Selling Price:', product.selling_price != null ? `${sym} ${Number(product.selling_price).toFixed(2)}` : '—'],
  ];

  let iy = y;
  doc.setFontSize(8.5);
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...T.gray1);
    doc.text(label, M, iy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...T.black);
    const maxW = INFO_RIGHT_BOUND - M - labelW - 2;
    const lines = doc.splitTextToSize(value, maxW);
    doc.text(lines, M + labelW, iy);
    iy += lineH * lines.length;
  });

  // Advance y past whichever is taller: info block or image
  y = Math.max(iy, product.image_url ? IMG_Y + IMG_H : iy) + 6;

  const gem = product.gem_details;

  if (gem) {
    y = addSectionHeading(doc, 'Gemstone Details', y);

    const gemLeft: [string,string][] = [
      ['Carat Weight:', gem.carat_weight ? `${gem.carat_weight} ct` : '—'],
      ['Shape:', gem.shape || '—'],
      ['Color:', gem.color || '—'],
      ['Clarity:', gem.clarity || '—'],
    ];
    const gemRight: [string,string][] = [
      ['Origin:', gem.origin || '—'],
      ['Treatment:', gem.treatment || '—'],
      ['Cut Grade:', gem.cut_grade || '—'],
      ['Dimensions:', gem.dimensions || '—'],
    ];
    y = addInfoBlock(doc, gemLeft, gemRight, y);

    if (gem.certificate_number || gem.certificate_provider) {
      y += 2;
      y = addSectionHeading(doc, 'Certificate', y);
      const certLeft: [string,string][] = [
        ['Provider:', gem.certificate_provider || '—'],
        ['Number:', gem.certificate_number || '—'],
      ];
      y = addInfoBlock(doc, certLeft, [], y);
    }
  }

  if (product.notes) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...T.gray2);
    const lines = doc.splitTextToSize(`Notes: ${product.notes}`, pw - M * 2);
    doc.text(lines, M, y);
  }

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. CONSIGNMENT MEMO
// ─────────────────────────────────────────────────────────────────────────────
export function generateConsignmentMemoPDF(memo: Record<string, any>, company: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, company, 'CONSIGNMENT MEMO', `Memo #${memo.memo_number}`);

  const left: [string,string][] = [
    ['Memo #:', memo.memo_number],
    ['Date Out:', formatDate(memo.date_out)],
    ['Due Date:', memo.date_due ? formatDate(memo.date_due) : '—'],
    ['Status:', (memo.status || 'pending').toUpperCase()],
  ];
  const right: [string,string][] = [
    ['Customer:', memo.customer_name || '—'],
    ['Phone:', memo.customer_phone || '—'],
    ['Email:', memo.customer_email || '—'],
  ];

  y = addInfoBlock(doc, left, right, y);
  y += 2;

  const items: any[] = memo.items || [];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Qty', 'Carat Wt', 'Price/ct', 'Total', 'Status']],
    body: items.map((item: any, i: number) => [
      (i + 1).toString(),
      item.product_name || '—',
      (item.quantity ?? 0).toString(),
      item.carat_weight ? `${item.carat_weight} ct` : '—',
      item.price_per_carat ? `${item.price_per_carat.toFixed(2)}` : '—',
      item.total_price ? `${item.total_price.toFixed(2)}` : '—',
      (item.status || 'pending').toUpperCase(),
    ]),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 24 },
      6: { cellWidth: 22 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  const totalValue = items.reduce((s: number, i: any) => s + (i.total_price || 0), 0);
  addTotalsBlock(doc, [{ label: 'TOTAL CONSIGNMENT VALUE', value: totalValue.toFixed(2), bold: true, color: T.navy }], y);

  if (memo.notes) {
    y += 30;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...T.gray2);
    doc.text(`Notes: ${memo.notes}`, M, y);
  }

  // Signature lines
  const ph = doc.internal.pageSize.getHeight();
  const sigY = ph - 35;
  doc.setDrawColor(...T.gray3);
  doc.setLineWidth(0.3);
  doc.line(M, sigY, M + 60, sigY);
  doc.line(pw - M - 60, sigY, pw - M, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...T.gray2);
  doc.text('Authorized Signature', M, sigY + 5);
  doc.text('Customer Signature', pw - M - 60, sigY + 5);

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. OFFER LETTER (multi-product price list)
// ─────────────────────────────────────────────────────────────────────────────
export function generateOfferLetterPDF(products: Record<string, any>[], company: CompanyInfo, currencySymbol: string = '$'): jsPDF {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const y = addHeader(doc, company, 'GEMSTONE OFFER LETTER', `Date: ${today}`);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Shape', 'Color', 'Carat Wt', 'Origin', 'Treatment', 'Price']],
    body: products.map((p: any, i: number) => {
      const gem = p.gem_details;
      return [
        (i + 1).toString(),
        p.name,
        gem?.shape || '—',
        gem?.color || '—',
        gem?.carat_weight ? `${gem.carat_weight} ct` : '—',
        gem?.origin || '—',
        gem?.treatment || '—',
        p.selling_price != null ? `${currencySymbol} ${Number(p.selling_price).toFixed(2)}` : '—',
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      4: { halign: 'right', cellWidth: 20 },
      7: { halign: 'right', cellWidth: 24 },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  const y2 = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...T.gray2);
  doc.text('All prices are subject to change. This offer is valid for 7 days from the date above.', M, y2);

  addFooter(doc, company);
  return doc;
}





// ─────────────────────────────────────────────────────────────────────────────
// 14. SALES REPORT — used by Sales History page PDF export
// ─────────────────────────────────────────────────────────────────────────────
export interface SalesReportData {
  generated_at: string;
  date_range?: string;
  currency_symbol: string;
  summary: {
    total_sales: number;
    total_amount: number;
    total_profit: number;
    total_returns: number;
  };
  rows: Array<{
    invoice_number: string;
    date: string;
    customer_name: string;
    payment_method: string;
    type: string;
    total_amount: number;
    profit: number;
    status: string;
  }>;
}

export function generateSalesReportPDF(data: SalesReportData, company: CompanyInfo): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' });
  const sym = data.currency_symbol;
  const subtitle = data.date_range ? `Period: ${data.date_range}` : `Generated: ${formatDate(data.generated_at)}`;

  let y = addHeader(doc, company, 'SALES REPORT', subtitle);

  // Summary KPI row
  const kpis = [
    ['Total Transactions', data.summary.total_sales.toString()],
    ['Total Revenue', fmt(sym, data.summary.total_amount)],
    ['Net Profit', fmt(sym, data.summary.total_profit)],
    ['Returns', data.summary.total_returns.toString()],
    ['Profit Margin', data.summary.total_amount > 0 ? `${((data.summary.total_profit / data.summary.total_amount) * 100).toFixed(1)}%` : '0%'],
  ];

  autoTable(doc, {
    startY: y,
    head: [kpis.map(k => k[0])],
    body: [kpis.map(k => k[1])],
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 10, fontStyle: 'bold', textColor: T.black, halign: 'center' },
    margin: { left: M, right: M },
    styles: { cellPadding: 3, lineColor: T.gray4, lineWidth: 0.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  y = addSectionHeading(doc, 'Transaction Details', y);

  autoTable(doc, {
    startY: y,
    head: [['Invoice', 'Date', 'Customer', 'Payment', 'Type', 'Amount', 'Profit', 'Margin', 'Status']],
    body: data.rows.map(r => {
      const margin = r.total_amount > 0 ? ((r.profit / r.total_amount) * 100).toFixed(1) + '%' : '0%';
      return [
        r.invoice_number,
        formatDate(r.date),
        r.customer_name,
        r.payment_method,
        r.type,
        fmt(sym, r.total_amount),
        fmt(sym, r.profit),
        margin,
        r.status,
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 8, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: T.navy as any },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'center' },
    },
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  addFooter(doc, company);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. GENERIC REPORT — used by ReportTable for any tabular report
// ─────────────────────────────────────────────────────────────────────────────
export function generateGenericReportPDF(
  title: string,
  columns: Array<{ label: string; align?: 'left' | 'right' | 'center' }>,
  rows: string[][],
  company: CompanyInfo,
  subtitle?: string
): jsPDF {
  const doc = new jsPDF({ orientation: rows.length > 0 && columns.length > 6 ? 'landscape' : 'portrait' });

  const sub = subtitle || `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  const y = addHeader(doc, company, title.toUpperCase(), sub);

  const colStyles: Record<number, { halign: 'left' | 'right' | 'center' }> = {};
  columns.forEach((col, i) => {
    if (col.align && col.align !== 'left') {
      colStyles[i] = { halign: col.align };
    }
  });

  autoTable(doc, {
    startY: y,
    head: [columns.map(c => c.label)],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: T.navy, textColor: T.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: T.black },
    alternateRowStyles: { fillColor: T.gray5 },
    columnStyles: colStyles,
    margin: { left: M, right: M },
    styles: { cellPadding: 2.5, lineColor: T.gray4, lineWidth: 0.2 },
  });

  addFooter(doc, company);
  return doc;
}
