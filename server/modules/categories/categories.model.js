const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');

function throwWriteError(error) {
  if (error.code === '23505') {
    throw new AppError('A category with this name already exists at this level', 409);
  }
  if (error.code === '23503') {
    throw new AppError('Invalid category reference', 400);
  }
  throw error;
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description,
    parentCategoryId: row.parent_category_id,
    parent: row.parent_category_id
      ? { id: row.parent_category_id, name: row.parent_name }
      : null,
    isActive: row.is_active,
    productCount: Number(row.product_count || 0),
    childCount: Number(row.child_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildCategoryTree(flatRows) {
  const nodeMap = new Map();
  const roots = [];
  flatRows.forEach((row) => {
    const node = { ...mapCategoryRow(row), children: [] };
    nodeMap.set(node.id, node);
  });
  nodeMap.forEach((node) => {
    if (node.parentCategoryId && nodeMap.has(node.parentCategoryId)) {
      nodeMap.get(node.parentCategoryId).children.push(node);
      return;
    }
    roots.push(node);
  });
  return roots;
}

async function findCategoryRecord(categoryId, storeId) {
  const result = await query(
    `SELECT id, store_id, name, parent_category_id, is_active
     FROM categories
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [categoryId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Category not found', 404);
  }
  return result.rows[0];
}

async function ensureParentIsValid(parentCategoryId, storeId, categoryId) {
  if (!parentCategoryId) {
    return;
  }
  if (categoryId && parentCategoryId === categoryId) {
    throw new AppError('A category cannot be its own parent', 400);
  }
  const parentResult = await query(
    `SELECT id, parent_category_id, is_active
     FROM categories
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [parentCategoryId, storeId]
  );
  if (!parentResult.rows[0]) {
    throw new AppError('Parent category not found', 404);
  }
  if (!parentResult.rows[0].is_active) {
    throw new AppError('Parent category is inactive', 400);
  }
  if (!categoryId) {
    return;
  }
  let currentParentId = parentCategoryId;
  const visited = new Set([categoryId]);
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      throw new AppError('Category hierarchy cannot contain a cycle', 400);
    }
    visited.add(currentParentId);
    const ancestorResult = await query(
      `SELECT parent_category_id
       FROM categories
       WHERE id = $1 AND store_id = $2
       LIMIT 1`,
      [currentParentId, storeId]
    );
    if (!ancestorResult.rows[0]) {
      break;
    }
    currentParentId = ancestorResult.rows[0].parent_category_id;
  }
}

function categorySelectColumns() {
  return `
    c.*,
    p.name AS parent_name,
    COALESCE(pc.product_count, 0) AS product_count,
    COALESCE(ch.child_count, 0) AS child_count
  `;
}

function categoryJoins() {
  return `
    LEFT JOIN categories p ON p.id = c.parent_category_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS product_count
      FROM products
      WHERE category_id = c.id
    ) pc ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS child_count
      FROM categories
      WHERE parent_category_id = c.id
    ) ch ON TRUE
  `;
}

async function loadCategoryById(categoryId, storeId) {
  const result = await query(
    `SELECT ${categorySelectColumns()}
     FROM categories c
     ${categoryJoins()}
     WHERE c.id = $1 AND c.store_id = $2
     LIMIT 1`,
    [categoryId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Category not found', 404);
  }
  return mapCategoryRow(result.rows[0]);
}

async function listCategories(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      ${categorySelectColumns()},
      COUNT(*) OVER() AS total_count
     FROM categories c
     ${categoryJoins()}
     WHERE c.store_id = $1
       AND ($2::text IS NULL OR c.name ILIKE $2 OR COALESCE(c.description, '') ILIKE $2)
       AND ($3::uuid IS NULL OR c.parent_category_id = $3)
       AND ($4::boolean IS NULL OR c.is_active = $4)
       AND ($5::boolean = FALSE OR c.parent_category_id IS NULL)
     ORDER BY c.name ASC
     LIMIT $6 OFFSET $7`,
    [
      storeId,
      searchTerm,
      filters.parentCategoryId || null,
      filters.isActive ?? null,
      filters.rootsOnly || false,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapCategoryRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function getCategoryTree(storeId, filters) {
  const result = await query(
    `SELECT ${categorySelectColumns()}
     FROM categories c
     ${categoryJoins()}
     WHERE c.store_id = $1
       AND ($2::boolean IS NULL OR c.is_active = $2)
     ORDER BY c.name ASC`,
    [storeId, filters.isActive ?? null]
  );
  return buildCategoryTree(result.rows);
}

async function createCategory(storeId, payload) {
  await ensureParentIsValid(payload.parentCategoryId, storeId);
  try {
    const result = await query(
      `INSERT INTO categories (
        store_id,
        parent_category_id,
        name,
        description,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        storeId,
        payload.parentCategoryId || null,
        payload.name,
        payload.description || null,
        payload.isActive ?? true,
      ]
    );
    return loadCategoryById(result.rows[0].id, storeId);
  } catch (error) {
    throwWriteError(error);
  }
}

async function updateCategory(categoryId, storeId, payload) {
  await findCategoryRecord(categoryId, storeId);
  if (payload.parentCategoryId !== undefined) {
    await ensureParentIsValid(payload.parentCategoryId, storeId, categoryId);
  }
  const fieldMap = {
    name: 'name',
    description: 'description',
    parentCategoryId: 'parent_category_id',
    isActive: 'is_active',
  };
  const fields = [];
  const values = [];
  let index = 1;
  Object.entries(fieldMap).forEach(([payloadKey, columnName]) => {
    if (payload[payloadKey] !== undefined) {
      fields.push(`${columnName} = $${index}`);
      values.push(payloadKey === 'parentCategoryId' ? payload[payloadKey] || null : payload[payloadKey]);
      index += 1;
    }
  });
  if (fields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }
  values.push(categoryId, storeId);
  try {
    await query(
      `UPDATE categories
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} AND store_id = $${index + 1}`,
      values
    );
    return loadCategoryById(categoryId, storeId);
  } catch (error) {
    throwWriteError(error);
  }
}

async function deactivateCategory(categoryId, storeId) {
  await findCategoryRecord(categoryId, storeId);
  const childResult = await query(
    `SELECT COUNT(*)::INT AS count
     FROM categories
     WHERE parent_category_id = $1 AND store_id = $2 AND is_active = TRUE`,
    [categoryId, storeId]
  );
  if (Number(childResult.rows[0].count) > 0) {
    throw new AppError('Deactivate child categories before deactivating this category', 400);
  }
  await query(
    `UPDATE categories
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND store_id = $2`,
    [categoryId, storeId]
  );
  return loadCategoryById(categoryId, storeId);
}

module.exports = {
  listCategories,
  getCategoryTree,
  loadCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
};
