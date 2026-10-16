/**
 * Production environment variable validation.
 * Called once during server startup via mysql-init.ts.
 * Logs clear error messages for missing/insecure config without crashing
 * non-critical missing vars (only JWT_SECRET and DB connection are blocking).
 */

interface EnvCheck {
    key: string;
    required: boolean;
    insecureValues?: string[];
    description: string;
}

const CHECKS: EnvCheck[] = [
    {
        key: 'JWT_SECRET',
        required: true,
        insecureValues: ['zation-pos-secret-key-change-this', 'azytion-pos-secret-key-change-this'],
        description: 'JWT signing secret — generate with: openssl rand -base64 32',
    },
    {
        key: 'SECRET_KEY',
        required: false,
        insecureValues: [],
        description: 'AES encryption key for stored secrets (SMTP passwords, API keys)',
    },
    {
        key: 'CRON_SECRET',
        required: false,
        description: 'Secret for the /api/cron/backup endpoint',
    },
    {
        key: 'SETUP_SECRET',
        required: false,
        description: 'Secret for the /api/setup database initialisation endpoint',
    },
    {
        key: 'INITIAL_ADMIN_PASSWORD',
        required: false,
        description: 'First-run admin user password (only used once on first deploy)',
    },
    {
        key: 'SUPER_ADMIN_PASSWORD',
        required: false,
        description: 'Super admin user password (INSERT IGNORE — only set on first deploy)',
    },
];

const g = globalThis as typeof globalThis & { __envChecked?: boolean };

export function checkProductionEnv(): void {
    if (process.env.NODE_ENV !== 'production') return;
    if (g.__envChecked) return;
    g.__envChecked = true;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Must have a DB connection configured
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDbParts = !!(process.env.MYSQL_HOST || process.env.MYSQL_USER);
    if (!hasDbUrl && !hasDbParts) {
        errors.push('DATABASE_URL or MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE must be set');
    }

    for (const check of CHECKS) {
        const val = process.env[check.key];
        if (!val) {
            if (check.required) {
                errors.push(`${check.key} is required — ${check.description}`);
            } else {
                warnings.push(`${check.key} is not set — ${check.description}`);
            }
            continue;
        }
        if (check.insecureValues?.includes(val)) {
            errors.push(`${check.key} is set to an insecure default value — ${check.description}`);
        }
    }

    if (errors.length > 0) {
        console.error('\n╔══════════════════════════════════════════════════════════════╗');
        console.error('║  AZYTION GemERP — PRODUCTION CONFIGURATION ERRORS           ║');
        console.error('╚══════════════════════════════════════════════════════════════╝');
        for (const e of errors) console.error(`  ✗ ${e}`);
        console.error('\nThe application may not function correctly until these are fixed.');
        console.error('See .env.example for all required variables.\n');
        // Don't throw — let the app start so the error is visible in hosting logs.
        // JWT_SECRET absence will cause a throw when the first login is attempted.
    }

    if (warnings.length > 0) {
        console.warn('\n[GemERP] Production config warnings:');
        for (const w of warnings) console.warn(`  ⚠ ${w}`);
        console.warn('');
    }
}
