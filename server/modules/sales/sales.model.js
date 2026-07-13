const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const cashRegisterModel = require('../cash-register/cash-register.model');
const promotionsModel = require('../promotions/promotions.model');

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

function mergeSaleLines(lines) {
  const merged = new Map();
  lines.forEach((line) => {
    const existing = merged.get(line.variantId);
    if (existing) {
      existing.quantity += line.quantity;
      existing.lineDiscount = roundMoney(existing.lineDiscount + line.lineDiscount);
    } else {
      merged.set(line.variantId, {
        variantId: line.variantId,
        quantity: line.quantity,
        lineDiscount: roundMoney(line.lineDiscount || 0),
      });
    }
  });
  return Array.from(merged.values());
}

function mapLookupRow(row) {
  const unitPrice =
    row.discount_override != null ? Number(row.discount_override) : Number(row.selling_price);
  return {
    variantId: row.variant_id,
    sku: row.sku,
    barcode: row.barcode,
    sellingPrice: Number(row.selling_price),
    unitPrice,
    costPrice: Number(row.cost_price),
    discountOverride: row.discount_override != null ? Number(row.discount_override) : null,
    taxRate: Number(row.tax_rate || 0),
    product: {
      id: row.product_id,
      name: row.product_name,
      imageUrl: row.image_url || null,
    },
    attributes: normalizeAttributes(row.attributes).map((item) => ({
      attributeName: item.attributeName,
      value: item.value,
      swatchHex: item.swatchHex || null,
    })),
    stock: {
      quantityOnHand: Number(row.quantity_on_hand || 0),
    },
    promotion: row.promotion || null,
  };
}

function mapSaleSummaryRow(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customer: row.customer_id
      ? { id: row.customer_id, name: row.customer_name, phone: row.customer_phone }
      : null,
    user: { id: row.user_id, name: row.user_name },
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    taxTotal: Number(row.tax_total),
    total: Number(row.total),
    status: row.status,
    lineCount: Number(row.line_count || 0),
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapSaleLineRow(row) {
  return {
    id: row.id,
    variantId: row.variant_id,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPriceAtSale: Number(row.unit_price_at_sale),
    lineDiscount: Number(row.line_discount),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
    costPriceAtSale: Number(row.cost_price_at_sale),
    attributes: normalizeAttributes(row.attributes).map((item) => ({
      attributeName: item.attributeName,
      value: item.value,
    })),
    createdAt: row.created_at,
  };
}

function mapPaymentRow(row) {
  return {
    id: row.id,
    method: row.method,
    amount: Number(row.amount),
    tenderedAmount: row.tendered_amount != null ? Number(row.tendered_amount) : null,
    changeAmount: row.change_amount != null ? Number(row.change_amount) : null,
    referenceNumber: row.reference_number,
    createdAt: row.created_at,
  };
}

function mapHoldCartRow(row) {
  return {
    id: row.id,
    label: row.label,
    customer: row.customer_id
      ? { id: row.customer_id, name: row.customer_name }
      : null,
    user: { id: row.user_id, name: row.user_name },
    status: row.status,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    taxTotal: Number(row.tax_total),
    total: Number(row.total),
    lineCount: Number(row.line_count || 0),
    note: row.note,
    heldAt: row.held_at,
    createdAt: row.created_at,
  };
}

function mapHoldCartLineRow(row) {
  return {
    id: row.id,
    variantId: row.variant_id,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineDiscount: Number(row.line_discount),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
    attributes: normalizeAttributes(row.attributes).map((item) => ({
      attributeName: item.attributeName,
      value: item.value,
    })),
  };
}

async function loadVariantsForSale(client, storeId, variantIds) {
  const result = await client.query(
    `SELECT
      v.id,
      v.sku,
      v.barcode,
      v.selling_price,
      v.cost_price,
      v.discount_override,
      v.status,
      p.id AS product_id,
      p.name AS product_name,
      p.status AS product_status,
      p.category_id,
      p.brand_id,
      COALESCE(tc.rate, 0) AS tax_rate,
      COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand
     FROM variants v
     JOIN products p ON p.id = v.product_id
     LEFT JOIN tax_classes tc ON tc.id = p.tax_class_id
     LEFT JOIN inventory i ON i.variant_id = v.id
     WHERE v.id = ANY($1::uuid[]) AND p.store_id = $2`,
    [variantIds, storeId]
  );
  const variantMap = new Map();
  result.rows.forEach((row) => {
    variantMap.set(row.id, row);
  });
  if (variantMap.size !== variantIds.length) {
    throw new AppError('One or more variants were not found', 404);
  }
  return variantMap;
}

function computeSaleTotals(lines, variantMap) {
  let subtotal = 0;
  let discountTotal = 0;
  let promoDiscountTotal = 0;
  let taxTotal = 0;
  const computedLines = lines.map((line) => {
    const variant = variantMap.get(line.variantId);
    if (variant.status !== 'active' || variant.product_status !== 'active') {
      throw new AppError(`Variant ${variant.sku} is not available for sale`, 400);
    }
    const unitPrice =
      variant.discount_override != null
        ? Number(variant.discount_override)
        : Number(variant.selling_price);
    const lineSubtotal = roundMoney(unitPrice * line.quantity);
    const manualDiscount = roundMoney(line.lineDiscount || 0);
    const promoDiscount = roundMoney(line.promoDiscount || 0);
    const lineDiscount = roundMoney(Math.min(manualDiscount + promoDiscount, lineSubtotal));
    const taxable = roundMoney(lineSubtotal - lineDiscount);
    const taxAmount = roundMoney(taxable * Number(variant.tax_rate) / 100);
    const lineTotal = roundMoney(taxable + taxAmount);
    subtotal = roundMoney(subtotal + lineSubtotal);
    discountTotal = roundMoney(discountTotal + lineDiscount);
    promoDiscountTotal = roundMoney(promoDiscountTotal + Math.min(promoDiscount, lineSubtotal));
    taxTotal = roundMoney(taxTotal + taxAmount);
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice,
      costPrice: Number(variant.cost_price),
      manualDiscount: roundMoney(Math.min(manualDiscount, lineSubtotal)),
      promoDiscount: roundMoney(Math.min(promoDiscount, lineSubtotal)),
      lineDiscount,
      promotionId: line.promotionId || null,
      promotionName: line.promotionName || null,
      taxAmount,
      lineTotal,
      sku: variant.sku,
    };
  });
  const total = roundMoney(subtotal - discountTotal + taxTotal);
  return {
    subtotal,
    discountTotal,
    promoDiscountTotal,
    taxTotal,
    total,
    lines: computedLines,
  };
}

async function computeSaleTotalsWithPromotions(storeId, lines, variantMap, client) {
  const promoLines = await promotionsModel.applyPromotionDiscountsForStore(
    storeId,
    lines,
    variantMap,
    client
  );
  return computeSaleTotals(promoLines, variantMap);
}

async function generateInvoiceNumber(client, storeId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${datePart}-`;
  const result = await client.query(
    `SELECT invoice_number
     FROM sales
     WHERE store_id = $1 AND invoice_number LIKE $2
     ORDER BY invoice_number DESC
     LIMIT 1
     FOR UPDATE`,
    [storeId, `${prefix}%`]
  );
  let sequence = 1;
  if (result.rows[0]) {
    const lastPart = result.rows[0].invoice_number.split('-').pop();
    sequence = Number(lastPart) + 1;
  }
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function validateCustomer(client, storeId, customerId) {
  if (!customerId) {
    return;
  }
  const result = await client.query(
    `SELECT id FROM customers
     WHERE id = $1 AND store_id = $2 AND is_active = TRUE
     LIMIT 1`,
    [customerId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Customer not found', 404);
  }
}

async function resolveCashSession(client, storeId, userId, sessionId) {
  if (sessionId) {
    const result = await client.query(
      `SELECT id, user_id FROM cash_register_sessions
       WHERE id = $1 AND store_id = $2 AND status = 'open'
       LIMIT 1 FOR UPDATE`,
      [sessionId, storeId]
    );
    if (!result.rows[0]) {
      throw new AppError('Cash register session not found or closed', 400);
    }
    if (result.rows[0].user_id !== userId) {
      throw new AppError('Cash register session belongs to another cashier', 403);
    }
    return sessionId;
  }
  const result = await client.query(
    `SELECT id FROM cash_register_sessions
     WHERE store_id = $1 AND user_id = $2 AND status = 'open'
     LIMIT 1 FOR UPDATE`,
    [storeId, userId]
  );
  if (!result.rows[0]) {
    throw new AppError('Open cash register session required before completing a sale', 400);
  }
  return result.rows[0].id;
}

function validatePayments(payments, saleTotal) {
  const paymentTotal = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (Math.abs(paymentTotal - saleTotal) > 0.01) {
    throw new AppError('Payment total does not match sale total', 400);
  }
}

async function lookupVariant(storeId, code) {
  const normalizedCode = code.trim();
  const result = await query(
    `SELECT
      v.id AS variant_id,
      v.sku,
      v.barcode,
      v.selling_price,
      v.cost_price,
      v.discount_override,
      p.id AS product_id,
      p.name AS product_name,
      p.category_id,
      p.brand_id,
      COALESCE(tc.rate, 0) AS tax_rate,
      COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
      pi.file_path AS image_url,
      COALESCE(
        json_agg(
          json_build_object(
            'attributeName', a.name,
            'value', av.value,
            'swatchHex', av.swatch_hex
          )
          ORDER BY a.display_order, av.display_order
        ) FILTER (WHERE av.id IS NOT NULL),
        '[]'::json
      ) AS attributes
     FROM variants v
     JOIN products p ON p.id = v.product_id
     LEFT JOIN tax_classes tc ON tc.id = p.tax_class_id
     LEFT JOIN inventory i ON i.variant_id = v.id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE p.store_id = $1
       AND v.status = 'active'
       AND p.status = 'active'
       AND (v.barcode = $2 OR UPPER(v.sku) = UPPER($2))
     GROUP BY v.id, p.id, p.category_id, p.brand_id, tc.rate, i.quantity_on_hand, pi.file_path
     LIMIT 1`,
    [storeId, normalizedCode]
  );
  if (!result.rows[0]) {
    throw new AppError('No product found for this barcode or SKU', 404);
  }
  const row = result.rows[0];
  const promotion = await promotionsModel.getVariantPromotionSnapshot(storeId, {
    product_id: row.product_id,
    category_id: row.category_id,
    brand_id: row.brand_id,
    selling_price: row.selling_price,
    discount_override: row.discount_override,
  });
  return mapLookupRow({ ...row, promotion });
}

async function previewSale(storeId, payload) {
  const client = await getClient();
  try {
    const mergedLines = mergeSaleLines(payload.lines);
    const variantIds = mergedLines.map((line) => line.variantId);
    const variantMap = await loadVariantsForSale(client, storeId, variantIds);
    return computeSaleTotalsWithPromotions(storeId, mergedLines, variantMap, client);
  } finally {
    client.release();
  }
}

async function completeSale(storeId, userId, payload) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    if (payload.clientRequestId) {
      const existing = await client.query(
        `SELECT id
         FROM sales
         WHERE store_id = $1 AND client_request_id = $2
         LIMIT 1`,
        [storeId, payload.clientRequestId]
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return getSaleById(existing.rows[0].id, storeId);
      }
    }
    const store = await client.query(
      `SELECT allow_oversell FROM stores WHERE id = $1 LIMIT 1`,
      [storeId]
    );
    if (!store.rows[0]) {
      throw new AppError('Store not found', 404);
    }
    const allowOversell = store.rows[0].allow_oversell;
    const mergedLines = mergeSaleLines(payload.lines);
    const variantIds = mergedLines.map((line) => line.variantId);
    const variantMap = await loadVariantsForSale(client, storeId, variantIds);
    const totals = await computeSaleTotalsWithPromotions(storeId, mergedLines, variantMap, client);
    validatePayments(payload.payments, totals.total);
    await validateCustomer(client, storeId, payload.customerId || null);
    const cashRegisterSessionId = await resolveCashSession(
      client,
      storeId,
      userId,
      payload.cashRegisterSessionId || null
    );
    if (payload.holdCartId) {
      const holdResult = await client.query(
        `SELECT id, status FROM hold_carts
         WHERE id = $1 AND store_id = $2
         LIMIT 1 FOR UPDATE`,
        [payload.holdCartId, storeId]
      );
      if (!holdResult.rows[0]) {
        throw new AppError('Hold cart not found', 404);
      }
      if (!['held', 'resumed'].includes(holdResult.rows[0].status)) {
        throw new AppError('Hold cart is no longer active', 400);
      }
    }
    for (const line of totals.lines) {
      const inventoryResult = await client.query(
        `SELECT quantity_on_hand FROM inventory WHERE variant_id = $1 FOR UPDATE`,
        [line.variantId]
      );
      if (!inventoryResult.rows[0]) {
        throw new AppError(`Inventory not found for ${line.sku}`, 404);
      }
      const quantityOnHand = Number(inventoryResult.rows[0].quantity_on_hand);
      if (!allowOversell && quantityOnHand < line.quantity) {
        throw new AppError(`Insufficient stock for ${line.sku}`, 400);
      }
    }
    const invoiceNumber = await generateInvoiceNumber(client, storeId);
    const saleResult = await client.query(
      `INSERT INTO sales (
        store_id,
        invoice_number,
        client_request_id,
        customer_id,
        user_id,
        cash_register_session_id,
        subtotal,
        discount_total,
        tax_total,
        total,
        status,
        note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', $11)
      RETURNING id`,
      [
        storeId,
        invoiceNumber,
        payload.clientRequestId || null,
        payload.customerId || null,
        userId,
        cashRegisterSessionId,
        totals.subtotal,
        totals.discountTotal,
        totals.taxTotal,
        totals.total,
        payload.note || null,
      ]
    );
    const saleId = saleResult.rows[0].id;
    for (const line of totals.lines) {
      const saleLineResult = await client.query(
        `INSERT INTO sale_lines (
          sale_id,
          variant_id,
          promotion_id,
          quantity,
          unit_price_at_sale,
          line_discount,
          tax_amount,
          line_total,
          cost_price_at_sale
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          saleId,
          line.variantId,
          line.promotionId,
          line.quantity,
          line.unitPrice,
          line.lineDiscount,
          line.taxAmount,
          line.lineTotal,
          line.costPrice,
        ]
      );
      line.saleLineId = saleLineResult.rows[0].id;
      const inventoryResult = await client.query(
        `UPDATE inventory
         SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
         WHERE variant_id = $2
         RETURNING quantity_on_hand`,
        [line.quantity, line.variantId]
      );
      const resultingBalance = Number(inventoryResult.rows[0].quantity_on_hand);
      await client.query(
        `INSERT INTO stock_movements (
          variant_id,
          user_id,
          movement_type,
          quantity_delta,
          resulting_balance,
          reference_type,
          reference_id
        ) VALUES ($1, $2, 'sale', $3, $4, 'sale', $5)`,
        [line.variantId, userId, -line.quantity, resultingBalance, saleId]
      );
      await client.query(
        `UPDATE products SET updated_at = NOW()
         WHERE id = (SELECT product_id FROM variants WHERE id = $1)`,
        [line.variantId]
      );
    }
    for (const payment of payload.payments) {
      await client.query(
        `INSERT INTO payments (
          sale_id,
          method,
          amount,
          tendered_amount,
          change_amount,
          reference_number
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          saleId,
          payment.method,
          payment.amount,
          payment.tenderedAmount ?? null,
          payment.changeAmount ?? null,
          payment.referenceNumber || null,
        ]
      );
    }
    if (payload.holdCartId) {
      await client.query(
        `UPDATE hold_carts
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [payload.holdCartId]
      );
    }
    await cashRegisterModel.incrementSessionTotals(
      client,
      cashRegisterSessionId,
      totals.total,
      totals.discountTotal
    );
    await promotionsModel.recordPromotionRedemptions(client, saleId, totals.lines);
    await client.query('COMMIT');
    return getSaleById(saleId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listSales(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      s.id,
      s.invoice_number,
      s.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      s.user_id,
      u.name AS user_name,
      s.subtotal,
      s.discount_total,
      s.tax_total,
      s.total,
      s.status,
      s.note,
      s.created_at,
      COUNT(sl.id) AS line_count,
      COUNT(*) OVER() AS total_count
     FROM sales s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN customers c ON c.id = s.customer_id
     LEFT JOIN sale_lines sl ON sl.sale_id = s.id
     WHERE s.store_id = $1
       AND ($2::text IS NULL OR s.invoice_number ILIKE $2 OR u.name ILIKE $2 OR c.name ILIKE $2)
       AND ($3::sale_status IS NULL OR s.status = $3)
       AND ($4::timestamptz IS NULL OR s.created_at >= $4)
       AND ($5::timestamptz IS NULL OR s.created_at <= $5)
       AND ($6::uuid IS NULL OR s.user_id = $6)
       AND ($7::uuid IS NULL OR s.customer_id = $7)
     GROUP BY s.id, c.name, c.phone, u.name
     ORDER BY s.created_at DESC
     LIMIT $8 OFFSET $9`,
    [
      storeId,
      searchTerm,
      filters.status || null,
      filters.dateFrom || null,
      filters.dateTo || null,
      filters.userId || null,
      filters.customerId || null,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapSaleSummaryRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function getSaleById(saleId, storeId) {
  const saleResult = await query(
    `SELECT
      s.id,
      s.invoice_number,
      s.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      s.user_id,
      u.name AS user_name,
      s.cash_register_session_id,
      s.subtotal,
      s.discount_total,
      s.tax_total,
      s.total,
      s.status,
      s.note,
      s.created_at,
      s.updated_at
     FROM sales s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.id = $1 AND s.store_id = $2
     LIMIT 1`,
    [saleId, storeId]
  );
  if (!saleResult.rows[0]) {
    throw new AppError('Sale not found', 404);
  }
  const linesResult = await query(
    `SELECT
      sl.id,
      sl.variant_id,
      sl.quantity,
      sl.unit_price_at_sale,
      sl.line_discount,
      sl.tax_amount,
      sl.line_total,
      sl.cost_price_at_sale,
      sl.created_at,
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
      ) AS attributes
     FROM sale_lines sl
     JOIN variants v ON v.id = sl.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE sl.sale_id = $1
     GROUP BY sl.id, v.sku, v.barcode, p.name
     ORDER BY sl.created_at ASC`,
    [saleId]
  );
  const paymentsResult = await query(
    `SELECT id, method, amount, tendered_amount, change_amount, reference_number, created_at
     FROM payments
     WHERE sale_id = $1
     ORDER BY created_at ASC`,
    [saleId]
  );
  const sale = saleResult.rows[0];
  return {
    id: sale.id,
    invoiceNumber: sale.invoice_number,
    customer: sale.customer_id
      ? { id: sale.customer_id, name: sale.customer_name, phone: sale.customer_phone }
      : null,
    user: { id: sale.user_id, name: sale.user_name },
    cashRegisterSessionId: sale.cash_register_session_id,
    subtotal: Number(sale.subtotal),
    discountTotal: Number(sale.discount_total),
    taxTotal: Number(sale.tax_total),
    total: Number(sale.total),
    status: sale.status,
    note: sale.note,
    lines: linesResult.rows.map(mapSaleLineRow),
    payments: paymentsResult.rows.map(mapPaymentRow),
    createdAt: sale.created_at,
    updatedAt: sale.updated_at,
  };
}

async function voidSale(saleId, storeId, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const saleResult = await client.query(
      `SELECT id, status, cash_register_session_id, total, discount_total
       FROM sales
       WHERE id = $1 AND store_id = $2
       LIMIT 1 FOR UPDATE`,
      [saleId, storeId]
    );
    if (!saleResult.rows[0]) {
      throw new AppError('Sale not found', 404);
    }
    if (saleResult.rows[0].status === 'voided') {
      throw new AppError('Sale is already voided', 400);
    }
    const saleRecord = saleResult.rows[0];
    const linesResult = await client.query(
      `SELECT sl.id, sl.variant_id, sl.quantity, v.sku
       FROM sale_lines sl
       JOIN variants v ON v.id = sl.variant_id
       WHERE sl.sale_id = $1`,
      [saleId]
    );
    for (const line of linesResult.rows) {
      const inventoryResult = await client.query(
        `UPDATE inventory
         SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
         WHERE variant_id = $2
         RETURNING quantity_on_hand`,
        [line.quantity, line.variant_id]
      );
      const resultingBalance = Number(inventoryResult.rows[0].quantity_on_hand);
      await client.query(
        `INSERT INTO stock_movements (
          variant_id,
          user_id,
          movement_type,
          quantity_delta,
          resulting_balance,
          reference_type,
          reference_id,
          reason
        ) VALUES ($1, $2, 'return', $3, $4, 'sale_void', $5, $6)`,
        [line.variant_id, userId, line.quantity, resultingBalance, saleId, 'Sale voided']
      );
      await client.query(
        `UPDATE products SET updated_at = NOW()
         WHERE id = (SELECT product_id FROM variants WHERE id = $1)`,
        [line.variant_id]
      );
    }
    await client.query(
      `UPDATE sales SET status = 'voided', updated_at = NOW() WHERE id = $1`,
      [saleId]
    );
    if (saleRecord.cash_register_session_id) {
      await cashRegisterModel.decrementSessionTotals(
        client,
        saleRecord.cash_register_session_id,
        saleRecord.total,
        saleRecord.discount_total
      );
    }
    await client.query('COMMIT');
    return getSaleById(saleId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listHoldCarts(storeId) {
  const result = await query(
    `SELECT
      hc.id,
      hc.label,
      hc.customer_id,
      c.name AS customer_name,
      hc.user_id,
      u.name AS user_name,
      hc.status,
      hc.subtotal,
      hc.discount_total,
      hc.tax_total,
      hc.total,
      hc.note,
      hc.held_at,
      hc.created_at,
      COUNT(hcl.id) AS line_count
     FROM hold_carts hc
     JOIN users u ON u.id = hc.user_id
     LEFT JOIN customers c ON c.id = hc.customer_id
     LEFT JOIN hold_cart_lines hcl ON hcl.hold_cart_id = hc.id
     WHERE hc.store_id = $1 AND hc.status = 'held'
     GROUP BY hc.id, c.name, u.name
     ORDER BY hc.held_at DESC`,
    [storeId]
  );
  return result.rows.map(mapHoldCartRow);
}

async function loadHoldCartById(holdCartId, storeId) {
  const cartResult = await query(
    `SELECT
      hc.id,
      hc.label,
      hc.customer_id,
      c.name AS customer_name,
      hc.user_id,
      u.name AS user_name,
      hc.status,
      hc.subtotal,
      hc.discount_total,
      hc.tax_total,
      hc.total,
      hc.note,
      hc.held_at,
      hc.resumed_at,
      hc.completed_at,
      hc.created_at
     FROM hold_carts hc
     JOIN users u ON u.id = hc.user_id
     LEFT JOIN customers c ON c.id = hc.customer_id
     WHERE hc.id = $1 AND hc.store_id = $2
     LIMIT 1`,
    [holdCartId, storeId]
  );
  if (!cartResult.rows[0]) {
    throw new AppError('Hold cart not found', 404);
  }
  const linesResult = await query(
    `SELECT
      hcl.id,
      hcl.variant_id,
      hcl.quantity,
      hcl.unit_price,
      hcl.line_discount,
      hcl.tax_amount,
      hcl.line_total,
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
      ) AS attributes
     FROM hold_cart_lines hcl
     JOIN variants v ON v.id = hcl.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE hcl.hold_cart_id = $1
     GROUP BY hcl.id, v.sku, v.barcode, p.name
     ORDER BY hcl.created_at ASC`,
    [holdCartId]
  );
  const cart = cartResult.rows[0];
  return {
    id: cart.id,
    label: cart.label,
    customer: cart.customer_id ? { id: cart.customer_id, name: cart.customer_name } : null,
    user: { id: cart.user_id, name: cart.user_name },
    status: cart.status,
    subtotal: Number(cart.subtotal),
    discountTotal: Number(cart.discount_total),
    taxTotal: Number(cart.tax_total),
    total: Number(cart.total),
    note: cart.note,
    lines: linesResult.rows.map(mapHoldCartLineRow),
    heldAt: cart.held_at,
    resumedAt: cart.resumed_at,
    completedAt: cart.completed_at,
    createdAt: cart.created_at,
  };
}

async function createHoldCart(storeId, userId, payload) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const mergedLines = mergeSaleLines(payload.lines);
    const variantIds = mergedLines.map((line) => line.variantId);
    const variantMap = await loadVariantsForSale(client, storeId, variantIds);
    const totals = await computeSaleTotalsWithPromotions(storeId, mergedLines, variantMap, client);
    await validateCustomer(client, storeId, payload.customerId || null);
    const cartResult = await client.query(
      `INSERT INTO hold_carts (
        store_id,
        label,
        customer_id,
        user_id,
        status,
        subtotal,
        discount_total,
        tax_total,
        total,
        note
      ) VALUES ($1, $2, $3, $4, 'held', $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        storeId,
        payload.label || null,
        payload.customerId || null,
        userId,
        totals.subtotal,
        totals.discountTotal,
        totals.taxTotal,
        totals.total,
        payload.note || null,
      ]
    );
    const holdCartId = cartResult.rows[0].id;
    for (const line of totals.lines) {
      await client.query(
        `INSERT INTO hold_cart_lines (
          hold_cart_id,
          variant_id,
          quantity,
          unit_price,
          line_discount,
          tax_amount,
          line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          holdCartId,
          line.variantId,
          line.quantity,
          line.unitPrice,
          line.lineDiscount,
          line.taxAmount,
          line.lineTotal,
        ]
      );
    }
    await client.query('COMMIT');
    return loadHoldCartById(holdCartId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function resumeHoldCart(holdCartId, storeId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const cartResult = await client.query(
      `SELECT id, status FROM hold_carts
       WHERE id = $1 AND store_id = $2
       LIMIT 1 FOR UPDATE`,
      [holdCartId, storeId]
    );
    if (!cartResult.rows[0]) {
      throw new AppError('Hold cart not found', 404);
    }
    if (cartResult.rows[0].status !== 'held') {
      throw new AppError('Hold cart cannot be resumed', 400);
    }
    await client.query(
      `UPDATE hold_carts
       SET status = 'resumed', resumed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [holdCartId]
    );
    await client.query('COMMIT');
    return loadHoldCartById(holdCartId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cancelHoldCart(holdCartId, storeId) {
  const result = await query(
    `UPDATE hold_carts
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND store_id = $2 AND status IN ('held', 'resumed')
     RETURNING id`,
    [holdCartId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Hold cart not found or already processed', 404);
  }
  return { id: holdCartId, status: 'cancelled' };
}

module.exports = {
  lookupVariant,
  previewSale,
  completeSale,
  listSales,
  getSaleById,
  voidSale,
  listHoldCarts,
  createHoldCart,
  resumeHoldCart,
  cancelHoldCart,
  loadHoldCartById,
};
