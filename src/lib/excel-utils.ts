import ExcelJS from 'exceljs';

type RowObject = Record<string, any>;
type BinaryInput = Buffer | ArrayBuffer | Uint8Array;

function normalizeSheetName(name: string): string {
    return (name || 'Sheet1').replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Sheet1';
}

function addRowsToWorksheet(workbook: ExcelJS.Workbook, rows: RowObject[], sheetName: string) {
    const worksheet = workbook.addWorksheet(normalizeSheetName(sheetName));
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    worksheet.addRow(headers);
    rows.forEach(row => {
        worksheet.addRow(headers.map(header => row[header] ?? ''));
    });
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns = headers.map(header => ({
        key: header,
        width: Math.max(12, Math.min(32, String(header).length + 4)),
    }));
}

function toArrayBuffer(binary: BinaryInput): ArrayBuffer {
    if (binary instanceof ArrayBuffer) return binary;

    const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}

async function rowsToXlsxArrayBuffer(rows: RowObject[], sheetName = 'Sheet1'): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    addRowsToWorksheet(workbook, rows || [], sheetName);
    const buffer = await workbook.xlsx.writeBuffer();
    return toArrayBuffer(buffer as BinaryInput);
}

export async function rowsToXlsxBuffer(rows: RowObject[], sheetName = 'Sheet1'): Promise<Buffer> {
    return Buffer.from(await rowsToXlsxArrayBuffer(rows, sheetName));
}

export async function aoaToXlsxBuffer(rows: any[][], sheetName = 'Sheet1'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(normalizeSheetName(sheetName));
    rows.forEach(row => worksheet.addRow(row));
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns = (rows[0] || []).map((header: any) => ({
        width: Math.max(12, Math.min(32, String(header || '').length + 4)),
    }));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(toArrayBuffer(buffer as BinaryInput));
}

export async function xlsxBufferToRows(buffer: BinaryInput): Promise<RowObject[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values as any[];
    const keys = headers.slice(1).map(value => String(value || '').trim());
    const rows: RowObject[] = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values as any[];
        const item: RowObject = {};
        keys.forEach((key, index) => {
            if (!key) return;
            const value = values[index + 1];
            item[key] = value instanceof Date ? value.toISOString() : value ?? '';
        });
        if (Object.values(item).some(value => value !== '')) rows.push(item);
    });

    return rows;
}

export async function downloadRowsAsXlsx(rows: RowObject[], sheetName: string, filename: string) {
    const buffer = await rowsToXlsxArrayBuffer(rows || [], sheetName);
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
