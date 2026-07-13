-- Zyro RMS — Initial PostgreSQL Schema
-- Covers all 20 V1 modules. Raw SQL only. Multi-tenant-ready via store_id.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'draft');
CREATE TYPE variant_status AS ENUM ('active', 'inactive');
CREATE TYPE stock_movement_type AS ENUM (
  'sale',
  'return',
  'exchange_in',
  'exchange_out',
  'adjustment',
  'damage',
  'loss',
  'opening_stock',
  'stock_receive'
);
CREATE TYPE cash_session_status AS ENUM ('open', 'closed');
CREATE TYPE sale_status AS ENUM ('completed', 'voided');
CREATE TYPE payment_method AS ENUM (
  'cash',
  'card',
  'jazzcash',
  'easypaisa',
  'bank_transfer',
  'store_credit'
);
CREATE TYPE exchange_type AS ENUM ('return', 'exchange');
CREATE TYPE exchange_status AS ENUM ('completed', 'voided');
CREATE TYPE exchange_disposition AS ENUM ('restock', 'damaged');
CREATE TYPE promotion_type AS ENUM ('percentage', 'fixed', 'bogo');
CREATE TYPE promotion_scope AS ENUM ('product', 'category', 'brand', 'store_wide');
CREATE TYPE promotion_precedence AS ENUM ('highest_discount', 'most_specific');
CREATE TYPE hold_cart_status AS ENUM ('held', 'resumed', 'completed', 'cancelled');
CREATE TYPE backup_type AS ENUM ('manual', 'automatic');
CREATE TYPE backup_status AS ENUM ('success', 'failed');
CREATE TYPE whatsapp_summary_status AS ENUM ('queued', 'sent', 'failed');
CREATE TYPE invoice_print_status AS ENUM ('queued', 'printed', 'failed');
CREATE TYPE invoice_format AS ENUM ('thermal', 'a4');
CREATE TYPE license_status AS ENUM ('active', 'trial', 'expired');

-- ---------------------------------------------------------------------------
-- CORE / SETTINGS
-- ---------------------------------------------------------------------------

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_path TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Pakistan',
  phone TEXT,
  tax_id TEXT,
  business_day_start_time TIME NOT NULL DEFAULT '09:00:00',
  currency_code VARCHAR(3) NOT NULL DEFAULT 'PKR',
  currency_symbol VARCHAR(8) NOT NULL DEFAULT 'Rs.',
  timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
  default_language VARCHAR(20) NOT NULL DEFAULT 'en',
  return_policy_days INT NOT NULL DEFAULT 7,
  allow_oversell BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tax_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 100),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  section VARCHAR(50) NOT NULL CHECK (
    section IN (
      'business',
      'receipt',
      'currency',
      'tax',
      'language',
      'printer',
      'backup',
      'barcode',
      'shortcuts',
      'system',
      'whatsapp'
    )
  ),
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, section)
);

CREATE TABLE keyboard_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  action_key VARCHAR(80) NOT NULL,
  shortcut_keys VARCHAR(80) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, action_key)
);

CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  activation_key TEXT NOT NULL,
  hardware_fingerprint TEXT,
  status license_status NOT NULL DEFAULT 'active',
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- AUTH / RBAC
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  module VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  username VARCHAR(80) NOT NULL,
  email TEXT,
  password_hash TEXT,
  pin_hash TEXT,
  status user_status NOT NULL DEFAULT 'active',
  default_landing_screen VARCHAR(30) NOT NULL DEFAULT 'dashboard',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (username),
  CHECK (password_hash IS NOT NULL OR pin_hash IS NOT NULL)
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  device_info TEXT,
  ip_address INET,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recovery_code_hash TEXT NOT NULL,
  security_question TEXT,
  security_answer_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CATALOG: CATEGORIES, BRANDS, ATTRIBUTES, PRODUCTS, VARIANTS
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  parent_category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  image_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name, parent_category_id)
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE TABLE attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE TABLE attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  code VARCHAR(20) NOT NULL,
  swatch_hex VARCHAR(7),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attribute_id, value),
  UNIQUE (attribute_id, code)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT,
  tax_class_id UUID REFERENCES tax_classes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  base_sku VARCHAR(80) NOT NULL,
  default_selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (default_selling_price >= 0),
  default_cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (default_cost_price >= 0),
  status product_status NOT NULL DEFAULT 'active',
  attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, base_sku)
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID,
  file_path TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_attributes (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE RESTRICT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, attribute_id)
);

CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(120) NOT NULL UNIQUE,
  barcode VARCHAR(120) NOT NULL UNIQUE,
  selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  discount_override NUMERIC(12, 2),
  status variant_status NOT NULL DEFAULT 'active',
  image_id UUID REFERENCES product_images(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_images
  ADD CONSTRAINT fk_product_images_variant
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE;

CREATE TABLE variant_attribute_values (
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (variant_id, attribute_value_id)
);

-- ---------------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------------

CREATE TABLE inventory (
  variant_id UUID PRIMARY KEY REFERENCES variants(id) ON DELETE CASCADE,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  reorder_threshold INT NOT NULL DEFAULT 5 CHECK (reorder_threshold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  movement_type stock_movement_type NOT NULL,
  quantity_delta INT NOT NULL,
  resulting_balance INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone VARCHAR(30),
  email TEXT,
  address TEXT,
  notes TEXT,
  loyalty_points INT NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_delta INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CASH REGISTER
-- ---------------------------------------------------------------------------

CREATE TABLE cash_register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opening_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  expected_closing_amount NUMERIC(12, 2),
  actual_closing_amount NUMERIC(12, 2),
  variance NUMERIC(12, 2),
  variance_note TEXT,
  total_transactions INT NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_discounts NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_returns INT NOT NULL DEFAULT 0,
  status cash_session_status NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- POS / SALES + HOLD CART
-- ---------------------------------------------------------------------------

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cash_register_session_id UUID REFERENCES cash_register_sessions(id) ON DELETE RESTRICT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status sale_status NOT NULL DEFAULT 'completed',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_number)
);

CREATE TABLE sale_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
  promotion_id UUID,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_at_sale NUMERIC(12, 2) NOT NULL CHECK (unit_price_at_sale >= 0),
  line_discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  cost_price_at_sale NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price_at_sale >= 0),
  returned_quantity INT NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hold_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  label VARCHAR(100),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status hold_cart_status NOT NULL DEFAULT 'held',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hold_cart_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_cart_id UUID NOT NULL REFERENCES hold_carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  exchange_id UUID,
  method payment_method NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  tendered_amount NUMERIC(12, 2),
  change_amount NUMERIC(12, 2),
  reference_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sale_id IS NOT NULL OR exchange_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- EXCHANGES & RETURNS
-- ---------------------------------------------------------------------------

CREATE TABLE exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  exchange_number VARCHAR(50) NOT NULL,
  exchange_type exchange_type NOT NULL,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status exchange_status NOT NULL DEFAULT 'completed',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exchange_number)
);

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_exchange
  FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE;

CREATE TABLE exchange_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  original_sale_line_id UUID REFERENCES sale_lines(id) ON DELETE RESTRICT,
  new_variant_id UUID REFERENCES variants(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  disposition exchange_disposition,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (original_sale_line_id IS NOT NULL OR new_variant_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- PROMOTIONS / SEASONAL SALES
-- ---------------------------------------------------------------------------

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  promotion_type promotion_type NOT NULL,
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value >= 0),
  scope_type promotion_scope NOT NULL,
  scope_id UUID,
  coupon_code VARCHAR(50),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  precedence_rule promotion_precedence NOT NULL DEFAULT 'most_specific',
  is_active_cache BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INT NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

ALTER TABLE sale_lines
  ADD CONSTRAINT fk_sale_lines_promotion
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL;

CREATE TABLE promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  sale_line_id UUID REFERENCES sale_lines(id) ON DELETE SET NULL,
  discounted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EXPENSES
-- ---------------------------------------------------------------------------

CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  note TEXT,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INVOICES / BARCODE LABELS / BACKUP / WHATSAPP / AUDIT
-- ---------------------------------------------------------------------------

CREATE TABLE invoice_print_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  format invoice_format NOT NULL DEFAULT 'thermal',
  status invoice_print_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE barcode_label_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  variant_ids UUID[] NOT NULL,
  template_key VARCHAR(50) NOT NULL DEFAULT 'default',
  copies INT NOT NULL DEFAULT 1 CHECK (copies > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  backup_type backup_type NOT NULL,
  status backup_status NOT NULL,
  size_bytes BIGINT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status whatsapp_summary_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, summary_date, recipient_phone)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- SYNC SUPPORT (offline hybrid)
-- ---------------------------------------------------------------------------

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX idx_tax_classes_store_id ON tax_classes(store_id);
CREATE INDEX idx_store_settings_store_section ON store_settings(store_id, section);
CREATE INDEX idx_users_store_id ON users(store_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_categories_store_id ON categories(store_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_category_id);
CREATE INDEX idx_brands_store_id ON brands(store_id);
CREATE INDEX idx_attributes_store_id ON attributes(store_id);
CREATE INDEX idx_attribute_values_attribute_id ON attribute_values(attribute_id);
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_name_search ON products USING gin (to_tsvector('simple', name));
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_variants_product_id ON variants(product_id);
CREATE INDEX idx_variants_sku ON variants(sku);
CREATE INDEX idx_variants_barcode ON variants(barcode);
CREATE INDEX idx_inventory_quantity ON inventory(quantity_on_hand);
CREATE INDEX idx_stock_movements_variant_created ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name_search ON customers USING gin (to_tsvector('simple', name));
CREATE INDEX idx_cash_sessions_store_status ON cash_register_sessions(store_id, status);
CREATE INDEX idx_cash_sessions_user_id ON cash_register_sessions(user_id);
CREATE INDEX idx_sales_store_created ON sales(store_id, created_at DESC);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_session_id ON sales(cash_register_session_id);
CREATE INDEX idx_sale_lines_sale_id ON sale_lines(sale_id);
CREATE INDEX idx_sale_lines_variant_id ON sale_lines(variant_id);
CREATE INDEX idx_hold_carts_store_status ON hold_carts(store_id, status);
CREATE INDEX idx_hold_cart_lines_cart_id ON hold_cart_lines(hold_cart_id);
CREATE INDEX idx_payments_sale_id ON payments(sale_id);
CREATE INDEX idx_payments_exchange_id ON payments(exchange_id);
CREATE INDEX idx_exchanges_store_created ON exchanges(store_id, created_at DESC);
CREATE INDEX idx_exchanges_original_sale ON exchanges(original_sale_id);
CREATE INDEX idx_exchange_lines_exchange_id ON exchange_lines(exchange_id);
CREATE INDEX idx_promotions_store_dates ON promotions(store_id, start_at, end_at);
CREATE INDEX idx_promotions_scope ON promotions(scope_type, scope_id);
CREATE INDEX idx_promotion_redemptions_promotion ON promotion_redemptions(promotion_id);
CREATE INDEX idx_expenses_store_date ON expenses(store_id, expense_date DESC);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_invoice_print_logs_sale_id ON invoice_print_logs(sale_id);
CREATE INDEX idx_backups_store_created ON backups(store_id, created_at DESC);
CREATE INDEX idx_whatsapp_summaries_store_date ON whatsapp_summaries(store_id, summary_date DESC);
CREATE INDEX idx_audit_log_store_created ON audit_log(store_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_tax_classes_updated_at BEFORE UPDATE ON tax_classes FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_store_settings_updated_at BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_keyboard_shortcuts_updated_at BEFORE UPDATE ON keyboard_shortcuts FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_licenses_updated_at BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_attributes_updated_at BEFORE UPDATE ON attributes FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_attribute_values_updated_at BEFORE UPDATE ON attribute_values FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_variants_updated_at BEFORE UPDATE ON variants FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_hold_carts_updated_at BEFORE UPDATE ON hold_carts FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_expense_categories_updated_at BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
