const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

function throwWriteError(error) {
  if (error.code === '23505') {
    throw new AppError('A variant with this SKU or barcode already exists', 409);
  }
  if (error.code === '23503') {
    throw new AppError('Invalid variant reference', 400);
  }
  throw error;
}

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

function mapVariantRow(row) {
  const attributes = normalizeAttributes(row.attributes);
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    barcode: row.barcode,
    sellingPrice: Number(row.selling_price),
    costPrice: Number(row.cost_price),
    discountOverride: row.discount_override != null ? Number(row.discount_override) : null,
    status: row.status,
    attributes: attributes.map((item) => ({
      attributeId: item.attributeId,
      attributeName: item.attributeName,
      valueId: item.valueId,
      value: item.value,
      code: item.code,
      swatchHex: item.swatchHex || null,
    })),
    stock: {
      quantityOnHand: Number(row.quantity_on_hand || 0),
      reorderThreshold: Number(row.reorder_threshold || 0),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildVariantSku(baseSku, colorCode, sizeCode) {
  return `${baseSku}-${colorCode}-${sizeCode}`.toUpperCase().replace(/\s+/g, '-');
}

function buildVariantBarcode(sku, suffix) {
  const cleaned = sku.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const barcode = suffix > 0 ? `${cleaned}${suffix}` : cleaned;
  return barcode.slice(0, 120);
}

async function findProductRecord(productId, storeId) {
  const result = await query(
    `SELECT id, store_id, base_sku, default_selling_price, default_cost_price
     FROM products
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [productId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Product not found', 404);
  }
  return result.rows[0];
}

async function findVariantRecord(variantId, storeId) {
  const result = await query(
    `SELECT v.id, v.product_id, v.sku, v.status
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

async function loadAttributeValuesByIds(storeId, valueIds, attributeName) {
  const result = await query(
    `SELECT
      av.id,
      av.attribute_id,
      av.value,
      av.code,
      av.swatch_hex,
      av.display_order,
      av.is_active,
      a.name AS attribute_name
     FROM attribute_values av
     JOIN attributes a ON a.id = av.attribute_id
     WHERE av.id = ANY($1::uuid[])
       AND a.store_id = $2
       AND a.name = $3
       AND av.is_active = TRUE
       AND a.is_active = TRUE`,
    [valueIds, storeId, attributeName]
  );
  if (result.rows.length !== valueIds.length) {
    throw new AppError(`Invalid ${attributeName.toLowerCase()} values selected`, 400);
  }
  return result.rows;
}

async function variantCombinationExists(client, productId, colorValueId, sizeValueId) {
  const result = await client.query(
    `SELECT v.id
     FROM variants v
     WHERE v.product_id = $1
       AND EXISTS (
         SELECT 1 FROM variant_attribute_values
         WHERE variant_id = v.id AND attribute_value_id = $2
       )
       AND EXISTS (
         SELECT 1 FROM variant_attribute_values
         WHERE variant_id = v.id AND attribute_value_id = $3
       )
     LIMIT 1`,
    [productId, colorValueId, sizeValueId]
  );
  return Boolean(result.rows[0]);
}

async function ensureUniqueBarcode(client, sku, excludeVariantId) {
  let suffix = 0;
  while (suffix < 100) {
    const barcode = buildVariantBarcode(sku, suffix);
    const result = await client.query(
      `SELECT id FROM variants WHERE barcode = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
      [barcode, excludeVariantId || null]
    );
    if (!result.rows[0]) {
      return barcode;
    }
    suffix += 1;
  }
  throw new AppError('Unable to generate a unique barcode', 409);
}

async function ensureProductAttributes(client, productId, attributeIds) {
  for (const attributeId of attributeIds) {
    await client.query(
      `INSERT INTO product_attributes (product_id, attribute_id, display_order)
       VALUES ($1, $2, 0)
       ON CONFLICT (product_id, attribute_id) DO NOTHING`,
      [productId, attributeId]
    );
  }
}

async function loadStoreAttributeMatrix(storeId) {
  const result = await query(
    `SELECT
      a.id,
      a.name,
      a.display_order,
      COALESCE(
        json_agg(
          json_build_object(
            'id', av.id,
            'attributeId', av.attribute_id,
            'value', av.value,
            'code', av.code,
            'swatchHex', av.swatch_hex,
            'displayOrder', av.display_order,
            'isActive', av.is_active
          )
          ORDER BY av.display_order, av.value
        ) FILTER (WHERE av.id IS NOT NULL),
        '[]'::json
      ) AS values
     FROM attributes a
     LEFT JOIN attribute_values av ON av.attribute_id = a.id AND av.is_active = TRUE
     WHERE a.store_id = $1 AND a.is_active = TRUE
     GROUP BY a.id
     ORDER BY a.display_order, a.name`,
    [storeId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    values: row.values,
  }));
}

async function listProductVariants(productId, storeId) {
  await findProductRecord(productId, storeId);
  const result = await query(
    `SELECT
      v.id,
      v.product_id,
      v.sku,
      v.barcode,
      v.selling_price,
      v.cost_price,
      v.discount_override,
      v.status,
      v.created_at,
      v.updated_at,
      COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
      COALESCE(i.reorder_threshold, 0) AS reorder_threshold,
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
     FROM variants v
     JOIN products p ON p.id = v.product_id
     LEFT JOIN inventory i ON i.variant_id = v.id
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE v.product_id = $1 AND p.store_id = $2
     GROUP BY v.id, i.quantity_on_hand, i.reorder_threshold
     ORDER BY v.sku ASC`,
    [productId, storeId]
  );
  return result.rows.map(mapVariantRow);
}

async function generateVariantMatrix(productId, storeId, payload) {
  const product = await findProductRecord(productId, storeId);
  const colorValues = await loadAttributeValuesByIds(storeId, payload.colorValueIds, 'Color');
  const sizeValues = await loadAttributeValuesByIds(storeId, payload.sizeValueIds, 'Size');
  const colorAttributeId = colorValues[0].attribute_id;
  const sizeAttributeId = sizeValues[0].attribute_id;
  const client = await getClient();
  let created = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    await ensureProductAttributes(client, productId, [colorAttributeId, sizeAttributeId]);
    for (const colorValue of colorValues) {
      for (const sizeValue of sizeValues) {
        const exists = await variantCombinationExists(
          client,
          productId,
          colorValue.id,
          sizeValue.id
        );
        if (exists) {
          skipped += 1;
          continue;
        }
        const sku = buildVariantSku(product.base_sku, colorValue.code, sizeValue.code);
        const skuCheck = await client.query(`SELECT id FROM variants WHERE sku = $1 LIMIT 1`, [sku]);
        if (skuCheck.rows[0]) {
          skipped += 1;
          continue;
        }
        const barcode = await ensureUniqueBarcode(client, sku);
        const insertResult = await client.query(
          `INSERT INTO variants (
            product_id,
            sku,
            barcode,
            selling_price,
            cost_price,
            status
          ) VALUES ($1, $2, $3, $4, $5, 'active')
          RETURNING id`,
          [
            productId,
            sku,
            barcode,
            product.default_selling_price,
            product.default_cost_price,
          ]
        );
        const variantId = insertResult.rows[0].id;
        await client.query(
          `INSERT INTO variant_attribute_values (variant_id, attribute_value_id)
           VALUES ($1, $2), ($1, $3)`,
          [variantId, colorValue.id, sizeValue.id]
        );
        await client.query(
          `INSERT INTO inventory (variant_id, quantity_on_hand, reorder_threshold)
           VALUES ($1, 0, 5)`,
          [variantId]
        );
        created += 1;
      }
    }
    await client.query(`UPDATE products SET updated_at = NOW() WHERE id = $1`, [productId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throwWriteError(error);
  } finally {
    client.release();
  }
  const variants = await listProductVariants(productId, storeId);
  return {
    created,
    skipped,
    variants,
  };
}

async function updateVariant(variantId, storeId, payload) {
  await findVariantRecord(variantId, storeId);
  const fieldMap = {
    sellingPrice: 'selling_price',
    costPrice: 'cost_price',
    discountOverride: 'discount_override',
    status: 'status',
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
  values.push(variantId);
  try {
    await query(
      `UPDATE variants
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index}`,
      values
    );
  } catch (error) {
    throwWriteError(error);
  }
  const variant = await query(
    `SELECT v.product_id FROM variants v WHERE v.id = $1 LIMIT 1`,
    [variantId]
  );
  return listProductVariants(variant.rows[0].product_id, storeId).then(
    (items) => items.find((item) => item.id === variantId)
  );
}

async function deactivateVariant(variantId, storeId) {
  await findVariantRecord(variantId, storeId);
  await query(
    `UPDATE variants SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
    [variantId]
  );
  const variant = await query(
    `SELECT v.product_id FROM variants v WHERE v.id = $1 LIMIT 1`,
    [variantId]
  );
  return listProductVariants(variant.rows[0].product_id, storeId).then(
    (items) => items.find((item) => item.id === variantId)
  );
}

module.exports = {
  loadStoreAttributeMatrix,
  listProductVariants,
  generateVariantMatrix,
  updateVariant,
  deactivateVariant,
};
