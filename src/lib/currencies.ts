export const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
];

export const getCurrencySymbol = (code: string) => {
    const currency = currencies.find(c => c.code === code);
    return currency ? currency.symbol : code;
};
