/**
 * Adds requireSession() guard to exported async functions in action files
 * that don't already use requireSession/requireAnyRole/requireMinRole.
 */
import fs from 'fs';
import path from 'path';

const ACTIONS_DIR = path.join(process.cwd(), 'src/app/actions');
const SKIP = new Set(['auth.ts', 'authz.ts', 'types.ts', 'credit-notes-logic.ts', 'activity-logger.ts']);

const files = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.ts') && !SKIP.has(f));

for (const file of files) {
  const filePath = path.join(ACTIONS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('requireSession') || content.includes('requireAnyRole') || content.includes('requireMinRole')) {
    continue;
  }

  if (!content.includes("'use server'")) continue;

  // Add import
  if (!content.includes("from './authz'")) {
    content = content.replace(
      /('use server';\s*\n)/,
      "$1\nimport { requireSession, authError } from './authz';\n"
    );
  }

  // Add guard after opening brace of each export async function
  content = content.replace(
    /export async function (\w+)\([^)]*\) \{\n/g,
    (match, fnName) => {
      if (fnName === 'login' || fnName === 'logout') return match;
      return `${match}    try { await requireSession(); } catch (e) { return authError(e); }\n`;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log('Auth added:', file);
}
