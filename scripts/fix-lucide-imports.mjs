import fs from 'fs';
import path from 'path';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.next'].includes(entry.name)) walk(full, files);
    else if (full.endsWith('.tsx')) files.push(full);
  }
  return files;
}

let fixed = 0;

for (const file of walk(path.join(process.cwd(), 'src'))) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g,
    (match, inner) => {
      const parts = inner.split(',').map((p) => p.trim()).filter(Boolean);
      const kept = parts.filter((p) => {
        const name = p.includes(' as ') ? p.split(' as ')[0].trim() : p;
        return !name.startsWith('_');
      });
      if (kept.length === parts.length) return match;
      if (kept.length === 0) return '';
      return `import { ${kept.join(', ')} } from 'lucide-react'`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    fixed++;
    console.log('Fixed lucide imports:', file);
  }
}

console.log(`Done. ${fixed} files updated.`);
