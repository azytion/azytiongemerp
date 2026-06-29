import { currencies, getCurrencySymbol } from './currencies';

export type ExchangeRate = {
    code: string;
    rate?: number;
    baseAmount: number;
    targetAmount: number;
    enabled: boolean;
    updatedAt?: string;
};

export type ExchangeRateSnapshot = {
    baseCode: string;
    targetCode: string;
    baseSymbol: string;
    targetSymbol: string;
    baseAmount: number;
    targetAmount: number;
    rate: number;
    createdAt: string;
};

export function parseExchangeRates(value?: string | null): ExchangeRate[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => {
                const legacyRate = Number(item.rate);
                const baseAmount = Number(item.baseAmount ?? 1);
                const targetAmount = Number(item.targetAmount ?? legacyRate);

                return {
                    code: String(item.code || item.targetCode || '').toUpperCase(),
                    rate: Number.isFinite(legacyRate) && legacyRate > 0 ? legacyRate : undefined,
                    baseAmount,
                    targetAmount,
                    enabled: item.enabled !== false,
                    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
                };
            })
            .filter((item) =>
                item.code &&
                Number.isFinite(item.baseAmount) &&
                Number.isFinite(item.targetAmount) &&
                item.baseAmount > 0 &&
                item.targetAmount > 0
            );
    } catch {
        return [];
    }
}

export function getExchangeRate(settings: Record<string, string>, targetCode?: string | null) {
    if (settings.exchange_rates_enabled !== 'true') return null;

    const baseCode = (settings.currency_code || 'USD').toUpperCase();
    const code = (targetCode || settings.exchange_display_currency || '').toUpperCase();
    if (!code || code === baseCode) return null;

    const rates = parseExchangeRates(settings.exchange_rates);
    return rates.find((rate) => rate.enabled && rate.code === code) || null;
}

export function convertFromBase(amount: number, rate: ExchangeRate | null) {
    return rate ? amount * (rate.targetAmount / rate.baseAmount) : amount;
}

export function getExchangeSnapshot(settings: Record<string, string>, targetCode?: string | null): ExchangeRateSnapshot | null {
    const rate = getExchangeRate(settings, targetCode);
    if (!rate) return null;

    const baseCode = (settings.currency_code || 'USD').toUpperCase();
    const baseSymbol = settings.currency_symbol || getCurrencySymbol(baseCode);
    const targetSymbol = getCurrencySymbol(rate.code);

    return {
        baseCode,
        targetCode: rate.code,
        baseSymbol,
        targetSymbol,
        baseAmount: rate.baseAmount,
        targetAmount: rate.targetAmount,
        rate: rate.targetAmount / rate.baseAmount,
        createdAt: new Date().toISOString(),
    };
}

export function formatExchangeRateLine(snapshot: ExchangeRateSnapshot | null) {
    if (!snapshot) return '';
    const baseAmount = Number(snapshot.baseAmount);
    const targetAmount = Number(snapshot.targetAmount);
    if (!Number.isFinite(baseAmount) || !Number.isFinite(targetAmount) || baseAmount <= 0 || targetAmount <= 0) return '';
    return `${snapshot.targetAmount} ${snapshot.targetCode} = ${snapshot.baseSymbol} ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    }).format(baseAmount)}`;
}

export function formatExchangeFromSnapshot(amount: number, snapshot: ExchangeRateSnapshot | null) {
    if (!snapshot) return null;
    const rate = Number(snapshot.rate) || (Number(snapshot.targetAmount) / Number(snapshot.baseAmount));
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const converted = amount * rate;
    return {
        code: snapshot.targetCode,
        rate,
        symbol: snapshot.targetSymbol,
        value: converted,
        formatted: `${snapshot.targetSymbol} ${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(converted)}`,
    };
}

export function formatExchangeAmount(amount: number, settings: Record<string, string>, targetCode?: string | null) {
    const snapshot = getExchangeSnapshot(settings, targetCode);
    if (!snapshot) return null;
    const currency = currencies.find((item) => item.code === snapshot.targetCode);
    const converted = amount * snapshot.rate;

    return {
        code: snapshot.targetCode,
        rate: snapshot.rate,
        symbol: currency?.symbol || snapshot.targetSymbol,
        value: converted,
        formatted: `${currency?.symbol || snapshot.targetSymbol} ${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(converted)}`,
    };
}
