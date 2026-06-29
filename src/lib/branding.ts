export const APP_NAME = 'ZATION GemERP';
export const APP_TAGLINE = 'GEMSTONE INDUSTRY ERP';

const LEGACY_POS_PRODUCT = 'Gem' + 'POS';
const LEGACY_APP_NAMES = new Set([`ZATION ${LEGACY_POS_PRODUCT}`]);

export function normalizeAppName(value?: string | null): string {
    return !value || LEGACY_APP_NAMES.has(value) ? APP_NAME : value;
}
