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

const hooks = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useRouter', 'useSearchParams'];
let fixed = 0;

for (const file of walk(path.join(process.cwd(), 'src'))) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("'use client'") || content.includes('"use client"')) continue;
  if (!hooks.some((h) => content.includes(h))) continue;

  content = `'use client';\n\n${content.replace(/^\s+/, '')}`;
  fs.writeFileSync(file, content);
  fixed++;
  console.log('Restored use client:', file);
}

console.log(`Fixed ${fixed} files`);
