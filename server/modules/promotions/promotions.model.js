const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

const SCOPE_RANK = {
  product: 4,
  brand: 3,
  category: 2,
  store_wide: 1,
};

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function resolvePromotionStatus(row, at = new Date()) {
  const now = at.getTime();
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();
  if (now < start) {
    return 'scheduled';
  }
  if (now > end) {
    return 'expired';
  }
  return 'active';
}

function mapPromotionRow(row) {
  const status = resolvePromotionStatus(row);
  return {
    id: row.id,
    name: row.name,
    promotionType: row.promotion_type,
    discountValue: Number(row.discount_value),
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    scopeName: row.scope_name || null,
    couponCode: row.coupon_code,
    startAt: row.start_at,
    endAt: row.end_at,
    precedenceRule: row.precedence_rule,
    isActive: status === 'active',
    status,
    usageCount: Number(row.usage_count || 0),
    createdBy: row.created_by
      ? { id: row.created_by, name: row.created_by_name || null }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function promotionSelectSql() {
  return `
    SELECT
      p.id,
      p.name,
      p.promotion_type,
      p.discount_value,
      p.scope_type,
      p.scope_id,
      p.coupon_code,
      p.start_at,
      p.end_at,
      p.precedence_rule,
      p.is_active_cache,
      p.usage_count,
      p.created_by,
      p.created_at,
      p.updated_at,
      u.name AS created_by_name,
      CASE
        WHEN p.scope_type = 'product' THEN pr.name
        WHEN p.scope_type = 'category' THEN c.name
        WHEN p.scope_type = 'brand' THEN b.name
        ELSE NULL
      END AS scope_name
    FROM promotions p
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN products pr ON p.scope_type = 'product' AND pr.id = p.scope_id
    LEFT JOIN categories c ON p.scope_type = 'category' AND c.id = p.scope_id
    LEFT JOIN brands b ON p.scope_type = 'brand' AND b.id = p.scope_id
  `;
}

async function refreshActiveCache(storeId, client = null) {
  const runner = client ? client.query.bind(client) : query;
  await runner(
    `UPDATE promotions
     SET is_active_cache = (NOW() >= start_at AND NOW() <= end_at)
     WHERE store_id = $1`,
    [storeId]
  );
}

async function validateScopeTarget(storeId, scopeType, scopeId) {
  if (scopeType === 'store_wide') {
    return null;
  }
  if (!scopeId) {
    throw new AppError('Scope target is required for this promotion scope', 400);
  }
  let sql;
  switch (scopeType) {
    case 'product':
      sql = `SELECT id, name FROM products WHERE id = $1 AND store_id = $2 LIMIT 1`;
      break;
    case 'category':
      sql = `SELECT id, name FROM categories WHERE id = $1 AND store_id = $2 LIMIT 1`;
      break;
    case 'brand':
      sql = `SELECT id, name FROM brands WHERE id = $1 AND store_id = $2 LIMIT 1`;
      break;
    default:
      throw new AppError('Invalid promotion scope', 400);
  }
  const result = await query(sql, [scopeId, storeId]);
  if (!result.rows[0]) {
    throw new AppError('Promotion scope target not found', 404);
  }
  return result.rows[0].name;
}

function calculatePromotionDiscount(promotion, lineSubtotal) {
  if (!promotion || lineSubtotal <= 0) {
    return 0;
  }
  if (promotion.promotion_type === 'percentage') {
    return roundMoney(lineSubtotal * Number(promotion.discount_value) / 100);
  }
  if (promotion.promotion_type === 'fixed') {
    return roundMoney(Math.min(Number(promotion.discount_value), lineSubtotal));
  }
  return 0;
}

function promotionAppliesToVariant(promotion, variant) {
  switch (promotion.scope_type) {
    case 'store_wide':
      return true;
    case 'product':
      return promotion.scope_id === variant.product_id;
    case 'category':
      return variant.category_id && promotion.scope_id === variant.category_id;
    case 'brand':
      return variant.brand_id && promotion.scope_id === variant.brand_id;
    default:
      return false;
  }
}

function selectWinningPromotion(applicablePromotions, lineSubtotal) {
  if (!applicablePromotions.length) {
    return null;
  }
  const scored = applicablePromotions
    .map((promotion) => ({
      promotion,
      discount: calculatePromotionDiscount(promotion, lineSubtotal),
      specificity: SCOPE_RANK[promotion.scope_type] || 0,
    }))
    .filter((item) => item.discount > 0);

  if (!scored.length) {
    return null;
  }

  const useHighestDiscount = scored.every(
    (item) => item.promotion.precedence_rule === 'highest_discount'
  );

  if (useHighestDiscount) {
    scored.sort((a, b) => b.discount - a.discount || b.specificity - a.specificity);
  } else {
    scored.sort((a, b) => b.specificity - a.specificity || b.discount - a.discount);
  }

  return scored[0].promotion;
}

async function loadActivePromotions(storeId, client = null) {
  const runner = client ? client.query.bind(client) : query;
  const result = await runner(
    `SELECT
      id,
      name,
      promotion_type,
      discount_value,
      scope_type,
      scope_id,
      precedence_rule
     FROM promotions
     WHERE store_id = $1
       AND promotion_type IN ('percentage', 'fixed')
       AND NOW() >= start_at
       AND NOW() <= end_at
     ORDER BY created_at ASC`,
    [storeId]
  );
  return result.rows;
}

function applyPromotionDiscounts(lines, variantMap, activePromotions) {
  return lines.map((line) => {
    const variant = variantMap.get(line.variantId);
    const unitPrice =
      variant.discount_override != null
        ? Number(variant.discount_override)
        : Number(variant.selling_price);
    const lineSubtotal = roundMoney(unitPrice * line.quantity);
    const applicable = activePromotions.filter((promotion) =>
      promotionAppliesToVariant(promotion, variant)
    );
    const winner = selectWinningPromotion(applicable, lineSubtotal);
    const promoDiscount = winner ? calculatePromotionDiscount(winner, lineSubtotal) : 0;
    return {
      ...line,
      promoDiscount,
      promotionId: winner?.id || null,
      promotionName: winner?.name || null,
    };
  });
}

async function applyPromotionDiscountsForStore(storeId, lines, variantMap, client = null) {
  const activePromotions = await loadActivePromotions(storeId, client);
  return applyPromotionDiscounts(lines, variantMap, activePromotions);
}

function mapPromotionSnapshot(promotion, unitPrice) {
  if (!promotion) {
    return null;
  }
  const lineSubtotal = roundMoney(unitPrice);
  const discountAmount = calculatePromotionDiscount(promotion, lineSubtotal);
  if (discountAmount <= 0) {
    return null;
  }
  return {
    id: promotion.id,
    name: promotion.name,
    promotionType: promotion.promotion_type,
    discountValue: Number(promotion.discount_value),
    discountAmount,
    effectiveUnitPrice: roundMoney(unitPrice - discountAmount),
  };
}

async function getVariantPromotionSnapshot(storeId, variantMeta, client = null) {
  const unitPrice =
    variantMeta.discount_override != null
      ? Number(variantMeta.discount_override)
      : Number(variantMeta.selling_price);
  const activePromotions = await loadActivePromotions(storeId, client);
  const applicable = activePromotions.filter((promotion) =>
    promotionAppliesToVariant(promotion, variantMeta)
  );
  const winner = selectWinningPromotion(applicable, unitPrice);
  return mapPromotionSnapshot(winner, unitPrice);
}

async function listPromotions(storeId, filters) {
  await refreshActiveCache(storeId);
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const statusFilter = filters.status || null;
  const result = await query(
    `${promotionSelectSql()}
     WHERE p.store_id = $1
       AND ($2::text IS NULL OR p.name ILIKE $2 OR COALESCE(p.coupon_code, '') ILIKE $2)
       AND (
         $3::text IS NULL
         OR CASE
           WHEN NOW() < p.start_at THEN 'scheduled'
           WHEN NOW() > p.end_at THEN 'expired'
           ELSE 'active'
         END = $3
       )
     ORDER BY p.start_at DESC, p.created_at DESC
     LIMIT $4 OFFSET $5`,
    [storeId, searchTerm, statusFilter, limit, offset]
  );
  const countResult = await query(
    `SELECT COUNT(*)::INT AS total
     FROM promotions p
     WHERE p.store_id = $1
       AND ($2::text IS NULL OR p.name ILIKE $2 OR COALESCE(p.coupon_code, '') ILIKE $2)
       AND (
         $3::text IS NULL
         OR CASE
           WHEN NOW() < p.start_at THEN 'scheduled'
           WHEN NOW() > p.end_at THEN 'expired'
           ELSE 'active'
         END = $3
       )`,
    [storeId, searchTerm, statusFilter]
  );
  const total = Number(countResult.rows[0].total);
  return {
    items: result.rows.map(mapPromotionRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function loadPromotionById(promotionId, storeId) {
  const result = await query(
    `${promotionSelectSql()}
     WHERE p.id = $1 AND p.store_id = $2
     LIMIT 1`,
    [promotionId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Promotion not found', 404);
  }
  return mapPromotionRow(result.rows[0]);
}

async function createPromotion(storeId, userId, payload) {
  if (payload.promotionType === 'bogo') {
    throw new AppError('BOGO promotions are not supported yet', 400);
  }
  await validateScopeTarget(storeId, payload.scopeType, payload.scopeId || null);
  const result = await query(
    `INSERT INTO promotions (
      store_id,
      name,
      promotion_type,
      discount_value,
      scope_type,
      scope_id,
      coupon_code,
      start_at,
      end_at,
      precedence_rule,
      is_active_cache,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ($8 <= NOW() AND $9 >= NOW()), $11)
    RETURNING id`,
    [
      storeId,
      payload.name,
      payload.promotionType,
      payload.discountValue,
      payload.scopeType,
      payload.scopeId || null,
      payload.couponCode || null,
      payload.startAt,
      payload.endAt,
      payload.precedenceRule || 'most_specific',
      userId,
    ]
  );
  await refreshActiveCache(storeId);
  return loadPromotionById(result.rows[0].id, storeId);
}

async function updatePromotion(promotionId, storeId, payload) {
  const existing = await loadPromotionById(promotionId, storeId);
  const nextScopeType = payload.scopeType || existing.scopeType;
  const nextScopeId =
    payload.scopeId !== undefined ? payload.scopeId : existing.scopeId;
  await validateScopeTarget(storeId, nextScopeType, nextScopeId || null);

  const fields = [];
  const values = [];
  let index = 1;
  const setField = (column, value) => {
    fields.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (payload.name !== undefined) setField('name', payload.name);
  if (payload.promotionType !== undefined) setField('promotion_type', payload.promotionType);
  if (payload.discountValue !== undefined) setField('discount_value', payload.discountValue);
  if (payload.scopeType !== undefined) setField('scope_type', payload.scopeType);
  if (payload.scopeId !== undefined) setField('scope_id', payload.scopeId || null);
  if (payload.couponCode !== undefined) setField('coupon_code', payload.couponCode || null);
  if (payload.startAt !== undefined) setField('start_at', payload.startAt);
  if (payload.endAt !== undefined) setField('end_at', payload.endAt);
  if (payload.precedenceRule !== undefined) setField('precedence_rule', payload.precedenceRule);

  if (!fields.length) {
    return existing;
  }

  values.push(promotionId, storeId);
  await query(
    `UPDATE promotions
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${index} AND store_id = $${index + 1}`,
    values
  );
  await refreshActiveCache(storeId);
  return loadPromotionById(promotionId, storeId);
}

async function deletePromotion(promotionId, storeId) {
  const result = await query(
    `DELETE FROM promotions
     WHERE id = $1 AND store_id = $2
     RETURNING id`,
    [promotionId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Promotion not found', 404);
  }
  return { id: promotionId, deleted: true };
}

async function recordPromotionRedemptions(client, saleId, saleLines) {
  for (const line of saleLines) {
    if (!line.promotionId || !line.promoDiscount || line.promoDiscount <= 0) {
      continue;
    }
    await client.query(
      `INSERT INTO promotion_redemptions (
        promotion_id,
        sale_id,
        sale_line_id,
        discounted_amount
      ) VALUES ($1, $2, $3, $4)`,
      [line.promotionId, saleId, line.saleLineId, line.promoDiscount]
    );
    await client.query(
      `UPDATE promotions
       SET usage_count = usage_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [line.promotionId]
    );
  }
}

module.exports = {
  roundMoney,
  resolvePromotionStatus,
  calculatePromotionDiscount,
  promotionAppliesToVariant,
  selectWinningPromotion,
  loadActivePromotions,
  applyPromotionDiscounts,
  applyPromotionDiscountsForStore,
  getVariantPromotionSnapshot,
  listPromotions,
  loadPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  recordPromotionRedemptions,
  refreshActiveCache,
};
