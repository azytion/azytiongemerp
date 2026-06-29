-- ZATION GemERP — performance indexes
-- Duplicate index errors are ignored when re-running.

USE `zation_gempos`;

CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);
CREATE INDEX idx_sales_broker_id ON sales(broker_id);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_archived ON products(is_archived);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_inventory_adjustments_date ON inventory_adjustments(date);
CREATE INDEX idx_memos_customer_id ON memos(customer_id);
CREATE INDEX idx_memos_status ON memos(status);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_transactions_reference ON transactions(reference_type, reference_id);
CREATE INDEX idx_daybook_reference ON daybook(reference_type, reference_id);
CREATE INDEX idx_gem_details_product_id ON gem_details(product_id);
