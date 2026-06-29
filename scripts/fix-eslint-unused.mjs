/**
 * Prefix unused catch bindings with _ to satisfy @typescript-eslint/no-unused-vars.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let fixed = 0;

for (const file of walk(SRC)) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(
    /catch\s*\(\s*(error|e|err)\s*\)\s*\{/g,
    (match, name) => {
      // Only rename if the next ~500 chars don't use the binding (simple heuristic)
      const idx = content.indexOf(match);
      const slice = content.slice(idx, idx + 600);
      const bodyEnd = slice.indexOf('}');
      const body = slice.slice(match.length, bodyEnd > 0 ? bodyEnd : slice.length);
      if (new RegExp(`\\b${name}\\b`).test(body)) return match;
      fixed++;
      return `catch (_${name}) {`;
    }
  );

  if (content !== original) fs.writeFileSync(file, content);
}

console.log(`Prefixed ${fixed} unused catch bindings with _`);
