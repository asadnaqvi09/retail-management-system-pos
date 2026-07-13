const fs = require('fs/promises');
const path = require('path');
const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

const BACKUP_VERSION = 1;

const EXPORT_QUERIES = [
  {
    key: 'stores',
    sql: 'SELECT * FROM stores WHERE id = $1',
    params: (storeId) => [storeId],
  },
  {
    key: 'tax_classes',
    sql: 'SELECT * FROM tax_classes WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'store_settings',
    sql: 'SELECT * FROM store_settings WHERE store_id = $1 ORDER BY section',
    params: (storeId) => [storeId],
  },
  {
    key: 'keyboard_shortcuts',
    sql: 'SELECT * FROM keyboard_shortcuts WHERE store_id = $1 ORDER BY action_key',
    params: (storeId) => [storeId],
  },
  {
    key: 'roles',
    sql: 'SELECT * FROM roles WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'role_permissions',
    sql: `SELECT rp.*
          FROM role_permissions rp
          JOIN roles r ON r.id = rp.role_id
          WHERE r.store_id = $1`,
    params: (storeId) => [storeId],
  },
  {
    key: 'users',
    sql: 'SELECT * FROM users WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'password_recovery_codes',
    sql: 'SELECT * FROM password_recovery_codes WHERE store_id = $1',
    params: (storeId) => [storeId],
  },
  {
    key: 'categories',
    sql: 'SELECT * FROM categories WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'brands',
    sql: 'SELECT * FROM brands WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'attributes',
    sql: 'SELECT * FROM attributes WHERE store_id = $1 ORDER BY display_order, created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'attribute_values',
    sql: `SELECT av.*
          FROM attribute_values av
          JOIN attributes a ON a.id = av.attribute_id
          WHERE a.store_id = $1
          ORDER BY av.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'products',
    sql: 'SELECT * FROM products WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'product_images',
    sql: `SELECT pi.*
          FROM product_images pi
          JOIN products p ON p.id = pi.product_id
          WHERE p.store_id = $1
          ORDER BY pi.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'product_attributes',
    sql: `SELECT pa.*
          FROM product_attributes pa
          JOIN products p ON p.id = pa.product_id
          WHERE p.store_id = $1`,
    params: (storeId) => [storeId],
  },
  {
    key: 'variants',
    sql: `SELECT v.*
          FROM variants v
          JOIN products p ON p.id = v.product_id
          WHERE p.store_id = $1
          ORDER BY v.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'variant_attribute_values',
    sql: `SELECT vav.*
          FROM variant_attribute_values vav
          JOIN variants v ON v.id = vav.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE p.store_id = $1`,
    params: (storeId) => [storeId],
  },
  {
    key: 'inventory',
    sql: `SELECT i.*
          FROM inventory i
          JOIN variants v ON v.id = i.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE p.store_id = $1`,
    params: (storeId) => [storeId],
  },
  {
    key: 'stock_movements',
    sql: `SELECT sm.*
          FROM stock_movements sm
          JOIN variants v ON v.id = sm.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE p.store_id = $1
          ORDER BY sm.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'customers',
    sql: 'SELECT * FROM customers WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'loyalty_ledger',
    sql: `SELECT ll.*
          FROM loyalty_ledger ll
          JOIN customers c ON c.id = ll.customer_id
          WHERE c.store_id = $1
          ORDER BY ll.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'cash_register_sessions',
    sql: 'SELECT * FROM cash_register_sessions WHERE store_id = $1 ORDER BY opened_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'sales',
    sql: 'SELECT * FROM sales WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'sale_lines',
    sql: `SELECT sl.*
          FROM sale_lines sl
          JOIN sales s ON s.id = sl.sale_id
          WHERE s.store_id = $1
          ORDER BY sl.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'exchanges',
    sql: 'SELECT * FROM exchanges WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'payments',
    sql: `SELECT pay.*
          FROM payments pay
          LEFT JOIN sales s ON s.id = pay.sale_id
          LEFT JOIN exchanges e ON e.id = pay.exchange_id
          WHERE s.store_id = $1 OR e.store_id = $1
          ORDER BY pay.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'exchange_lines',
    sql: `SELECT el.*
          FROM exchange_lines el
          JOIN exchanges e ON e.id = el.exchange_id
          WHERE e.store_id = $1
          ORDER BY el.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'hold_carts',
    sql: 'SELECT * FROM hold_carts WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'hold_cart_lines',
    sql: `SELECT hcl.*
          FROM hold_cart_lines hcl
          JOIN hold_carts hc ON hc.id = hcl.hold_cart_id
          WHERE hc.store_id = $1
          ORDER BY hcl.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'promotions',
    sql: 'SELECT * FROM promotions WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'promotion_redemptions',
    sql: `SELECT pr.*
          FROM promotion_redemptions pr
          JOIN promotions p ON p.id = pr.promotion_id
          WHERE p.store_id = $1
          ORDER BY pr.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'expense_categories',
    sql: 'SELECT * FROM expense_categories WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'expenses',
    sql: 'SELECT * FROM expenses WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'invoice_print_logs',
    sql: `SELECT ipl.*
          FROM invoice_print_logs ipl
          JOIN sales s ON s.id = ipl.sale_id
          WHERE s.store_id = $1
          ORDER BY ipl.created_at`,
    params: (storeId) => [storeId],
  },
  {
    key: 'barcode_label_jobs',
    sql: 'SELECT * FROM barcode_label_jobs WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'whatsapp_summaries',
    sql: 'SELECT * FROM whatsapp_summaries WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
  {
    key: 'audit_log',
    sql: 'SELECT * FROM audit_log WHERE store_id = $1 ORDER BY created_at',
    params: (storeId) => [storeId],
  },
];

const INSERT_ORDER = [
  'tax_classes',
  'store_settings',
  'keyboard_shortcuts',
  'roles',
  'role_permissions',
  'users',
  'password_recovery_codes',
  'categories',
  'brands',
  'attributes',
  'attribute_values',
  'products',
  'product_images',
  'product_attributes',
  'variants',
  'variant_attribute_values',
  'inventory',
  'stock_movements',
  'customers',
  'loyalty_ledger',
  'cash_register_sessions',
  'sales',
  'sale_lines',
  'promotions',
  'promotion_redemptions',
  'exchanges',
  'exchange_lines',
  'payments',
  'hold_carts',
  'hold_cart_lines',
  'expense_categories',
  'expenses',
  'invoice_print_logs',
  'barcode_label_jobs',
  'whatsapp_summaries',
  'audit_log',
];

async function exportStoreSnapshot(storeId) {
  const tables = {};
  for (const entry of EXPORT_QUERIES) {
    const result = await query(entry.sql, entry.params(storeId));
    tables[entry.key] = result.rows;
  }
  return {
    version: BACKUP_VERSION,
    storeId,
    createdAt: new Date().toISOString(),
    tables,
  };
}

function validateSnapshot(snapshot, storeId) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new AppError('Invalid backup file format', 400);
  }
  if (snapshot.version !== BACKUP_VERSION) {
    throw new AppError('Unsupported backup version', 400);
  }
  if (snapshot.storeId !== storeId) {
    throw new AppError('Backup belongs to a different store', 400);
  }
  if (!snapshot.tables || typeof snapshot.tables !== 'object') {
    throw new AppError('Backup file is missing table data', 400);
  }
}

async function deleteStoreTransactionalData(client, storeId) {
  const deletes = [
    `DELETE FROM promotion_redemptions pr
     USING promotions p
     WHERE pr.promotion_id = p.id AND p.store_id = $1`,
    `DELETE FROM invoice_print_logs ipl
     USING sales s
     WHERE ipl.sale_id = s.id AND s.store_id = $1`,
    `DELETE FROM exchange_lines el
     USING exchanges e
     WHERE el.exchange_id = e.id AND e.store_id = $1`,
    `DELETE FROM payments pay
     USING sales s
     WHERE pay.sale_id = s.id AND s.store_id = $1`,
    `DELETE FROM payments pay
     USING exchanges e
     WHERE pay.exchange_id = e.id AND e.store_id = $1`,
    `DELETE FROM sale_lines sl
     USING sales s
     WHERE sl.sale_id = s.id AND s.store_id = $1`,
    `DELETE FROM hold_cart_lines hcl
     USING hold_carts hc
     WHERE hcl.hold_cart_id = hc.id AND hc.store_id = $1`,
    `DELETE FROM exchanges WHERE store_id = $1`,
    `DELETE FROM hold_carts WHERE store_id = $1`,
    `DELETE FROM sales WHERE store_id = $1`,
    `DELETE FROM cash_register_sessions WHERE store_id = $1`,
    `DELETE FROM stock_movements sm
     USING variants v, products p
     WHERE sm.variant_id = v.id AND v.product_id = p.id AND p.store_id = $1`,
    `DELETE FROM inventory i
     USING variants v, products p
     WHERE i.variant_id = v.id AND v.product_id = p.id AND p.store_id = $1`,
    `DELETE FROM variant_attribute_values vav
     USING variants v, products p
     WHERE vav.variant_id = v.id AND v.product_id = p.id AND p.store_id = $1`,
    `DELETE FROM variants v
     USING products p
     WHERE v.product_id = p.id AND p.store_id = $1`,
    `DELETE FROM product_images pi
     USING products p
     WHERE pi.product_id = p.id AND p.store_id = $1`,
    `DELETE FROM product_attributes pa
     USING products p
     WHERE pa.product_id = p.id AND p.store_id = $1`,
    `DELETE FROM products WHERE store_id = $1`,
    `DELETE FROM attribute_values av
     USING attributes a
     WHERE av.attribute_id = a.id AND a.store_id = $1`,
    `DELETE FROM attributes WHERE store_id = $1`,
    `DELETE FROM loyalty_ledger ll
     USING customers c
     WHERE ll.customer_id = c.id AND c.store_id = $1`,
    `DELETE FROM customers WHERE store_id = $1`,
    `DELETE FROM expenses WHERE store_id = $1`,
    `DELETE FROM expense_categories WHERE store_id = $1`,
    `DELETE FROM promotions WHERE store_id = $1`,
    `DELETE FROM barcode_label_jobs WHERE store_id = $1`,
    `DELETE FROM whatsapp_summaries WHERE store_id = $1`,
    `DELETE FROM audit_log WHERE store_id = $1`,
    `DELETE FROM user_sessions us
     USING users u
     WHERE us.user_id = u.id AND u.store_id = $1`,
    `DELETE FROM users WHERE store_id = $1`,
    `DELETE FROM role_permissions rp
     USING roles r
     WHERE rp.role_id = r.id AND r.store_id = $1`,
    `DELETE FROM roles WHERE store_id = $1`,
    `DELETE FROM password_recovery_codes WHERE store_id = $1`,
    `DELETE FROM keyboard_shortcuts WHERE store_id = $1`,
    `DELETE FROM store_settings WHERE store_id = $1`,
    `DELETE FROM tax_classes WHERE store_id = $1`,
  ];

  for (const sql of deletes) {
    await client.query(sql, [storeId]);
  }
}

async function insertRows(client, tableName, rows) {
  if (!rows?.length) {
    return;
  }
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => row[column]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${tableName} (${columns.join(', ')})
       VALUES (${placeholders})`,
      values
    );
  }
}

async function restoreStoreSnapshot(storeId, snapshot) {
  validateSnapshot(snapshot, storeId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await deleteStoreTransactionalData(client, storeId);

    const storeRows = snapshot.tables.stores || [];
    if (storeRows[0]) {
      const store = storeRows[0];
      await client.query(
        `UPDATE stores
         SET name = $1,
             logo_path = $2,
             email = $3,
             website = $4,
             address = $5,
             city = $6,
             country = $7,
             phone = $8,
             tax_id = $9,
             business_day_start_time = $10,
             currency_code = $11,
             currency_symbol = $12,
             timezone = $13,
             default_language = $14,
             return_policy_days = $15,
             allow_oversell = $16,
             updated_at = NOW()
         WHERE id = $17`,
        [
          store.name,
          store.logo_path,
          store.email,
          store.website,
          store.address,
          store.city,
          store.country,
          store.phone,
          store.tax_id,
          store.business_day_start_time,
          store.currency_code,
          store.currency_symbol,
          store.timezone,
          store.default_language,
          store.return_policy_days,
          store.allow_oversell,
          storeId,
        ]
      );
    }

    const productImages = [...(snapshot.tables.product_images || [])];
    const variants = [...(snapshot.tables.variants || [])];
    const stagedImages = productImages.map((image) => ({ ...image, variant_id: null }));
    const stagedVariants = variants.map((variant) => ({ ...variant, image_id: null }));

    const stagedTables = {
      ...snapshot.tables,
      product_images: stagedImages,
      variants: stagedVariants,
    };

    for (const tableName of INSERT_ORDER) {
      await insertRows(client, tableName, stagedTables[tableName] || []);
    }

    for (const variant of variants) {
      if (variant.image_id) {
        await client.query(`UPDATE variants SET image_id = $1 WHERE id = $2`, [
          variant.image_id,
          variant.id,
        ]);
      }
    }
    for (const image of productImages) {
      if (image.variant_id) {
        await client.query(`UPDATE product_images SET variant_id = $1 WHERE id = $2`, [
          image.variant_id,
          image.id,
        ]);
      }
    }

    await client.query('COMMIT');
    return {
      restoredTables: INSERT_ORDER.filter((table) => (snapshot.tables[table] || []).length > 0),
      storeUpdated: Boolean(storeRows[0]),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function writeSnapshotFile(storeId, snapshot, backupId) {
  const backupDir = path.join(__dirname, '../../backups', storeId);
  await fs.mkdir(backupDir, { recursive: true });
  const filename = `${backupId}.json`;
  const filePath = path.join(backupDir, filename);
  const content = JSON.stringify(snapshot, null, 2);
  await fs.writeFile(filePath, content, 'utf8');
  return {
    absolutePath: filePath,
    relativePath: path.join('backups', storeId, filename).replace(/\\/g, '/'),
    sizeBytes: Buffer.byteLength(content, 'utf8'),
  };
}

async function readSnapshotFile(relativePath) {
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(__dirname, '../..', relativePath);
  const content = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(content);
}

async function removeSnapshotFile(relativePath) {
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(__dirname, '../..', relativePath);
  await fs.unlink(absolutePath);
}

module.exports = {
  BACKUP_VERSION,
  exportStoreSnapshot,
  restoreStoreSnapshot,
  writeSnapshotFile,
  readSnapshotFile,
  removeSnapshotFile,
  validateSnapshot,
};
