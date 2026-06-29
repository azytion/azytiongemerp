import bcrypt from 'bcryptjs';
import { getPool } from './mysql-client';

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    pin VARCHAR(50) NULL,
    permissions TEXT NULL,
    is_active TINYINT DEFAULT 1,
    failed_attempts INT DEFAULT 0,
    lock_until VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    balance DOUBLE DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    balance DOUBLE DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS brokers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    notes TEXT NULL,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(255) UNIQUE NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NULL,
    category_id INT NULL,
    stock INT DEFAULT 0,
    reorder_level INT DEFAULT 5,
    cost_price DOUBLE NOT NULL,
    selling_price DOUBLE NOT NULL,
    has_variants TINYINT DEFAULT 0,
    image_url TEXT NULL,
    notes TEXT NULL,
    pricing_method VARCHAR(50) DEFAULT 'per_piece',
    metadata TEXT NULL,
    is_archived TINYINT DEFAULT 0,
    archived_at VARCHAR(50) NULL,
    archived_reason TEXT NULL,
    type VARCHAR(50) DEFAULT 'single',
    parent_lot_id INT NULL,
    parent_set_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(255) UNIQUE NULL,
    barcode VARCHAR(255) UNIQUE NULL,
    stock INT DEFAULT 0,
    reorder_level INT DEFAULT 2,
    cost_price DOUBLE NULL,
    selling_price DOUBLE NULL,
    metadata TEXT NULL,
    image_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS gem_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    variant_id INT NULL,
    carat_weight DOUBLE DEFAULT 0,
    dimensions VARCHAR(255) NULL,
    shape VARCHAR(100) NULL,
    color VARCHAR(100) NULL,
    clarity VARCHAR(100) NULL,
    cut_grade VARCHAR(100) NULL,
    origin VARCHAR(100) NULL,
    treatment VARCHAR(100) NULL,
    certificate_provider VARCHAR(255) NULL,
    certificate_number VARCHAR(255) NULL,
    certificate_url TEXT NULL,
    lot_origin_weight DOUBLE NULL,
    lot_tracking TEXT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS memos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    memo_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id INT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    date_out TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_due TIMESTAMP NULL,
    user_id INT NULL,
    notes TEXT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS memo_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    memo_id INT NOT NULL,
    product_id INT NULL,
    variant_id INT NULL,
    quantity INT NULL,
    carat_weight DOUBLE NULL,
    price_per_carat DOUBLE NULL,
    total_price DOUBLE NULL,
    status VARCHAR(50) DEFAULT 'pending',
    item_returned TINYINT DEFAULT 0,
    item_sold TINYINT DEFAULT 0,
    returned_qty INT DEFAULT 0,
    returned_weight DOUBLE DEFAULT 0,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    client_sale_id VARCHAR(64) UNIQUE NULL,
    customer_id INT NULL,
    total_amount DOUBLE NOT NULL,
    received_cash DOUBLE DEFAULT 0,
    balance_to_return DOUBLE DEFAULT 0,
    payment_method VARCHAR(50) NULL,
    payment_details TEXT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    payment_status VARCHAR(50) DEFAULT 'paid',
    type VARCHAR(50) DEFAULT 'sale',
    discount DOUBLE DEFAULT 0,
    broker_id INT NULL,
    broker_commission DOUBLE DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (broker_id) REFERENCES brokers(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT NOT NULL,
    price DOUBLE NOT NULL,
    discount DOUBLE DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS held_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NULL,
    cart_json TEXT NOT NULL,
    customer_id INT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id INT NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_date TIMESTAMP NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    total_amount DOUBLE DEFAULT 0,
    paid_amount DOUBLE DEFAULT 0,
    notes TEXT NULL,
    user_id INT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    expected_price DOUBLE NULL,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS credit_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    credit_note_number VARCHAR(100) UNIQUE NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL,
    reference_invoice_id INT NULL,
    reference_type VARCHAR(50) NULL,
    amount DOUBLE NOT NULL,
    reason TEXT NULL,
    status VARCHAR(50) DEFAULT 'active',
    return_items TEXT NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS user_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT NULL,
    old_values TEXT NULL,
    new_values TEXT NULL,
    ip_address VARCHAR(50) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS payment_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    account_number VARCHAR(100) NULL,
    balance DOUBLE DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DOUBLE NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    description TEXT NULL,
    balance_after DOUBLE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NULL,
    FOREIGN KEY (account_id) REFERENCES payment_accounts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS daybook (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    time TIME NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    description TEXT NULL,
    debit DOUBLE DEFAULT 0,
    credit DOUBLE DEFAULT 0,
    balance DOUBLE NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_code VARCHAR(50) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    parent_account_id INT NULL,
    balance DOUBLE DEFAULT 0,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_account_id) REFERENCES accounts(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS journal_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    description TEXT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    journal_entry_id INT NOT NULL,
    account_id INT NOT NULL,
    debit DOUBLE DEFAULT 0,
    credit DOUBLE DEFAULT 0,
    description TEXT NULL,
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS cheques (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_number VARCHAR(100) UNIQUE NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NULL,
    amount DOUBLE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payee_name VARCHAR(255) NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    notes TEXT NULL,
    cleared_date DATE NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS cheque_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    notes TEXT NULL,
    user_id INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cheque_id) REFERENCES cheques(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    \`key\` VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NULL,
    category VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS pos_discount_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    min_price DOUBLE NOT NULL,
    max_price DOUBLE NULL,
    discount_type VARCHAR(50) NOT NULL DEFAULT 'fixed',
    discount_value DOUBLE NOT NULL,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    variant_id INT NULL,
    adjustment_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    reason TEXT NULL,
    notes TEXT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS product_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    variant_id INT NULL,
    branch_id INT NULL,
    stock INT DEFAULT 0,
    reorder_level INT DEFAULT 5,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_stock (product_id, variant_id, branch_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS supplier_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NULL,
    supplier_id INT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    document_type VARCHAR(50) DEFAULT 'invoice',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const INDEX_STATEMENTS: string[] = [
  'CREATE INDEX idx_sales_date ON sales(date)',
  'CREATE INDEX idx_sales_customer_id ON sales(customer_id)',
  'CREATE INDEX idx_sales_user_id ON sales(user_id)',
  'CREATE INDEX idx_sales_status ON sales(status)',
  'CREATE INDEX idx_sales_payment_status ON sales(payment_status)',
  'CREATE INDEX idx_sales_payment_method ON sales(payment_method)',
  'CREATE INDEX idx_sales_broker_id ON sales(broker_id)',
  'CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id)',
  'CREATE INDEX idx_sale_items_product_id ON sale_items(product_id)',
  'CREATE INDEX idx_products_barcode ON products(barcode)',
  'CREATE INDEX idx_products_category_id ON products(category_id)',
  'CREATE INDEX idx_products_is_archived ON products(is_archived)',
  'CREATE INDEX idx_customers_name ON customers(name)',
  'CREATE INDEX idx_customers_phone ON customers(phone)',
  'CREATE INDEX idx_inventory_adjustments_date ON inventory_adjustments(date)',
  'CREATE INDEX idx_memos_customer_id ON memos(customer_id)',
  'CREATE INDEX idx_memos_status ON memos(status)',
  'CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id)',
  'CREATE INDEX idx_transactions_reference ON transactions(reference_type, reference_id)',
  'CREATE INDEX idx_daybook_reference ON daybook(reference_type, reference_id)',
  'CREATE INDEX idx_gem_details_product_id ON gem_details(product_id)',
];

const DEFAULT_SETTINGS = [
  { key: 'company_name', value: 'ZATION GemERP', category: 'company' },
  { key: 'company_address', value: '', category: 'company' },
  { key: 'company_phone', value: '+94752723544', category: 'company' },
  { key: 'company_phone_2', value: '', category: 'company' },
  { key: 'company_email', value: 'zationlk@gmail.com', category: 'company' },
  { key: 'company_website', value: 'www.zation.lk', category: 'company' },
  { key: 'company_tax_id', value: '', category: 'company' },
  { key: 'company_logo', value: '', category: 'company' },
  { key: 'tax_enabled', value: 'false', category: 'tax', data_type: 'boolean' },
  { key: 'tax_rate', value: '0', category: 'tax', data_type: 'number' },
  { key: 'tax_name', value: 'Tax', category: 'tax' },
  { key: 'tax_inclusive', value: 'false', category: 'tax', data_type: 'boolean' },
  { key: 'receipt_header', value: '', category: 'receipt' },
  { key: 'receipt_footer', value: 'Thank you for your business!', category: 'receipt' },
  { key: 'receipt_promotional_footer', value: 'Powered By ZATION | +94752723544', category: 'receipt' },
  { key: 'receipt_show_logo', value: 'true', category: 'receipt', data_type: 'boolean' },
  { key: 'receipt_show_barcode', value: 'true', category: 'receipt', data_type: 'boolean' },
  { key: 'receipt_paper_size', value: 'a4', category: 'receipt' },
  { key: 'currency_symbol', value: '$', category: 'system' },
  { key: 'currency_code', value: 'USD', category: 'system' },
  { key: 'exchange_rates_enabled', value: 'false', category: 'system', data_type: 'boolean' },
  { key: 'exchange_display_currency', value: '', category: 'system' },
  { key: 'exchange_rates', value: '[]', category: 'system', data_type: 'json' },
  { key: 'date_format', value: 'MM/DD/YYYY', category: 'system' },
  { key: 'time_format', value: '12h', category: 'system' },
  { key: 'low_stock_threshold', value: '10', category: 'system', data_type: 'number' },
  { key: 'last_auto_export_date', value: '', category: 'system' },
  { key: 'email_notifications', value: 'true', category: 'notification', data_type: 'boolean' },
  { key: 'low_stock_alerts', value: 'true', category: 'notification', data_type: 'boolean' },
  { key: 'smtp_host', value: '', category: 'notification' },
  { key: 'smtp_port', value: '587', category: 'notification', data_type: 'number' },
  { key: 'smtp_user', value: '', category: 'notification' },
  { key: 'smtp_pass', value: '', category: 'notification' },
  { key: 'smtp_secure', value: 'false', category: 'notification', data_type: 'boolean' },
  { key: 'email_from', value: '"ZATION GemERP" <noreply@zationapp.com>', category: 'notification' },
  { key: 'pos_auto_discount_enabled', value: 'false', category: 'pos', data_type: 'boolean' },
  { key: 'pos_auto_print_enabled', value: 'true', category: 'pos', data_type: 'boolean' },
  { key: 'pos_auto_print_format', value: 'a4', category: 'pos' },
  { key: 'pos_product_images_enabled', value: 'true', category: 'pos', data_type: 'boolean' },
  { key: 'printer_method', value: 'a4_pdf', category: 'pos' },
  { key: 'system_printer_name', value: '', category: 'pos' },
  { key: 'subscription_status', value: 'active', category: 'subscription' },
  { key: 'subscription_expiry', value: '', category: 'subscription' },
  { key: 'client_name', value: 'Valued Client', category: 'subscription' },
];

async function ensureColumn(table: string, column: string, definition: string) {
  const pool = getPool();
  const [rows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(rows[0]?.cnt) === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function runSchemaInit(): Promise<void> {
  const pool = getPool();
  const dbName = process.env.MYSQL_DATABASE || 'zation_gempos';

  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query(`USE \`${dbName}\``);
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const stmt of SCHEMA_STATEMENTS) {
    await pool.query(stmt);
  }

  // Additive migrations for existing MySQL installs
  await ensureColumn('sales', 'client_sale_id', 'VARCHAR(64) UNIQUE NULL');

  for (const stmt of INDEX_STATEMENTS) {
    try {
      await pool.query(stmt);
    } catch {
      /* index may already exist */
    }
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await seedDefaults();
}

async function seedDefaults(): Promise<void> {
  const pool = getPool();

  if (process.env.NODE_ENV !== 'production') {
    // Dev seed users — passwords at cost 10 for faster startup
    const devUsers: [string, string, string, string][] = [
      ['admin',   bcrypt.hashSync('admin',   10), 'admin',   bcrypt.hashSync('1234', 10)],
      ['manager', bcrypt.hashSync('manager', 10), 'manager', bcrypt.hashSync('4321', 10)],
      ['cashier', bcrypt.hashSync('cashier', 10), 'cashier', bcrypt.hashSync('0000', 10)],
    ];
    for (const [username, hash, role, pinHash] of devUsers) {
      await pool.execute(
        'INSERT IGNORE INTO users (username, password_hash, role, pin) VALUES (?, ?, ?, ?)',
        [username, hash, role, pinHash]
      );
    }
  } else if (process.env.INITIAL_ADMIN_PASSWORD) {
    await pool.execute(
      'INSERT IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      ['admin', bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD, 12), 'admin']
    );
  }

  for (const setting of DEFAULT_SETTINGS) {
    await pool.execute(
      'INSERT IGNORE INTO settings (`key`, value, category, data_type) VALUES (?, ?, ?, ?)',
      [setting.key, setting.value, setting.category, (setting as { data_type?: string }).data_type || 'string']
    );
  }

  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || '';
  if (superAdminPassword) {
    const hash = bcrypt.hashSync(superAdminPassword, 12);
    // INSERT IGNORE only — never overwrite a password that was changed via the UI
    await pool.execute(
      'INSERT IGNORE INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      ['zationlk', hash, 'super_admin']
    );
    // Only ensure role and is_active are correct; do NOT overwrite password_hash
    await pool.execute(
      "UPDATE users SET role = 'super_admin', is_active = 1 WHERE username = 'zationlk' AND password_hash != ?",
      [hash]
    );
  }
}

/** Legacy export for setup route compatibility */
export async function initDb(): Promise<void> {
  await runSchemaInit();
}
