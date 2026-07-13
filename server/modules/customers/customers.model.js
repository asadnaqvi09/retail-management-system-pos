const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');

function mapCustomerRow(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    loyaltyPoints: Number(row.loyalty_points || 0),
    isActive: row.is_active,
    saleCount: Number(row.sale_count || 0),
    totalSpent: Number(row.total_spent || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSaleSummaryRow(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}

function customerStatsJoin() {
  return `
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE s.status = 'completed')::INT AS sale_count,
        COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completed'), 0) AS total_spent
      FROM sales s
      WHERE s.customer_id = c.id
    ) stats ON TRUE
  `;
}

function customerSelectColumns() {
  return `
    c.*,
    COALESCE(stats.sale_count, 0) AS sale_count,
    COALESCE(stats.total_spent, 0) AS total_spent
  `;
}

async function findCustomerRecord(customerId, storeId) {
  const result = await query(
    `SELECT id FROM customers WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [customerId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Customer not found', 404);
  }
}

async function loadCustomerById(customerId, storeId) {
  const result = await query(
    `SELECT ${customerSelectColumns()}
     FROM customers c
     ${customerStatsJoin()}
     WHERE c.id = $1 AND c.store_id = $2
     LIMIT 1`,
    [customerId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Customer not found', 404);
  }
  const salesResult = await query(
    `SELECT id, invoice_number, total, status, created_at
     FROM sales
     WHERE customer_id = $1 AND store_id = $2
     ORDER BY created_at DESC
     LIMIT 10`,
    [customerId, storeId]
  );
  return {
    ...mapCustomerRow(result.rows[0]),
    recentSales: salesResult.rows.map(mapSaleSummaryRow),
  };
}

async function listCustomers(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      ${customerSelectColumns()},
      COUNT(*) OVER() AS total_count
     FROM customers c
     ${customerStatsJoin()}
     WHERE c.store_id = $1
       AND ($2::text IS NULL OR c.name ILIKE $2 OR c.phone ILIKE $2 OR c.email ILIKE $2)
       AND ($3::boolean IS NULL OR c.is_active = $3)
     ORDER BY c.name ASC
     LIMIT $4 OFFSET $5`,
    [storeId, searchTerm, filters.isActive ?? null, limit, offset]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapCustomerRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function createCustomer(storeId, payload) {
  const result = await query(
    `INSERT INTO customers (
      store_id,
      name,
      phone,
      email,
      address,
      notes,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      storeId,
      payload.name,
      payload.phone || null,
      payload.email || null,
      payload.address || null,
      payload.notes || null,
      payload.isActive ?? true,
    ]
  );
  return loadCustomerById(result.rows[0].id, storeId);
}

async function updateCustomer(customerId, storeId, payload) {
  await findCustomerRecord(customerId, storeId);
  const fieldMap = {
    name: 'name',
    phone: 'phone',
    email: 'email',
    address: 'address',
    notes: 'notes',
    isActive: 'is_active',
  };
  const fields = [];
  const values = [];
  let index = 1;
  Object.entries(fieldMap).forEach(([payloadKey, columnName]) => {
    if (payload[payloadKey] !== undefined) {
      fields.push(`${columnName} = $${index}`);
      values.push(payload[payloadKey] === '' ? null : payload[payloadKey]);
      index += 1;
    }
  });
  if (fields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }
  values.push(customerId, storeId);
  await query(
    `UPDATE customers
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${index} AND store_id = $${index + 1}`,
    values
  );
  return loadCustomerById(customerId, storeId);
}

async function deactivateCustomer(customerId, storeId) {
  await findCustomerRecord(customerId, storeId);
  await query(
    `UPDATE customers
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND store_id = $2`,
    [customerId, storeId]
  );
  return loadCustomerById(customerId, storeId);
}

module.exports = {
  listCustomers,
  loadCustomerById,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
};
