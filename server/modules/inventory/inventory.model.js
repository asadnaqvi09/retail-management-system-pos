const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

function normalizeAttributes(raw) {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw).filter(Boolean);
    } catch (error) {
      return [];
    }
  }
  return [];
}

function mapInventoryRow(row) {
  return {
    variantId: row.variant_id,
    sku: row.sku,
    barcode: row.barcode,
    variantStatus: row.variant_status,
    product: {
      id: row.product_id,
      name: row.product_name,
      baseSku: row.base_sku,
      categoryName: row.category_name,
      brandName: row.brand_name,
    },
    attributes: normalizeAttributes(row.attributes).map((item) => ({
      attributeId: item.attributeId,
      attributeName: item.attributeName,
      valueId: item.valueId,
      value: item.value,
      code: item.code,
      swatchHex: item.swatchHex || null,
    })),
    quantityOnHand: Number(row.quantity_on_hand),
    reorderThreshold: Number(row.reorder_threshold),
    isLowStock: Number(row.quantity_on_hand) <= Number(row.reorder_threshold),
    updatedAt: row.updated_at,
  };
}

function mapMovementRow(row) {
  return {
    id: row.id,
    variantId: row.variant_id,
    user: row.user_id
      ? { id: row.user_id, name: row.user_name }
      : null,
    movementType: row.movement_type,
    quantityDelta: Number(row.quantity_delta),
    resultingBalance: Number(row.resulting_balance),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    reason: row.reason,
    note: row.note,
    createdAt: row.created_at,
    variant: {
      sku: row.sku,
      barcode: row.barcode,
      productName: row.product_name,
      attributes: normalizeAttributes(row.attributes).map((item) => ({
        attributeName: item.attributeName,
        value: item.value,
      })),
    },
  };
}

function inventorySelectQuery() {
  return `
    SELECT
      i.variant_id,
      i.quantity_on_hand,
      i.reorder_threshold,
      i.updated_at,
      v.sku,
      v.barcode,
      v.status AS variant_status,
      p.id AS product_id,
      p.name AS product_name,
      p.base_sku,
      c.name AS category_name,
      b.name AS brand_name,
      COALESCE(
        json_agg(
          json_build_object(
            'attributeId', a.id,
            'attributeName', a.name,
            'valueId', av.id,
            'value', av.value,
            'code', av.code,
            'swatchHex', av.swatch_hex
          )
          ORDER BY a.display_order, av.display_order
        ) FILTER (WHERE av.id IS NOT NULL),
        '[]'::json
      ) AS attributes
  `;
}

function inventoryJoinQuery() {
  return `
    FROM inventory i
    JOIN variants v ON v.id = i.variant_id
    JOIN products p ON p.id = v.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
    LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
    LEFT JOIN attributes a ON a.id = av.attribute_id
  `;
}

async function findVariantInStore(variantId, storeId) {
  const result = await query(
    `SELECT v.id, v.sku, p.id AS product_id, p.name AS product_name
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.id = $1 AND p.store_id = $2
     LIMIT 1`,
    [variantId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Variant not found', 404);
  }
  return result.rows[0];
}

async function loadInventoryItem(variantId, storeId) {
  await findVariantInStore(variantId, storeId);
  const result = await query(
    `${inventorySelectQuery()}
     ${inventoryJoinQuery()}
     WHERE i.variant_id = $1 AND p.store_id = $2
     GROUP BY i.variant_id, v.id, p.id, c.name, b.name`,
    [variantId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Inventory record not found', 404);
  }
  return mapInventoryRow(result.rows[0]);
}

async function listInventory(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `${inventorySelectQuery()},
      COUNT(*) OVER() AS total_count
     ${inventoryJoinQuery()}
     WHERE p.store_id = $1
       AND ($2::text IS NULL OR p.name ILIKE $2 OR v.sku ILIKE $2 OR v.barcode ILIKE $2)
       AND ($3::boolean = FALSE OR i.quantity_on_hand <= i.reorder_threshold)
       AND ($4::uuid IS NULL OR p.id = $4)
     GROUP BY i.variant_id, v.id, p.id, c.name, b.name
     ORDER BY i.quantity_on_hand ASC, v.sku ASC
     LIMIT $5 OFFSET $6`,
    [
      storeId,
      searchTerm,
      filters.lowStockOnly || false,
      filters.productId || null,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapInventoryRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function listStockMovements(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT
      sm.id,
      sm.variant_id,
      sm.user_id,
      sm.movement_type,
      sm.quantity_delta,
      sm.resulting_balance,
      sm.reference_type,
      sm.reference_id,
      sm.reason,
      sm.note,
      sm.created_at,
      u.name AS user_name,
      v.sku,
      v.barcode,
      p.name AS product_name,
      COALESCE(
        json_agg(
          json_build_object(
            'attributeName', a.name,
            'value', av.value
          )
          ORDER BY a.display_order, av.display_order
        ) FILTER (WHERE av.id IS NOT NULL),
        '[]'::json
      ) AS attributes,
      COUNT(*) OVER() AS total_count
     FROM stock_movements sm
     JOIN variants v ON v.id = sm.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN users u ON u.id = sm.user_id
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE p.store_id = $1
       AND ($2::uuid IS NULL OR sm.variant_id = $2)
       AND ($3::stock_movement_type IS NULL OR sm.movement_type = $3)
     GROUP BY sm.id, u.name, v.sku, v.barcode, p.name
     ORDER BY sm.created_at DESC
     LIMIT $4 OFFSET $5`,
    [storeId, filters.variantId || null, filters.movementType || null, limit, offset]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapMovementRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function adjustStock(variantId, storeId, userId, payload) {
  await findVariantInStore(variantId, storeId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const inventoryResult = await client.query(
      `SELECT quantity_on_hand, reorder_threshold
       FROM inventory
       WHERE variant_id = $1
       FOR UPDATE`,
      [variantId]
    );
    if (!inventoryResult.rows[0]) {
      throw new AppError('Inventory record not found', 404);
    }
    const currentQuantity = Number(inventoryResult.rows[0].quantity_on_hand);
    const quantityDelta =
      payload.targetQuantity !== undefined
        ? payload.targetQuantity - currentQuantity
        : payload.quantityDelta;
    if (quantityDelta === 0) {
      throw new AppError('Stock adjustment must change quantity', 400);
    }
    const resultingBalance = currentQuantity + quantityDelta;
    if (resultingBalance < 0) {
      throw new AppError('Stock cannot go below zero', 400);
    }
    await client.query(
      `UPDATE inventory
       SET quantity_on_hand = $1, updated_at = NOW()
       WHERE variant_id = $2`,
      [resultingBalance, variantId]
    );
    await client.query(
      `INSERT INTO stock_movements (
        variant_id,
        user_id,
        movement_type,
        quantity_delta,
        resulting_balance,
        reason,
        note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        variantId,
        userId,
        payload.movementType,
        quantityDelta,
        resultingBalance,
        payload.reason,
        payload.note || null,
      ]
    );
    await client.query(`UPDATE products SET updated_at = NOW()
      WHERE id = (SELECT product_id FROM variants WHERE id = $1)`, [variantId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return loadInventoryItem(variantId, storeId);
}

async function updateReorderThreshold(variantId, storeId, reorderThreshold) {
  await findVariantInStore(variantId, storeId);
  const result = await query(
    `UPDATE inventory
     SET reorder_threshold = $1, updated_at = NOW()
     WHERE variant_id = $2
     RETURNING variant_id`,
    [reorderThreshold, variantId]
  );
  if (!result.rows[0]) {
    throw new AppError('Inventory record not found', 404);
  }
  return loadInventoryItem(variantId, storeId);
}

module.exports = {
  listInventory,
  loadInventoryItem,
  listStockMovements,
  adjustStock,
  updateReorderThreshold,
};
