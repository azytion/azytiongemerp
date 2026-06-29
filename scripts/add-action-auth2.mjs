import fs from 'fs';
import path from 'path';

const ACTIONS_DIR = path.join(process.cwd(), 'src/app/actions');
const _SKIP = new Set(['auth.ts', 'authz.ts', 'types.ts', 'credit-notes-logic.ts', 'activity-logger.ts']);
const NEEDS_AUTH = new Set([
  'activity-log.ts', 'ai.ts', 'analytics.ts', 'cheques.ts', 'daybook.ts', 'email.ts',
  'inventory.ts', 'invoices.ts', 'ledger.ts', 'memos.ts', 'messaging.ts', 'pos.ts',
  'printing.ts', 'purchase-orders.ts', 'refunds.ts', 'reports.ts', 'reports_advanced.ts',
  'reports_comprehensive.ts', 'reports_extended.ts', 'reports_gem.ts', 'reports_staff.ts',
  'settings.ts', 'super-admin.ts',
]);

for (const file of NEEDS_AUTH) {
  const filePath = path.join(ACTIONS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes("from './authz'")) {
    content = content.replace(/('use server';\s*\n)/, "$1\nimport { requireSession } from './authz';\n");
  }

  content = content.replace(/export async function (\w+)\(([^)]*)\) \{\r?\n(?!\s*await requireSession)/g, (m, name) => {
    if (name === 'login' || name === 'logout') return m;
    return m + '    await requireSession();\n';
  });

  fs.writeFileSync(filePath, content);
  console.log('Patched', file);
}
