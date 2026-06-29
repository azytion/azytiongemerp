// currency helpers live in './currencies' but are not required here

type CSVRow = Record<string, unknown>;
export function downloadCSV(data: ReadonlyArray<CSVRow>, filename: string) {
    if (!data || data.length === 0) {
        console.error("No data to export");
        return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(','), // Header row
        ...data.map((row) => headers.map((fieldName) => {
            const value = row[fieldName];
            // Handle strings with commas or newlines
            if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return typeof value === 'number' || typeof value === 'boolean' ? String(value) : (value ?? '');
        }).join(','))
    ].join('\n');

    // Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Global settings - these should be populated from the provider or API
type FormatSettings = {
    currencyCode: string;
    currencySymbol: string;
    dateFormat: string;
    timeFormat: '12h' | '24h' | string;
    timezone: string;
    country?: string;
};
let formatSettings: FormatSettings = {
    currencyCode: 'USD',
    currencySymbol: '$',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    timezone: 'UTC',
    country: 'US'
};

// Function to update local settings (called from components)
export function updateFormatSettings(settings: Partial<FormatSettings>) {
    formatSettings = {
        ...formatSettings,
        ...settings
    };
}

// Get current currency symbol for display in inputs
export function getCurrentCurrencySymbol(): string {
    return formatSettings.currencySymbol || formatSettings.currencyCode || '$';
}

export function formatCurrency(amount: number): string {
    try {
        const num = Number(amount);
        if (isNaN(num)) return `${formatSettings.currencySymbol || formatSettings.currencyCode} 0.00`;
        const symbol = formatSettings.currencySymbol || formatSettings.currencyCode;
        const abs = Math.abs(num);
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(abs);
        return num < 0 ? `-${symbol} ${formatted}` : `${symbol} ${formatted}`;
    } catch {
        return `${formatSettings.currencyCode} ${Number(amount || 0).toFixed(2)}`;
    }
}

function parseDateForDisplay(dateStr: string | Date): Date {
    if (dateStr instanceof Date) return dateStr;

    const raw = dateStr.trim();
    if (!raw) return new Date(NaN);

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return new Date(`${raw}T00:00:00`);
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
        return new Date(`${raw.replace(' ', 'T')}Z`);
    }

    if (raw.includes('Z') || raw.includes('+') || raw.lastIndexOf('-') > 10) {
        return new Date(raw);
    }

    return new Date(raw);
}

export function formatDate(dateStr: string | Date, options?: { showTime?: boolean }): string {
    if (!dateStr) return '—';
    try {
        const date = parseDateForDisplay(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);

        // Get configured timezone from formatSettings if available
        const targetTimezone = formatSettings.timezone;

        const dtOptions: Intl.DateTimeFormatOptions = {
            timeZone: targetTimezone, // Always use the targetTimezone if set
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...(options?.showTime && {
                hour: '2-digit',
                minute: '2-digit',
            }),
        };

        return new Intl.DateTimeFormat('default', dtOptions).format(date);
    } catch {
        return String(dateStr);
    }
}
