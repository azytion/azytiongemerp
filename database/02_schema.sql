-- Azytion GemERP — table schema (30 tables)
-- Source of truth: src/lib/mysql-init.ts

USE `zationgemerp`;

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  balance DOUBLE DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  balance DOUBLE DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS brokers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_variants (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gem_details (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS memos (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS memo_items (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sale_items (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS held_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NULL,
  cart_json TEXT NOT NULL,
  customer_id INT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_orders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  expected_price DOUBLE NULL,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS credit_notes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_activity_log (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  account_number VARCHAR(100) NULL,
  balance DOUBLE DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daybook (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_code VARCHAR(50) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  parent_account_id INT NULL,
  balance DOUBLE DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_number VARCHAR(100) UNIQUE NOT NULL,
  date DATE NOT NULL,
  description TEXT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id INT NULL,
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  debit DOUBLE DEFAULT 0,
  credit DOUBLE DEFAULT 0,
  description TEXT NULL,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cheques (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cheque_history (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NULL,
  category VARCHAR(100) NOT NULL,
  data_type VARCHAR(50) DEFAULT 'string',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_discount_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  min_price DOUBLE NOT NULL,
  max_price DOUBLE NULL,
  discount_type VARCHAR(50) NOT NULL DEFAULT 'fixed',
  discount_value DOUBLE NOT NULL,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_adjustments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  variant_id INT NULL,
  branch_id INT NULL,
  stock INT DEFAULT 0,
  reorder_level INT DEFAULT 5,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_stock (product_id, variant_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NULL,
  supplier_id INT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_url TEXT NOT NULL,
  document_type VARCHAR(50) DEFAULT 'invoice',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
