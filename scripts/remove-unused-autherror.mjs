import fs from 'fs';
import path from 'path';

const actionsDir = path.join(process.cwd(), 'src', 'app', 'actions');
let fixed = 0;

for (const file of fs.readdirSync(actionsDir).filter((f) => f.endsWith('.ts'))) {
  const full = path.join(actionsDir, file);
  const content = fs.readFileSync(full, 'utf8');
  if (!content.includes('authError')) continue;
  if (/\bauthError\s*\(/.test(content)) continue;

  const updated = content
    .replace(/,\s*authError\b/g, '')
    .replace(/\bauthError\s*,\s*/g, '')
    .replace(/\{\s*authError\s*\}/g, '{}');

  if (updated !== content) {
    fs.writeFileSync(full, updated);
    fixed++;
    console.log('Removed unused authError from', file);
  }
}

console.log(`Done. Fixed ${fixed} files.`);
