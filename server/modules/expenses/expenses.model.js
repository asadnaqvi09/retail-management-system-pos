const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/expenses');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    name: row.name,
    isSystem: row.is_system,
    isActive: row.is_active,
    expenseCount: Number(row.expense_count || 0),
    totalAmount: Number(row.total_amount || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExpenseRow(row) {
  return {
    id: row.id,
    category: {
      id: row.category_id,
      name: row.category_name,
    },
    user: {
      id: row.user_id,
      name: row.user_name,
    },
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method,
    note: row.note,
    attachmentPath: row.attachment_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function findCategory(categoryId, storeId) {
  const result = await query(
    `SELECT id, name, is_system, is_active
     FROM expense_categories
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [categoryId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Expense category not found', 404);
  }
  if (!result.rows[0].is_active) {
    throw new AppError('Expense category is inactive', 400);
  }
  return result.rows[0];
}

async function findExpense(expenseId, storeId) {
  const result = await query(
    `SELECT id, attachment_path FROM expenses WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [expenseId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Expense not found', 404);
  }
  return result.rows[0];
}

async function loadExpenseById(expenseId, storeId) {
  const result = await query(
    `SELECT
      e.id,
      e.category_id,
      ec.name AS category_name,
      e.user_id,
      u.name AS user_name,
      e.amount,
      e.expense_date,
      e.payment_method,
      e.note,
      e.attachment_path,
      e.created_at,
      e.updated_at
     FROM expenses e
     JOIN expense_categories ec ON ec.id = e.category_id
     JOIN users u ON u.id = e.user_id
     WHERE e.id = $1 AND e.store_id = $2
     LIMIT 1`,
    [expenseId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Expense not found', 404);
  }
  return mapExpenseRow(result.rows[0]);
}

async function listExpenses(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      e.id,
      e.category_id,
      ec.name AS category_name,
      e.user_id,
      u.name AS user_name,
      e.amount,
      e.expense_date,
      e.payment_method,
      e.note,
      e.attachment_path,
      e.created_at,
      e.updated_at,
      COUNT(*) OVER() AS total_count,
      COALESCE(SUM(e.amount) OVER(), 0) AS filtered_total
     FROM expenses e
     JOIN expense_categories ec ON ec.id = e.category_id
     JOIN users u ON u.id = e.user_id
     WHERE e.store_id = $1
       AND ($2::uuid IS NULL OR e.category_id = $2)
       AND ($3::date IS NULL OR e.expense_date >= $3)
       AND ($4::date IS NULL OR e.expense_date <= $4)
       AND ($5::text IS NULL OR ec.name ILIKE $5 OR e.note ILIKE $5)
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT $6 OFFSET $7`,
    [
      storeId,
      filters.categoryId || null,
      filters.dateFrom || null,
      filters.dateTo || null,
      searchTerm,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  const filteredTotal = result.rows[0] ? Number(result.rows[0].filtered_total) : 0;
  return {
    items: result.rows.map(mapExpenseRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      filteredTotal: roundMoney(filteredTotal),
    },
  };
}

async function createExpense(storeId, userId, payload) {
  await findCategory(payload.categoryId, storeId);
  const result = await query(
    `INSERT INTO expenses (
      store_id,
      category_id,
      user_id,
      amount,
      expense_date,
      payment_method,
      note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      storeId,
      payload.categoryId,
      userId,
      roundMoney(payload.amount),
      payload.expenseDate,
      payload.paymentMethod || 'cash',
      payload.note || null,
    ]
  );
  return loadExpenseById(result.rows[0].id, storeId);
}

async function updateExpense(expenseId, storeId, payload) {
  await findExpense(expenseId, storeId);
  if (payload.categoryId) {
    await findCategory(payload.categoryId, storeId);
  }
  const fieldMap = {
    categoryId: 'category_id',
    amount: 'amount',
    expenseDate: 'expense_date',
    paymentMethod: 'payment_method',
    note: 'note',
  };
  const fields = [];
  const values = [];
  let index = 1;
  Object.entries(fieldMap).forEach(([payloadKey, columnName]) => {
    if (payload[payloadKey] !== undefined) {
      fields.push(`${columnName} = $${index}`);
      values.push(
        payloadKey === 'amount' ? roundMoney(payload[payloadKey]) : payload[payloadKey] === '' ? null : payload[payloadKey]
      );
      index += 1;
    }
  });
  if (fields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }
  values.push(expenseId, storeId);
  await query(
    `UPDATE expenses
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${index} AND store_id = $${index + 1}`,
    values
  );
  return loadExpenseById(expenseId, storeId);
}

async function deleteExpense(expenseId, storeId) {
  const expense = await findExpense(expenseId, storeId);
  await query(`DELETE FROM expenses WHERE id = $1 AND store_id = $2`, [expenseId, storeId]);
  if (expense.attachment_path) {
    const filename = path.basename(expense.attachment_path);
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.unlink(filePath).catch(() => {});
  }
  return { id: expenseId, deleted: true };
}

async function saveExpenseReceipt(expenseId, storeId, file) {
  const expense = await findExpense(expenseId, storeId);
  await ensureUploadDir();
  const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const filename = `${expenseId}-${uuidv4()}${extension}`;
  const absolutePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(absolutePath, file.buffer);
  const publicPath = `/uploads/expenses/${filename}`;
  if (expense.attachment_path) {
    const oldFilename = path.basename(expense.attachment_path);
    await fs.unlink(path.join(UPLOAD_DIR, oldFilename)).catch(() => {});
  }
  await query(
    `UPDATE expenses SET attachment_path = $1, updated_at = NOW() WHERE id = $2`,
    [publicPath, expenseId]
  );
  return loadExpenseById(expenseId, storeId);
}

async function listCategories(storeId) {
  const result = await query(
    `SELECT
      ec.id,
      ec.name,
      ec.is_system,
      ec.is_active,
      ec.created_at,
      ec.updated_at,
      COUNT(e.id)::INT AS expense_count,
      COALESCE(SUM(e.amount), 0) AS total_amount
     FROM expense_categories ec
     LEFT JOIN expenses e ON e.category_id = ec.id
     WHERE ec.store_id = $1
     GROUP BY ec.id
     ORDER BY ec.is_system DESC, ec.name ASC`,
    [storeId]
  );
  return result.rows.map(mapCategoryRow);
}

async function createCategory(storeId, payload) {
  const existing = await query(
    `SELECT id FROM expense_categories WHERE store_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [storeId, payload.name]
  );
  if (existing.rows[0]) {
    throw new AppError('An expense category with this name already exists', 409);
  }
  const result = await query(
    `INSERT INTO expense_categories (store_id, name, is_system, is_active)
     VALUES ($1, $2, FALSE, TRUE)
     RETURNING id`,
    [storeId, payload.name]
  );
  const categories = await listCategories(storeId);
  return categories.find((item) => item.id === result.rows[0].id);
}

async function updateCategory(categoryId, storeId, payload) {
  const result = await query(
    `SELECT id, is_system FROM expense_categories WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [categoryId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Expense category not found', 404);
  }
  if (payload.name !== undefined) {
    const duplicate = await query(
      `SELECT id FROM expense_categories
       WHERE store_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
       LIMIT 1`,
      [storeId, payload.name, categoryId]
    );
    if (duplicate.rows[0]) {
      throw new AppError('An expense category with this name already exists', 409);
    }
  }
  if (payload.isActive === false && result.rows[0].is_system) {
    throw new AppError('System expense categories cannot be deactivated', 400);
  }
  const fieldMap = {
    name: 'name',
    isActive: 'is_active',
  };
  const fields = [];
  const values = [];
  let index = 1;
  Object.entries(fieldMap).forEach(([payloadKey, columnName]) => {
    if (payload[payloadKey] !== undefined) {
      fields.push(`${columnName} = $${index}`);
      values.push(payload[payloadKey]);
      index += 1;
    }
  });
  if (fields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }
  values.push(categoryId, storeId);
  await query(
    `UPDATE expense_categories
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${index} AND store_id = $${index + 1}`,
    values
  );
  const categories = await listCategories(storeId);
  return categories.find((item) => item.id === categoryId);
}

async function getMonthlySummary(storeId, filters) {
  const result = await query(
    `SELECT
      TO_CHAR(e.expense_date, 'YYYY-MM') AS month_key,
      ec.id AS category_id,
      ec.name AS category_name,
      SUM(e.amount) AS total_amount,
      COUNT(e.id)::INT AS expense_count
     FROM expenses e
     JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.store_id = $1
       AND ($2::date IS NULL OR e.expense_date >= $2)
       AND ($3::date IS NULL OR e.expense_date <= $3)
     GROUP BY month_key, ec.id, ec.name
     ORDER BY month_key DESC, ec.name ASC`,
    [storeId, filters.dateFrom || null, filters.dateTo || null]
  );
  const monthsMap = new Map();
  let grandTotal = 0;
  result.rows.forEach((row) => {
    const amount = roundMoney(row.total_amount);
    grandTotal = roundMoney(grandTotal + amount);
    if (!monthsMap.has(row.month_key)) {
      monthsMap.set(row.month_key, {
        month: row.month_key,
        totalAmount: 0,
        expenseCount: 0,
        categories: [],
      });
    }
    const monthEntry = monthsMap.get(row.month_key);
    monthEntry.totalAmount = roundMoney(monthEntry.totalAmount + amount);
    monthEntry.expenseCount += Number(row.expense_count);
    monthEntry.categories.push({
      categoryId: row.category_id,
      categoryName: row.category_name,
      totalAmount: amount,
      expenseCount: Number(row.expense_count),
    });
  });
  return {
    months: Array.from(monthsMap.values()),
    grandTotal,
  };
}

module.exports = {
  listExpenses,
  loadExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  saveExpenseReceipt,
  listCategories,
  createCategory,
  updateCategory,
  getMonthlySummary,
};
