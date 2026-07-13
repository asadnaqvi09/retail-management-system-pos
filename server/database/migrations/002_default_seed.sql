-- Zyro RMS — Default seed data (idempotent)
-- Safe to re-run: only inserts when records are missing.

-- Default store
INSERT INTO stores (
  name,
  email,
  website,
  address,
  city,
  country,
  phone,
  tax_id,
  currency_code,
  currency_symbol
)
SELECT
  'Zyro Fashion Store',
  'store@zyrofashion.pk',
  'www.zyrofashion.pk',
  '23-B, MM Alam Road, Gulberg III',
  'Lahore',
  'Pakistan',
  '+92 300 1234567',
  'NTN-1234567-8',
  'PKR',
  'Rs.'
WHERE NOT EXISTS (SELECT 1 FROM stores);

-- Default tax class
INSERT INTO tax_classes (store_id, name, rate, is_default)
SELECT s.id, 'Standard VAT', 5.00, TRUE
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM tax_classes t WHERE t.store_id = s.id AND t.name = 'Standard VAT'
);

-- Roles
INSERT INTO roles (store_id, name, description, is_system)
SELECT s.id, 'Admin', 'Full system access', TRUE
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.store_id = s.id AND r.name = 'Admin'
);

INSERT INTO roles (store_id, name, description, is_system)
SELECT s.id, 'Cashier', 'POS and front-desk operations', TRUE
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.store_id = s.id AND r.name = 'Cashier'
);

-- Permissions
INSERT INTO permissions (key, description, module) VALUES
  ('auth.login', 'Login to application', 'auth'),
  ('auth.manage_users', 'Manage users and roles', 'auth'),
  ('dashboard.view', 'View dashboard', 'dashboard'),
  ('products.view', 'View products', 'products'),
  ('products.create', 'Create products', 'products'),
  ('products.update', 'Update products', 'products'),
  ('products.delete', 'Archive products', 'products'),
  ('categories.manage', 'Manage categories', 'categories'),
  ('brands.manage', 'Manage brands', 'brands'),
  ('variants.manage', 'Manage variant matrix', 'variants'),
  ('inventory.view', 'View inventory', 'inventory'),
  ('inventory.adjust', 'Adjust stock', 'inventory'),
  ('customers.view', 'View customers', 'customers'),
  ('customers.manage', 'Manage customers', 'customers'),
  ('sales.create', 'Create sales', 'sales'),
  ('sales.view', 'View sales history', 'sales'),
  ('sales.void', 'Void sales', 'sales'),
  ('sales.hold_cart', 'Hold and resume carts', 'sales'),
  ('exchanges.manage', 'Process exchanges and returns', 'exchanges'),
  ('expenses.view', 'View expenses', 'expenses'),
  ('expenses.manage', 'Manage expenses', 'expenses'),
  ('reports.view', 'View reports', 'reports'),
  ('reports.export', 'Export reports', 'reports'),
  ('cash_register.open_close', 'Open and close cash register', 'cash-register'),
  ('barcodes.print', 'Print barcode labels', 'barcodes'),
  ('invoices.print', 'Print invoices', 'invoices'),
  ('whatsapp.manage', 'Manage WhatsApp summaries', 'whatsapp'),
  ('backup.manage', 'Manage backups', 'backup'),
  ('settings.view', 'View settings', 'settings'),
  ('settings.manage', 'Update settings', 'settings'),
  ('promotions.manage', 'Manage seasonal promotions', 'promotions')
ON CONFLICT (key) DO NOTHING;

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Cashier permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'auth.login',
  'dashboard.view',
  'products.view',
  'inventory.view',
  'customers.view',
  'customers.manage',
  'sales.create',
  'sales.view',
  'sales.hold_cart',
  'exchanges.manage',
  'cash_register.open_close',
  'invoices.print',
  'barcodes.print'
)
WHERE r.name = 'Cashier'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Default expense categories
INSERT INTO expense_categories (store_id, name, is_system)
SELECT s.id, category_name, TRUE
FROM stores s
CROSS JOIN (
  VALUES
    ('Rent'),
    ('Electricity'),
    ('Internet'),
    ('Salary'),
    ('Miscellaneous')
) AS c(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories ec
  WHERE ec.store_id = s.id AND ec.name = c.category_name
);

-- Default variant attributes: Color + Size
INSERT INTO attributes (store_id, name, display_order)
SELECT s.id, 'Color', 1
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM attributes a WHERE a.store_id = s.id AND a.name = 'Color'
);

INSERT INTO attributes (store_id, name, display_order)
SELECT s.id, 'Size', 2
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM attributes a WHERE a.store_id = s.id AND a.name = 'Size'
);

INSERT INTO attribute_values (attribute_id, value, code, swatch_hex, display_order)
SELECT a.id, v.value_name, v.code_name, v.swatch, v.sort_order
FROM attributes a
JOIN stores s ON s.id = a.store_id
JOIN (
  VALUES
    ('Black', 'BLK', '#1a1a1a', 1),
    ('White', 'WHT', '#f5f5f5', 2),
    ('Grey', 'GRY', '#9090a0', 3),
    ('Navy', 'NVY', '#1e3a5f', 4),
    ('Blue', 'BLU', '#2563eb', 5)
) AS v(value_name, code_name, swatch, sort_order) ON TRUE
WHERE a.name = 'Color'
  AND NOT EXISTS (
    SELECT 1 FROM attribute_values av
    WHERE av.attribute_id = a.id AND av.value = v.value_name
  );

INSERT INTO attribute_values (attribute_id, value, code, display_order)
SELECT a.id, v.value_name, v.code_name, v.sort_order
FROM attributes a
JOIN stores s ON s.id = a.store_id
JOIN (
  VALUES
    ('S', 'S', 1),
    ('M', 'M', 2),
    ('L', 'L', 3),
    ('XL', 'XL', 4)
) AS v(value_name, code_name, sort_order) ON TRUE
WHERE a.name = 'Size'
  AND NOT EXISTS (
    SELECT 1 FROM attribute_values av
    WHERE av.attribute_id = a.id AND av.value = v.value_name
  );

-- Default settings sections
INSERT INTO store_settings (store_id, section, values)
SELECT s.id, section_name, '{}'::jsonb
FROM stores s
CROSS JOIN (
  VALUES
    ('business'),
    ('receipt'),
    ('currency'),
    ('tax'),
    ('language'),
    ('printer'),
    ('backup'),
    ('barcode'),
    ('shortcuts'),
    ('system'),
    ('whatsapp')
) AS settings(section_name)
WHERE NOT EXISTS (
  SELECT 1 FROM store_settings ss
  WHERE ss.store_id = s.id AND ss.section = settings.section_name
);

-- Default keyboard shortcuts
INSERT INTO keyboard_shortcuts (store_id, action_key, shortcut_keys, description)
SELECT s.id, sc.action_key, sc.shortcut_keys, sc.description
FROM stores s
CROSS JOIN (
  VALUES
    ('focus_search', 'F1', 'Focus product search / barcode input'),
    ('hold_cart', 'F2', 'Hold current cart'),
    ('resume_cart', 'F3', 'Resume held cart'),
    ('charge', 'F9', 'Charge / complete sale'),
    ('print_invoice', 'Ctrl+P', 'Print current invoice'),
    ('new_sale', 'Ctrl+N', 'Start new sale'),
    ('lock_session', 'Ctrl+L', 'Lock session')
) AS sc(action_key, shortcut_keys, description)
WHERE NOT EXISTS (
  SELECT 1 FROM keyboard_shortcuts ks
  WHERE ks.store_id = s.id AND ks.action_key = sc.action_key
);
