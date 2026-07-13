const dayjs = require('dayjs');
const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function resolveDateRange(filters) {
  const dateTo = filters.dateTo || dayjs().format('YYYY-MM-DD');
  const dateFrom = filters.dateFrom || dayjs(dateTo).subtract(29, 'day').format('YYYY-MM-DD');
  return {
    dateFrom,
    dateTo,
    startAt: `${dateFrom}T00:00:00.000Z`,
    endAt: `${dateTo}T23:59:59.999Z`,
  };
}

function periodSql(range, column = 's.created_at') {
  switch (range) {
    case 'weekly':
      return {
        key: `TO_CHAR(DATE_TRUNC('week', ${column}), 'IYYY-"W"IW')`,
        label: `TO_CHAR(DATE_TRUNC('week', ${column}), 'YYYY-MM-DD')`,
        order: `DATE_TRUNC('week', ${column})`,
      };
    case 'monthly':
      return {
        key: `TO_CHAR(${column}, 'YYYY-MM')`,
        label: `TO_CHAR(${column}, 'Mon YYYY')`,
        order: `DATE_TRUNC('month', ${column})`,
      };
    case 'yearly':
      return {
        key: `TO_CHAR(${column}, 'YYYY')`,
        label: `TO_CHAR(${column}, 'YYYY')`,
        order: `DATE_TRUNC('year', ${column})`,
      };
    case 'daily':
    default:
      return {
        key: `TO_CHAR(${column}::date, 'YYYY-MM-DD')`,
        label: `TO_CHAR(${column}::date, 'Mon DD, YYYY')`,
        order: `${column}::date`,
      };
  }
}

async function getSalesReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const range = filters.range || 'daily';
  const period = periodSql(range);
  const periodsResult = await query(
    `SELECT
      ${period.key} AS period_key,
      ${period.label} AS period_label,
      COUNT(*)::INT AS sale_count,
      COALESCE(SUM(s.total), 0) AS revenue,
      COALESCE(SUM(s.discount_total), 0) AS discount_total,
      COALESCE(SUM(s.tax_total), 0) AS tax_total
     FROM sales s
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND s.created_at >= $2
       AND s.created_at <= $3
     GROUP BY period_key, period_label, ${period.order}
     ORDER BY ${period.order} ASC`,
    [storeId, startAt, endAt]
  );
  const summaryResult = await query(
    `SELECT
      COUNT(*)::INT AS sale_count,
      COALESCE(SUM(total), 0) AS revenue,
      COALESCE(SUM(discount_total), 0) AS discount_total,
      COALESCE(SUM(tax_total), 0) AS tax_total
     FROM sales
     WHERE store_id = $1
       AND status = 'completed'
       AND created_at >= $2
       AND created_at <= $3`,
    [storeId, startAt, endAt]
  );
  let transactions = [];
  if (filters.includeTransactions !== false) {
    const transactionsResult = await query(
      `SELECT
        s.id,
        s.invoice_number,
        s.total,
        s.discount_total,
        s.created_at,
        u.name AS cashier_name,
        c.name AS customer_name
       FROM sales s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.store_id = $1
         AND s.status = 'completed'
         AND s.created_at >= $2
         AND s.created_at <= $3
       ORDER BY s.created_at DESC
       LIMIT 200`,
      [storeId, startAt, endAt]
    );
    transactions = transactionsResult.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      total: Number(row.total),
      discountTotal: Number(row.discount_total),
      createdAt: row.created_at,
      cashierName: row.cashier_name,
      customerName: row.customer_name,
    }));
  }
  const summary = summaryResult.rows[0];
  return {
    range,
    dateFrom,
    dateTo,
    summary: {
      saleCount: Number(summary.sale_count),
      revenue: roundMoney(summary.revenue),
      discountTotal: roundMoney(summary.discount_total),
      taxTotal: roundMoney(summary.tax_total),
    },
    periods: periodsResult.rows.map((row) => ({
      periodKey: row.period_key,
      label: row.period_label,
      saleCount: Number(row.sale_count),
      revenue: roundMoney(row.revenue),
      discountTotal: roundMoney(row.discount_total),
      taxTotal: roundMoney(row.tax_total),
    })),
    transactions,
  };
}

async function getRevenueReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const groupBy = filters.groupBy || 'category';
  const groupColumn =
    groupBy === 'brand'
      ? 'COALESCE(b.name, \'Unbranded\')'
      : groupBy === 'product'
        ? 'p.name'
        : 'COALESCE(c.name, \'Uncategorized\')';
  const result = await query(
    `SELECT
      ${groupColumn} AS name,
      COALESCE(SUM(sl.quantity), 0)::INT AS quantity,
      COALESCE(SUM(sl.line_total), 0) AS revenue
     FROM sale_lines sl
     JOIN sales s ON s.id = sl.sale_id
     JOIN variants v ON v.id = sl.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND s.created_at >= $2
       AND s.created_at <= $3
       AND ($4::uuid IS NULL OR p.category_id = $4)
       AND ($5::uuid IS NULL OR p.brand_id = $5)
     GROUP BY name
     ORDER BY revenue DESC`,
    [storeId, startAt, endAt, filters.categoryId || null, filters.brandId || null]
  );
  const totalRevenue = result.rows.reduce((sum, row) => sum + Number(row.revenue), 0);
  return {
    groupBy,
    dateFrom,
    dateTo,
    totalRevenue: roundMoney(totalRevenue),
    items: result.rows.map((row) => {
      const revenue = roundMoney(row.revenue);
      return {
        name: row.name,
        quantity: Number(row.quantity),
        revenue,
        sharePercent: totalRevenue > 0 ? roundMoney((Number(row.revenue) / totalRevenue) * 100) : 0,
      };
    }),
  };
}

async function getProfitReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const salesResult = await query(
    `SELECT
      COALESCE(SUM(s.total), 0) AS revenue,
      COALESCE(SUM(sl.cost_price_at_sale * sl.quantity), 0) AS cogs,
      COALESCE(SUM(s.discount_total), 0) AS discounts
     FROM sales s
     JOIN sale_lines sl ON sl.sale_id = s.id
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND s.created_at >= $2
       AND s.created_at <= $3`,
    [storeId, startAt, endAt]
  );
  const expensesResult = await query(
    `SELECT COALESCE(SUM(amount), 0) AS expenses
     FROM expenses
     WHERE store_id = $1
       AND expense_date >= $2::date
       AND expense_date <= $3::date`,
    [storeId, dateFrom, dateTo]
  );
  const revenue = roundMoney(salesResult.rows[0].revenue);
  const cogs = roundMoney(salesResult.rows[0].cogs);
  const discounts = roundMoney(salesResult.rows[0].discounts);
  const expenses = roundMoney(expensesResult.rows[0].expenses);
  const grossProfit = roundMoney(revenue - cogs);
  const netProfit = roundMoney(grossProfit - expenses);
  return {
    dateFrom,
    dateTo,
    revenue,
    cogs,
    discounts,
    grossProfit,
    expenses,
    netProfit,
  };
}

async function getInventoryReport(storeId, filters) {
  const deadStockDays = Number(filters.deadStockDays) || 90;
  const valuationResult = await query(
    `SELECT
      v.sku,
      p.name AS product_name,
      i.quantity_on_hand,
      v.cost_price,
      COALESCE(v.discount_override, v.selling_price) AS retail_price,
      (i.quantity_on_hand * v.cost_price) AS cost_value,
      (i.quantity_on_hand * COALESCE(v.discount_override, v.selling_price)) AS retail_value
     FROM inventory i
     JOIN variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE p.store_id = $1
     ORDER BY retail_value DESC`,
    [storeId]
  );
  const movementResult = await query(
    `SELECT
      sm.movement_type,
      COUNT(*)::INT AS movement_count,
      COALESCE(SUM(ABS(sm.quantity_delta)), 0)::INT AS quantity_moved
     FROM stock_movements sm
     JOIN variants v ON v.id = sm.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE p.store_id = $1
       AND sm.created_at >= NOW() - INTERVAL '30 days'
     GROUP BY sm.movement_type
     ORDER BY movement_count DESC`,
    [storeId]
  );
  const deadStockResult = await query(
    `SELECT
      v.sku,
      p.name AS product_name,
      i.quantity_on_hand,
      COALESCE(MAX(s.created_at), NULL) AS last_sale_at
     FROM inventory i
     JOIN variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN sale_lines sl ON sl.variant_id = v.id
     LEFT JOIN sales s ON s.id = sl.sale_id AND s.status = 'completed'
     WHERE p.store_id = $1
       AND i.quantity_on_hand > 0
     GROUP BY v.sku, p.name, i.quantity_on_hand
     HAVING MAX(s.created_at) IS NULL OR MAX(s.created_at) < NOW() - ($2::int || ' days')::interval
     ORDER BY i.quantity_on_hand DESC
     LIMIT 25`,
    [storeId, deadStockDays]
  );
  const items = valuationResult.rows.map((row) => ({
    sku: row.sku,
    productName: row.product_name,
    quantityOnHand: Number(row.quantity_on_hand),
    costValue: roundMoney(row.cost_value),
    retailValue: roundMoney(row.retail_value),
  }));
  const totalCostValue = roundMoney(items.reduce((sum, row) => sum + row.costValue, 0));
  const totalRetailValue = roundMoney(items.reduce((sum, row) => sum + row.retailValue, 0));
  return {
    deadStockDays,
    valuation: {
      totalCostValue,
      totalRetailValue,
      itemCount: items.length,
      items,
    },
    movements: movementResult.rows.map((row) => ({
      movementType: row.movement_type,
      movementCount: Number(row.movement_count),
      quantityMoved: Number(row.quantity_moved),
    })),
    deadStock: deadStockResult.rows.map((row) => ({
      sku: row.sku,
      productName: row.product_name,
      quantityOnHand: Number(row.quantity_on_hand),
      lastSaleAt: row.last_sale_at,
    })),
  };
}

async function getRankedProductsReport(storeId, filters, mode = 'top') {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 50);
  const sortColumn = filters.sortBy === 'revenue' ? 'revenue' : 'quantity_sold';
  const orderDirection = mode === 'low' ? 'ASC' : 'DESC';
  const result = await query(
    `SELECT
      p.id AS product_id,
      p.name AS product_name,
      v.sku,
      COALESCE(SUM(sl.quantity), 0)::INT AS quantity_sold,
      COALESCE(SUM(sl.line_total), 0) AS revenue
     FROM sale_lines sl
     JOIN sales s ON s.id = sl.sale_id
     JOIN variants v ON v.id = sl.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND s.created_at >= $2
       AND s.created_at <= $3
       AND ($4::uuid IS NULL OR p.category_id = $4)
       AND ($5::uuid IS NULL OR p.brand_id = $5)
     GROUP BY p.id, p.name, v.sku
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT $6`,
    [storeId, startAt, endAt, filters.categoryId || null, filters.brandId || null, limit]
  );
  return {
    mode,
    sortBy: filters.sortBy || 'quantity',
    dateFrom,
    dateTo,
    items: result.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      quantitySold: Number(row.quantity_sold),
      revenue: roundMoney(row.revenue),
    })),
  };
}

async function getCashierPerformanceReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const result = await query(
    `SELECT
      u.id AS user_id,
      u.name AS cashier_name,
      COUNT(DISTINCT s.id)::INT AS sale_count,
      COALESCE(SUM(s.total), 0) AS revenue,
      COALESCE(SUM(s.discount_total), 0) AS discount_total,
      COALESCE(ex.exchange_count, 0)::INT AS exchange_count,
      COALESCE(ex.return_count, 0)::INT AS return_count
     FROM users u
     LEFT JOIN sales s ON s.user_id = u.id
       AND s.store_id = $1
       AND s.status = 'completed'
       AND s.created_at >= $2
       AND s.created_at <= $3
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE e.exchange_type = 'exchange')::INT AS exchange_count,
         COUNT(*) FILTER (WHERE e.exchange_type = 'return')::INT AS return_count
       FROM exchanges e
       WHERE e.user_id = u.id
         AND e.store_id = $1
         AND e.created_at >= $2
         AND e.created_at <= $3
     ) ex ON TRUE
     WHERE u.store_id = $1
     GROUP BY u.id, u.name, ex.exchange_count, ex.return_count
     HAVING COUNT(DISTINCT s.id) > 0 OR COALESCE(ex.exchange_count, 0) > 0 OR COALESCE(ex.return_count, 0) > 0
     ORDER BY revenue DESC`,
    [storeId, startAt, endAt]
  );
  return {
    dateFrom,
    dateTo,
    items: result.rows.map((row) => ({
      userId: row.user_id,
      cashierName: row.cashier_name,
      saleCount: Number(row.sale_count),
      revenue: roundMoney(row.revenue),
      discountTotal: roundMoney(row.discount_total),
      exchangeCount: Number(row.exchange_count),
      returnCount: Number(row.return_count),
    })),
  };
}

async function getReturnsReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const summaryResult = await query(
    `SELECT
      COUNT(*)::INT AS return_count,
      COALESCE(SUM(ABS(net_amount)), 0) AS return_value
     FROM exchanges
     WHERE store_id = $1
       AND exchange_type = 'return'
       AND status = 'completed'
       AND created_at >= $2
       AND created_at <= $3`,
    [storeId, startAt, endAt]
  );
  const topProductsResult = await query(
    `SELECT
      p.name AS product_name,
      v.sku,
      COALESCE(SUM(el.quantity), 0)::INT AS quantity,
      COALESCE(SUM(el.line_total), 0) AS value
     FROM exchange_lines el
     JOIN exchanges e ON e.id = el.exchange_id
     JOIN sale_lines sl ON sl.id = el.original_sale_line_id
     JOIN variants v ON v.id = sl.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE e.store_id = $1
       AND e.exchange_type = 'return'
       AND e.created_at >= $2
       AND e.created_at <= $3
     GROUP BY p.name, v.sku
     ORDER BY quantity DESC
     LIMIT 15`,
    [storeId, startAt, endAt]
  );
  const summary = summaryResult.rows[0];
  return {
    dateFrom,
    dateTo,
    summary: {
      returnCount: Number(summary.return_count),
      returnValue: roundMoney(summary.return_value),
    },
    topProducts: topProductsResult.rows.map((row) => ({
      productName: row.product_name,
      sku: row.sku,
      quantity: Number(row.quantity),
      value: roundMoney(row.value),
    })),
  };
}

async function getExchangesReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const summaryResult = await query(
    `SELECT
      COUNT(*)::INT AS exchange_count,
      COALESCE(SUM(net_amount), 0) AS net_amount
     FROM exchanges
     WHERE store_id = $1
       AND exchange_type = 'exchange'
       AND status = 'completed'
       AND created_at >= $2
       AND created_at <= $3`,
    [storeId, startAt, endAt]
  );
  const patternsResult = await query(
    `SELECT
      COALESCE(ret.product_name, 'Returned item') AS from_label,
      COALESCE(newp.product_name, 'Replacement') AS to_label,
      COUNT(*)::INT AS pattern_count
     FROM exchanges e
     JOIN LATERAL (
       SELECT p.name AS product_name
       FROM exchange_lines el
       JOIN sale_lines sl ON sl.id = el.original_sale_line_id
       JOIN variants v ON v.id = sl.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE el.exchange_id = e.id
       LIMIT 1
     ) ret ON TRUE
     JOIN LATERAL (
       SELECT p.name AS product_name
       FROM exchange_lines el
       JOIN variants v ON v.id = el.new_variant_id
       JOIN products p ON p.id = v.product_id
       WHERE el.exchange_id = e.id
       LIMIT 1
     ) newp ON TRUE
     WHERE e.store_id = $1
       AND e.exchange_type = 'exchange'
       AND e.created_at >= $2
       AND e.created_at <= $3
     GROUP BY from_label, to_label
     ORDER BY pattern_count DESC
     LIMIT 15`,
    [storeId, startAt, endAt]
  );
  const summary = summaryResult.rows[0];
  return {
    dateFrom,
    dateTo,
    summary: {
      exchangeCount: Number(summary.exchange_count),
      netAmount: roundMoney(summary.net_amount),
    },
    patterns: patternsResult.rows.map((row) => ({
      fromLabel: row.from_label,
      toLabel: row.to_label,
      count: Number(row.pattern_count),
    })),
  };
}

async function getPaymentMethodsReport(storeId, filters) {
  const { dateFrom, dateTo, startAt, endAt } = resolveDateRange(filters);
  const result = await query(
    `SELECT
      p.method,
      COUNT(*)::INT AS transaction_count,
      COALESCE(SUM(p.amount), 0) AS amount
     FROM payments p
     JOIN sales s ON s.id = p.sale_id
     WHERE s.store_id = $1
       AND s.status = 'completed'
       AND s.created_at >= $2
       AND s.created_at <= $3
     GROUP BY p.method
     ORDER BY amount DESC`,
    [storeId, startAt, endAt]
  );
  const totalAmount = result.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  return {
    dateFrom,
    dateTo,
    totalAmount: roundMoney(totalAmount),
    items: result.rows.map((row) => ({
      method: row.method,
      transactionCount: Number(row.transaction_count),
      amount: roundMoney(row.amount),
      sharePercent: totalAmount > 0 ? roundMoney((Number(row.amount) / totalAmount) * 100) : 0,
    })),
  };
}

const reportFetchers = {
  sales: getSalesReport,
  revenue: getRevenueReport,
  profit: getProfitReport,
  inventory: getInventoryReport,
  'top-selling': (storeId, filters) => getRankedProductsReport(storeId, filters, 'top'),
  'low-selling': (storeId, filters) => getRankedProductsReport(storeId, filters, 'low'),
  'cashier-performance': getCashierPerformanceReport,
  returns: getReturnsReport,
  exchanges: getExchangesReport,
  'payment-methods': getPaymentMethodsReport,
};

async function getReport(reportKey, storeId, filters) {
  const fetcher = reportFetchers[reportKey];
  if (!fetcher) {
    throw new AppError('Report not found', 404);
  }
  return fetcher(storeId, filters);
}

module.exports = {
  getSalesReport,
  getRevenueReport,
  getProfitReport,
  getInventoryReport,
  getRankedProductsReport,
  getCashierPerformanceReport,
  getReturnsReport,
  getExchangesReport,
  getPaymentMethodsReport,
  getReport,
};
