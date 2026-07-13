const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const promotionsModel = require('../promotions/promotions.model');
const { buildLabelsPdf, TEMPLATE_CONFIG } = require('./barcodes.pdf');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
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

function mapStoreRow(row) {
  return {
    id: row.id,
    name: row.name,
    currencySymbol: row.currency_symbol,
  };
}

async function fetchStoreContext(storeId) {
  const result = await query(
    `SELECT id, name, currency_symbol
     FROM stores
     WHERE id = $1
     LIMIT 1`,
    [storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Store not found', 404);
  }
  return mapStoreRow(result.rows[0]);
}

async function loadVariantLabelRows(storeId, variantIds) {
  const uniqueIds = [...new Set(variantIds)];
  const result = await query(
    `SELECT
      v.id AS variant_id,
      v.sku,
      v.barcode,
      v.selling_price,
      v.discount_override,
      v.status AS variant_status,
      p.id AS product_id,
      p.name AS product_name,
      p.category_id,
      p.brand_id,
      p.status AS product_status,
      COALESCE(
        json_agg(
          json_build_object(
            'attributeName', a.name,
            'value', av.value
          )
          ORDER BY a.display_order, av.display_order
        ) FILTER (WHERE av.id IS NOT NULL),
        '[]'::json
      ) AS attributes
     FROM variants v
     JOIN products p ON p.id = v.product_id
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE p.store_id = $1
       AND v.id = ANY($2::uuid[])
     GROUP BY v.id, p.id
     ORDER BY v.sku ASC`,
    [storeId, uniqueIds]
  );
  if (result.rows.length !== uniqueIds.length) {
    throw new AppError('One or more variants were not found', 404);
  }
  return result.rows;
}

async function buildLabelData(storeId, row, store) {
  const attributes = normalizeAttributes(row.attributes);
  const unitPrice =
    row.discount_override != null
      ? Number(row.discount_override)
      : Number(row.selling_price);
  const promotion = await promotionsModel.getVariantPromotionSnapshot(storeId, {
    product_id: row.product_id,
    category_id: row.category_id,
    brand_id: row.brand_id,
    selling_price: row.selling_price,
    discount_override: row.discount_override,
  });
  const price = promotion?.effectiveUnitPrice ?? unitPrice;
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    barcode: row.barcode,
    price: roundMoney(price),
    basePrice: roundMoney(unitPrice),
    promotion: promotion
      ? {
          id: promotion.id,
          name: promotion.name,
          discountAmount: promotion.discountAmount,
        }
      : null,
    attributes,
    storeName: store.name,
    currencySymbol: store.currency_symbol,
  };
}

async function getVariantLabel(storeId, variantId) {
  const store = await fetchStoreContext(storeId);
  const rows = await loadVariantLabelRows(storeId, [variantId]);
  const row = rows[0];
  if (row.variant_status !== 'active' || row.product_status !== 'active') {
    throw new AppError('Variant is not active', 400);
  }
  if (!row.barcode) {
    throw new AppError('Variant does not have a barcode', 400);
  }
  const label = await buildLabelData(storeId, row, store);
  return {
    label,
    templates: Object.keys(TEMPLATE_CONFIG),
  };
}

function expandLabelItems(rows, store, storeId, items) {
  const rowMap = new Map(rows.map((row) => [row.variant_id, row]));
  return Promise.all(
    items.map(async (item) => {
      const row = rowMap.get(item.variantId);
      if (!row) {
        throw new AppError('Variant not found', 404);
      }
      if (row.variant_status !== 'active' || row.product_status !== 'active') {
        throw new AppError(`Variant ${row.sku} is not active`, 400);
      }
      if (!row.barcode) {
        throw new AppError(`Variant ${row.sku} does not have a barcode`, 400);
      }
      const label = await buildLabelData(storeId, row, store);
      return {
        ...label,
        copies: item.copies || 1,
      };
    })
  );
}

async function createLabelJob(storeId, userId, variantIds, templateKey, copies) {
  const result = await query(
    `INSERT INTO barcode_label_jobs (
      store_id,
      user_id,
      variant_ids,
      template_key,
      copies,
      status
    ) VALUES ($1, $2, $3, $4, $5, 'completed')
    RETURNING id`,
    [storeId, userId, variantIds, templateKey, copies]
  );
  return result.rows[0].id;
}

async function generateVariantLabelsPdf(storeId, userId, variantId, templateKey, copies = 1) {
  const { label } = await getVariantLabel(storeId, variantId);
  const pdf = await buildLabelsPdf([{ ...label, copies }], templateKey);
  await createLabelJob(storeId, userId, [variantId], templateKey, copies);
  return pdf;
}

async function generateBulkLabelsPdf(storeId, userId, payload) {
  const store = await fetchStoreContext(storeId);
  const variantIds = payload.items.map((item) => item.variantId);
  const rows = await loadVariantLabelRows(storeId, variantIds);
  const labels = await expandLabelItems(rows, store, storeId, payload.items);
  const pdf = await buildLabelsPdf(labels, payload.template || '40x30');
  const totalCopies = payload.items.reduce((sum, item) => sum + (item.copies || 1), 0);
  await createLabelJob(storeId, userId, variantIds, payload.template || '40x30', totalCopies);
  return pdf;
}

module.exports = {
  getVariantLabel,
  generateVariantLabelsPdf,
  generateBulkLabelsPdf,
  TEMPLATE_CONFIG,
};
