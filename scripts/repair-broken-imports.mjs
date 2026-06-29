/**
 * Remove orphaned import fragments left by aggressive lint auto-fix.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'src');
const SCRIPTS = path.join(process.cwd(), 'scripts');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.next'].includes(entry.name)) walk(full, files);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const orphanPattern = /^\s*['"][^'"]+['"];\s*(\/\/.*)?$/;

let removed = 0;

for (const file of [...walk(ROOT), ...walk(SCRIPTS)]) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const next = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed === "'use client';" || trimmed === '"use client";' || trimmed === "'use server';" || trimmed === '"use server";') return true;
    if (orphanPattern.test(line)) {
      removed++;
      return false;
    }
    return true;
  });
  if (next.length !== lines.length) {
    fs.writeFileSync(file, next.join('\n'));
  }
}

// Manual structural fixes
const fixes = [
  {
    file: 'src/app/settings/components/UsersSettings.tsx',
    from: "import { Plus, Edit, Trash2, X, Shield, Users as , Search, Filter } from 'lucide-react';",
    to: "import { Plus, Edit, Trash2, X, Shield, Users, Search, Filter } from 'lucide-react';",
  },
  {
    file: 'src/app/reports/components/InventoryAnalyticsTab.tsx',
    from: `import {
    _PieChart, _Pie, _Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, _Legend
} from 'recharts';`,
    to: `import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';`,
  },
  {
    file: 'src/app/reports/components/InventoryAnalyticsTab.tsx',
    from: "import { Box, PieChart as , BarChart3, Info, Landmark, TrendingUp, Activity } from 'lucide-react';",
    to: "import { Box, BarChart3, Info, Landmark, TrendingUp, Activity } from 'lucide-react';",
  },
  {
    file: 'src/app/reports/components/InventoryAnalyticsTab.tsx',
    from: "const _COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];\n\n",
    to: '',
  },
  {
    file: 'src/app/pos/PosTerminal.tsx',
    from: `import { 
    Search, 
    ShoppingCart, 
    _Trash2, 
    Plus, 
    Minus, 
    X, 
    User, 
    Printer, 
    Tag, 
    Mail, 
    CheckCircle, 
    DollarSign, 
    MessageSquare, 
    FileText, 
    _Package, 
    Gem,
    ChevronDown,
    PauseCircle,
    _PlayCircle,
    Clock,
    _LogOut,
    Cloud,
    CloudOff,
    RefreshCw,
    Users as UsersIcon,
    HandCoins
} from 'lucide-react';`,
    to: `import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    X,
    User,
    Printer,
    Tag,
    Mail,
    CheckCircle,
    DollarSign,
    MessageSquare,
    FileText,
    Gem,
    ChevronDown,
    PauseCircle,
    Clock,
    Cloud,
    CloudOff,
    RefreshCw,
    Users as UsersIcon,
    HandCoins
} from 'lucide-react';`,
  },
  {
    file: 'src/app/customers/components/CustomersClientPage.tsx',
    from: 'export default function CustomersClientPage({ customersResult, query, _settings, page }',
    to: 'export default function CustomersClientPage({ customersResult, query, settings: _settings, page }',
  },
];

for (const { file, from, to } of fixes) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  let c = fs.readFileSync(fullPath, 'utf8');
  if (c.includes(from)) {
    c = c.replace(from, to);
    fs.writeFileSync(fullPath, c);
    console.log('Fixed', file);
  }
}

console.log(`Removed ${removed} orphan import lines`);
