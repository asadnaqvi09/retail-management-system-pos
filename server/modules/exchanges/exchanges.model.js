const bcrypt = require('bcryptjs');
const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeAttributes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw).filter(Boolean);
    } catch (error) {
      return [];
    }
  }
  return [];
}

function mapExchangeSummaryRow(row) {
  return {
    id: row.id,
    exchangeNumber: row.exchange_number,
    exchangeType: row.exchange_type,
    originalSale: {
      id: row.original_sale_id,
      invoiceNumber: row.invoice_number,
    },
    user: { id: row.user_id, name: row.user_name },
    netAmount: Number(row.net_amount),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapExchangeLineRow(row) {
  return {
    id: row.id,
    originalSaleLineId: row.original_sale_line_id,
    newVariantId: row.new_variant_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    disposition: row.disposition,
    productName: row.product_name,
    sku: row.sku,
    barcode: row.barcode,
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

async function verifyAdminOverride(storeId, username, credential) {
  const result = await query(
    `SELECT u.id, u.pin_hash, u.password_hash, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.store_id = $1
       AND LOWER(u.username) = LOWER($2)
       AND u.status = 'active'
     LIMIT 1`,
    [storeId, username]
  );
  const user = result.rows[0];
  if (!user || user.role_name !== 'Admin') {
    throw new AppError('Admin override credentials are invalid', 403);
  }
  let isValid = false;
  if (user.pin_hash) {
    isValid = await bcrypt.compare(credential, user.pin_hash);
  }
  if (!isValid && user.password_hash) {
    isValid = await bcrypt.compare(credential, user.password_hash);
  }
  if (!isValid) {
    throw new AppError('Admin override credentials are invalid', 403);
  }
  return { id: user.id, roleName: user.role_name };
}

async function loadStorePolicy(storeId) {
  const result = await query(
    `SELECT return_policy_days, allow_oversell
     FROM stores
     WHERE id = $1
     LIMIT 1`,
    [storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Store not found', 404);
  }
  return {
    returnPolicyDays: Number(result.rows[0].return_policy_days),
    allowOversell: result.rows[0].allow_oversell,
  };
}

function evaluatePolicyWindow(saleCreatedAt, returnPolicyDays) {
  const saleDate = new Date(saleCreatedAt);
  const now = new Date();
  const daysSinceSale = Math.floor((now - saleDate) / (1000 * 60 * 60 * 24));
  return {
    withinWindow: daysSinceSale <= returnPolicyDays,
    daysSinceSale,
    returnPolicyDays,
    requiresOverride: daysSinceSale > returnPolicyDays,
  };
}

async function loadSaleLinesForExchange(client, saleId, storeId) {
  const saleResult = await client.query(
    `SELECT
      s.id,
      s.invoice_number,
      s.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      s.user_id,
      u.name AS user_name,
      s.status,
      s.subtotal,
      s.discount_total,
      s.tax_total,
      s.total,
      s.created_at
     FROM sales s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.id = $1 AND s.store_id = $2
     LIMIT 1
     FOR UPDATE`,
    [saleId, storeId]
  );
  if (!saleResult.rows[0]) {
    throw new AppError('Sale not found', 404);
  }
  if (saleResult.rows[0].status === 'voided') {
    throw new AppError('Cannot process returns for a voided sale', 400);
  }
  const linesResult = await client.query(
    `SELECT
      sl.id,
      sl.variant_id,
      sl.quantity,
      sl.returned_quantity,
      sl.unit_price_at_sale,
      sl.line_discount,
      sl.tax_amount,
      sl.line_total,
      sl.cost_price_at_sale,
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
  const sale = saleResult.rows[0];
  const lines = linesResult.rows.map((row) => {
    const purchasedQuantity = Number(row.quantity);
    const returnedQuantity = Number(row.returned_quantity);
    const returnableQuantity = purchasedQuantity - returnedQuantity;
    const refundUnitPrice = purchasedQuantity > 0 ? roundMoney(Number(row.line_total) / purchasedQuantity) : 0;
    return {
      id: row.id,
      variantId: row.variant_id,
      sku: row.sku,
      barcode: row.barcode,
      productName: row.product_name,
      quantity: purchasedQuantity,
      returnedQuantity,
      returnableQuantity,
      unitPriceAtSale: Number(row.unit_price_at_sale),
      lineDiscount: Number(row.line_discount),
      lineTotal: Number(row.line_total),
      refundUnitPrice,
      attributes: normalizeAttributes(row.attributes).map((item) => ({
        attributeName: item.attributeName,
        value: item.value,
      })),
    };
  });
  return {
    id: sale.id,
    invoiceNumber: sale.invoice_number,
    customer: sale.customer_id
      ? { id: sale.customer_id, name: sale.customer_name, phone: sale.customer_phone }
      : null,
    user: { id: sale.user_id, name: sale.user_name },
    subtotal: Number(sale.subtotal),
    discountTotal: Number(sale.discount_total),
    taxTotal: Number(sale.tax_total),
    total: Number(sale.total),
    status: sale.status,
    createdAt: sale.created_at,
    lines,
  };
}

async function loadNewVariants(client, storeId, variantIds) {
  if (!variantIds.length) {
    return new Map();
  }
  const result = await client.query(
    `SELECT
      v.id,
      v.sku,
      v.barcode,
      v.selling_price,
      v.discount_override,
      v.status,
      p.id AS product_id,
      p.name AS product_name,
      p.status AS product_status,
      COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
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
     LEFT JOIN inventory i ON i.variant_id = v.id
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = v.id
     LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
     LEFT JOIN attributes a ON a.id = av.attribute_id
     WHERE p.store_id = $1 AND v.id = ANY($2::uuid[])
     GROUP BY v.id, p.id, i.quantity_on_hand`,
    [storeId, variantIds]
  );
  const map = new Map();
  result.rows.forEach((row) => {
    const unitPrice =
      row.discount_override != null ? Number(row.discount_override) : Number(row.selling_price);
    map.set(row.id, {
      variantId: row.id,
      sku: row.sku,
      barcode: row.barcode,
      unitPrice,
      productName: row.product_name,
      productStatus: row.product_status,
      variantStatus: row.status,
      stockOnHand: Number(row.quantity_on_hand),
      attributes: normalizeAttributes(row.attributes).map((item) => ({
        attributeName: item.attributeName,
        value: item.value,
      })),
    });
  });
  return map;
}

async function computeExchangeTotals(storeId, payload, options = {}) {
  const client = options.client || null;
  const releaseClient = !client;
  const dbClient = client || (await getClient());
  try {
    const sale = await loadSaleLinesForExchange(dbClient, payload.originalSaleId, storeId);
    const policy = await loadStorePolicy(storeId);
    const policyStatus = evaluatePolicyWindow(sale.createdAt, policy.returnPolicyDays);
    if (policyStatus.requiresOverride && !payload.adminOverride) {
      throw new AppError(
        `Return window expired (${policyStatus.daysSinceSale} days). Admin override required.`,
        403
      );
    }
    if (policyStatus.requiresOverride && payload.adminOverride) {
      await verifyAdminOverride(
        storeId,
        payload.adminOverride.username,
        payload.adminOverride.pin
      );
    }
    const saleLineMap = new Map(sale.lines.map((line) => [line.id, line]));
    const computedReturnLines = [];
    let returnSubtotal = 0;
    for (const returnLine of payload.returnLines) {
      const saleLine = saleLineMap.get(returnLine.originalSaleLineId);
      if (!saleLine) {
        throw new AppError('Return line does not belong to this sale', 400);
      }
      if (returnLine.quantity > saleLine.returnableQuantity) {
        throw new AppError(
          `Cannot return more than ${saleLine.returnableQuantity} for ${saleLine.sku}`,
          400
        );
      }
      const lineTotal = roundMoney(saleLine.refundUnitPrice * returnLine.quantity);
      returnSubtotal = roundMoney(returnSubtotal + lineTotal);
      computedReturnLines.push({
        originalSaleLineId: saleLine.id,
        variantId: saleLine.variantId,
        quantity: returnLine.quantity,
        disposition: returnLine.disposition || 'restock',
        unitPrice: saleLine.refundUnitPrice,
        lineTotal,
        sku: saleLine.sku,
        barcode: saleLine.barcode,
        productName: saleLine.productName,
        attributes: saleLine.attributes,
        returnableQuantity: saleLine.returnableQuantity,
      });
    }
    const newLines = payload.newLines || [];
    const variantIds = newLines.map((line) => line.variantId);
    const variantMap = await loadNewVariants(dbClient, storeId, variantIds);
    const computedNewLines = [];
    let newSubtotal = 0;
    for (const newLine of newLines) {
      const variant = variantMap.get(newLine.variantId);
      if (!variant) {
        throw new AppError('Replacement variant not found', 404);
      }
      if (variant.variantStatus !== 'active' || variant.productStatus !== 'active') {
        throw new AppError(`Variant ${variant.sku} is not available for sale`, 400);
      }
      if (!policy.allowOversell && variant.stockOnHand < newLine.quantity) {
        throw new AppError(`Insufficient stock for ${variant.sku}`, 400);
      }
      const lineTotal = roundMoney(variant.unitPrice * newLine.quantity);
      newSubtotal = roundMoney(newSubtotal + lineTotal);
      computedNewLines.push({
        variantId: variant.variantId,
        quantity: newLine.quantity,
        unitPrice: variant.unitPrice,
        lineTotal,
        sku: variant.sku,
        barcode: variant.barcode,
        productName: variant.productName,
        attributes: variant.attributes,
        stockOnHand: variant.stockOnHand,
      });
    }
    const netAmount = roundMoney(newSubtotal - returnSubtotal);
    const exchangeType = computedNewLines.length > 0 ? 'exchange' : 'return';
    let balanceDirection = 'even';
    if (netAmount > 0) {
      balanceDirection = 'customer_pays';
    } else if (netAmount < 0) {
      balanceDirection = 'refund';
    }
    return {
      exchangeType,
      returnSubtotal,
      newSubtotal,
      netAmount,
      balanceDirection,
      returnLines: computedReturnLines,
      newLines: computedNewLines,
      policyStatus,
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoice_number,
        customer: sale.customer,
        createdAt: sale.createdAt,
        total: sale.total,
      },
    };
  } finally {
    if (releaseClient) {
      dbClient.release();
    }
  }
}

function validateSettlementPayment(netAmount, settlementPayment) {
  const absNet = Math.abs(netAmount);
  if (absNet === 0) {
    if (settlementPayment) {
      throw new AppError('No settlement payment is required for this exchange', 400);
    }
    return;
  }
  if (!settlementPayment) {
    throw new AppError('Settlement payment is required', 400);
  }
  if (roundMoney(settlementPayment.amount) !== absNet) {
    throw new AppError(`Settlement amount must be ${absNet}`, 400);
  }
  if (netAmount > 0 && settlementPayment.method === 'store_credit') {
    throw new AppError('Store credit cannot be used when the customer owes money', 400);
  }
}

async function generateExchangeNumber(client, storeId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `EXC-${datePart}-`;
  const result = await client.query(
    `SELECT exchange_number
     FROM exchanges
     WHERE store_id = $1 AND exchange_number LIKE $2
     ORDER BY exchange_number DESC
     LIMIT 1
     FOR UPDATE`,
    [storeId, `${prefix}%`]
  );
  let sequence = 1;
  if (result.rows[0]) {
    const lastPart = result.rows[0].exchange_number.split('-').pop();
    sequence = Number(lastPart) + 1;
  }
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function applyInventoryReturn(client, variantId, userId, quantity, disposition, exchangeId, exchangeType) {
  if (disposition === 'damaged') {
    await client.query(
      `INSERT INTO stock_movements (
        variant_id,
        user_id,
        movement_type,
        quantity_delta,
        resulting_balance,
        reference_type,
        reference_id,
        reason,
        note
      ) VALUES (
        $1, $2, 'damage', 0,
        (SELECT quantity_on_hand FROM inventory WHERE variant_id = $1),
        'exchange', $3, 'Returned damaged item', $4
      )`,
      [variantId, userId, exchangeId, `Disposition: damaged (${quantity} unit(s))`]
    );
    return;
  }
  const inventoryResult = await client.query(
    `UPDATE inventory
     SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
     WHERE variant_id = $2
     RETURNING quantity_on_hand`,
    [quantity, variantId]
  );
  if (!inventoryResult.rows[0]) {
    throw new AppError('Inventory record not found for returned variant', 404);
  }
  const resultingBalance = Number(inventoryResult.rows[0].quantity_on_hand);
  const movementType = exchangeType === 'exchange' ? 'exchange_in' : 'return';
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
    ) VALUES ($1, $2, $3, $4, $5, 'exchange', $6, $7)`,
    [variantId, userId, movementType, quantity, resultingBalance, exchangeId, 'Item returned to stock']
  );
  await client.query(
    `UPDATE products SET updated_at = NOW()
     WHERE id = (SELECT product_id FROM variants WHERE id = $1)`,
    [variantId]
  );
}

async function applyInventoryExchangeOut(client, variantId, userId, quantity, exchangeId) {
  const inventoryResult = await client.query(
    `UPDATE inventory
     SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
     WHERE variant_id = $2
     RETURNING quantity_on_hand`,
    [quantity, variantId]
  );
  if (!inventoryResult.rows[0]) {
    throw new AppError('Inventory record not found for replacement variant', 404);
  }
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
    ) VALUES ($1, $2, 'exchange_out', $3, $4, 'exchange', $5, $6)`,
    [variantId, userId, -quantity, resultingBalance, exchangeId, 'Replacement item issued']
  );
  await client.query(
    `UPDATE products SET updated_at = NOW()
     WHERE id = (SELECT product_id FROM variants WHERE id = $1)`,
    [variantId]
  );
}

async function lookupSaleByCode(storeId, code) {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new AppError('Invoice or barcode code is required', 400);
  }
  const result = await query(
    `SELECT
      s.id,
      s.invoice_number,
      s.total,
      s.status,
      s.created_at,
      c.name AS customer_name,
      c.phone AS customer_phone
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND (
         s.invoice_number ILIKE $2
         OR s.invoice_number = $3
       )
     ORDER BY s.created_at DESC
     LIMIT 5`,
    [storeId, `%${trimmed}%`, trimmed]
  );
  return result.rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    total: Number(row.total),
    status: row.status,
    customer: row.customer_name
      ? { name: row.customer_name, phone: row.customer_phone }
      : null,
    createdAt: row.created_at,
  }));
}

async function lookupSalesByCustomerPhone(storeId, phone) {
  const trimmed = phone.trim();
  if (!trimmed) {
    throw new AppError('Customer phone is required', 400);
  }
  const result = await query(
    `SELECT
      s.id,
      s.invoice_number,
      s.total,
      s.status,
      s.created_at,
      c.name AS customer_name,
      c.phone AS customer_phone
     FROM sales s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND REPLACE(c.phone, ' ', '') ILIKE REPLACE($2, ' ', '')
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [storeId, `%${trimmed}%`]
  );
  return result.rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    total: Number(row.total),
    status: row.status,
    customer: { name: row.customer_name, phone: row.customer_phone },
    createdAt: row.created_at,
  }));
}

async function getEligibleSale(storeId, saleId) {
  const client = await getClient();
  try {
    const sale = await loadSaleLinesForExchange(client, saleId, storeId);
    const policy = await loadStorePolicy(storeId);
    const policyStatus = evaluatePolicyWindow(sale.createdAt, policy.returnPolicyDays);
    return {
      ...sale,
      policyStatus,
    };
  } finally {
    client.release();
  }
}

async function previewExchange(storeId, payload) {
  return computeExchangeTotals(storeId, payload);
}

async function createExchange(storeId, userId, payload) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const totals = await computeExchangeTotals(storeId, payload, { client });
    validateSettlementPayment(totals.netAmount, payload.settlementPayment);
    const exchangeNumber = await generateExchangeNumber(client, storeId);
    const exchangeResult = await client.query(
      `INSERT INTO exchanges (
        store_id,
        original_sale_id,
        user_id,
        exchange_number,
        exchange_type,
        net_amount,
        status,
        note
      ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7)
      RETURNING id`,
      [
        storeId,
        payload.originalSaleId,
        userId,
        exchangeNumber,
        totals.exchangeType,
        totals.netAmount,
        payload.note || null,
      ]
    );
    const exchangeId = exchangeResult.rows[0].id;
    for (const returnLine of totals.returnLines) {
      await client.query(
        `INSERT INTO exchange_lines (
          exchange_id,
          original_sale_line_id,
          quantity,
          unit_price,
          line_total,
          disposition
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          exchangeId,
          returnLine.originalSaleLineId,
          returnLine.quantity,
          returnLine.unitPrice,
          returnLine.lineTotal,
          returnLine.disposition,
        ]
      );
      await client.query(
        `UPDATE sale_lines
         SET returned_quantity = returned_quantity + $1
         WHERE id = $2`,
        [returnLine.quantity, returnLine.originalSaleLineId]
      );
      await applyInventoryReturn(
        client,
        returnLine.variantId,
        userId,
        returnLine.quantity,
        returnLine.disposition,
        exchangeId,
        totals.exchangeType
      );
    }
    for (const newLine of totals.newLines) {
      await client.query(
        `INSERT INTO exchange_lines (
          exchange_id,
          new_variant_id,
          quantity,
          unit_price,
          line_total
        ) VALUES ($1, $2, $3, $4, $5)`,
        [exchangeId, newLine.variantId, newLine.quantity, newLine.unitPrice, newLine.lineTotal]
      );
      await applyInventoryExchangeOut(client, newLine.variantId, userId, newLine.quantity, exchangeId);
    }
    if (payload.settlementPayment && Math.abs(totals.netAmount) > 0) {
      await client.query(
        `INSERT INTO payments (
          exchange_id,
          method,
          amount,
          tendered_amount,
          change_amount,
          reference_number
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          exchangeId,
          payload.settlementPayment.method,
          payload.settlementPayment.amount,
          payload.settlementPayment.tenderedAmount ?? null,
          payload.settlementPayment.changeAmount ?? null,
          payload.settlementPayment.referenceNumber || null,
        ]
      );
    }
    if (totals.policyStatus.requiresOverride && payload.adminOverride) {
      const admin = await verifyAdminOverride(
        storeId,
        payload.adminOverride.username,
        payload.adminOverride.pin
      );
      await client.query(
        `INSERT INTO audit_log (
          store_id,
          user_id,
          action,
          entity_type,
          entity_id,
          metadata_json
        ) VALUES ($1, $2, 'exchange_policy_override', 'exchange', $3, $4::jsonb)`,
        [
          storeId,
          admin.id,
          exchangeId,
          JSON.stringify({
            overriddenBy: admin.id,
            processedBy: userId,
            daysSinceSale: totals.policyStatus.daysSinceSale,
            originalSaleId: payload.originalSaleId,
          }),
        ]
      );
    }
    await client.query('COMMIT');
    return getExchangeById(exchangeId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getExchangeById(exchangeId, storeId) {
  const exchangeResult = await query(
    `SELECT
      e.id,
      e.exchange_number,
      e.exchange_type,
      e.original_sale_id,
      s.invoice_number,
      e.user_id,
      u.name AS user_name,
      e.net_amount,
      e.status,
      e.note,
      e.created_at
     FROM exchanges e
     JOIN sales s ON s.id = e.original_sale_id
     JOIN users u ON u.id = e.user_id
     WHERE e.id = $1 AND e.store_id = $2
     LIMIT 1`,
    [exchangeId, storeId]
  );
  if (!exchangeResult.rows[0]) {
    throw new AppError('Exchange not found', 404);
  }
  const linesResult = await query(
    `SELECT
      el.id,
      el.original_sale_line_id,
      el.new_variant_id,
      el.quantity,
      el.unit_price,
      el.line_total,
      el.disposition,
      el.created_at,
      COALESCE(p_return.name, p_new.name) AS product_name,
      COALESCE(v_return.sku, v_new.sku) AS sku,
      COALESCE(v_return.barcode, v_new.barcode) AS barcode,
      COALESCE(return_attrs.attributes, new_attrs.attributes, '[]'::json) AS attributes
     FROM exchange_lines el
     LEFT JOIN sale_lines sl ON sl.id = el.original_sale_line_id
     LEFT JOIN variants v_return ON v_return.id = sl.variant_id
     LEFT JOIN products p_return ON p_return.id = v_return.product_id
     LEFT JOIN variants v_new ON v_new.id = el.new_variant_id
     LEFT JOIN products p_new ON p_new.id = v_new.product_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(
         json_agg(
           json_build_object('attributeName', a.name, 'value', av.value)
           ORDER BY a.display_order, av.display_order
         ) FILTER (WHERE av.id IS NOT NULL),
         '[]'::json
       ) AS attributes
       FROM variant_attribute_values vav
       JOIN attribute_values av ON av.id = vav.attribute_value_id
       JOIN attributes a ON a.id = av.attribute_id
       WHERE vav.variant_id = v_return.id
     ) return_attrs ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(
         json_agg(
           json_build_object('attributeName', a.name, 'value', av.value)
           ORDER BY a.display_order, av.display_order
         ) FILTER (WHERE av.id IS NOT NULL),
         '[]'::json
       ) AS attributes
       FROM variant_attribute_values vav
       JOIN attribute_values av ON av.id = vav.attribute_value_id
       JOIN attributes a ON a.id = av.attribute_id
       WHERE vav.variant_id = v_new.id
     ) new_attrs ON TRUE
     WHERE el.exchange_id = $1
     ORDER BY el.created_at ASC`,
    [exchangeId]
  );
  const paymentsResult = await query(
    `SELECT id, method, amount, tendered_amount, change_amount, reference_number, created_at
     FROM payments
     WHERE exchange_id = $1
     ORDER BY created_at ASC`,
    [exchangeId]
  );
  const exchange = exchangeResult.rows[0];
  return {
    ...mapExchangeSummaryRow(exchange),
    returnLines: linesResult.rows
      .filter((row) => row.original_sale_line_id)
      .map(mapExchangeLineRow),
    newLines: linesResult.rows.filter((row) => row.new_variant_id).map(mapExchangeLineRow),
    lines: linesResult.rows.map(mapExchangeLineRow),
    payments: paymentsResult.rows.map(mapPaymentRow),
  };
}

async function listExchanges(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      e.id,
      e.exchange_number,
      e.exchange_type,
      e.original_sale_id,
      s.invoice_number,
      e.user_id,
      u.name AS user_name,
      e.net_amount,
      e.status,
      e.note,
      e.created_at,
      COUNT(*) OVER() AS total_count
     FROM exchanges e
     JOIN sales s ON s.id = e.original_sale_id
     JOIN users u ON u.id = e.user_id
     WHERE e.store_id = $1
       AND ($2::text IS NULL OR e.exchange_number ILIKE $2 OR s.invoice_number ILIKE $2)
       AND ($3::exchange_type IS NULL OR e.exchange_type = $3)
       AND ($4::timestamptz IS NULL OR e.created_at >= $4)
       AND ($5::timestamptz IS NULL OR e.created_at <= $5)
     ORDER BY e.created_at DESC
     LIMIT $6 OFFSET $7`,
    [
      storeId,
      searchTerm,
      filters.exchangeType || null,
      filters.dateFrom || null,
      filters.dateTo || null,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapExchangeSummaryRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

module.exports = {
  lookupSaleByCode,
  lookupSalesByCustomerPhone,
  getEligibleSale,
  previewExchange,
  createExchange,
  getExchangeById,
  listExchanges,
};
