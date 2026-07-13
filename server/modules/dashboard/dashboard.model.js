const dayjs = require('dayjs');
const { query } = require('../../config/database');
const reportsModel = require('../reports/reports.model');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function todayRange() {
  const today = dayjs().format('YYYY-MM-DD');
  return {
    date: today,
    dateFrom: today,
    dateTo: today,
    startAt: `${today}T00:00:00.000Z`,
    endAt: `${today}T23:59:59.999Z`,
  };
}

async function getSalesTrend(storeId, days = 7) {
  const safeDays = Math.min(Math.max(Number(days) || 7, 7), 30);
  const endDate = dayjs().format('YYYY-MM-DD');
  const startDate = dayjs(endDate).subtract(safeDays - 1, 'day').format('YYYY-MM-DD');
  const result = await query(
    `WITH date_series AS (
       SELECT generate_series($2::date, $3::date, interval '1 day')::date AS sale_date
     ),
     daily_sales AS (
       SELECT
         s.created_at::date AS sale_date,
         COUNT(*)::INT AS sale_count,
         COALESCE(SUM(s.total), 0) AS revenue,
         COALESCE(SUM(s.discount_total), 0) AS discount_total,
         COALESCE(SUM(s.tax_total), 0) AS tax_total
       FROM sales s
       WHERE s.store_id = $1
         AND s.status = 'completed'
         AND s.created_at >= $2::date
         AND s.created_at < ($3::date + interval '1 day')
       GROUP BY s.created_at::date
     )
     SELECT
       TO_CHAR(ds.sale_date, 'YYYY-MM-DD') AS period_key,
       TO_CHAR(ds.sale_date, 'Mon DD') AS period_label,
       COALESCE(daily_sales.sale_count, 0)::INT AS sale_count,
       COALESCE(daily_sales.revenue, 0) AS revenue,
       COALESCE(daily_sales.discount_total, 0) AS discount_total,
       COALESCE(daily_sales.tax_total, 0) AS tax_total
     FROM date_series ds
     LEFT JOIN daily_sales ON daily_sales.sale_date = ds.sale_date
     ORDER BY ds.sale_date ASC`,
    [storeId, startDate, endDate]
  );
  return {
    dateFrom: startDate,
    dateTo: endDate,
    days: safeDays,
    periods: result.rows.map((row) => ({
      periodKey: row.period_key,
      label: row.period_label,
      saleCount: Number(row.sale_count),
      revenue: roundMoney(row.revenue),
      discountTotal: roundMoney(row.discount_total),
      taxTotal: roundMoney(row.tax_total),
    })),
  };
}

async function getLowStockSummary(storeId, limit = 10) {
  const countResult = await query(
    `SELECT COUNT(*)::INT AS low_stock_count
     FROM inventory i
     JOIN variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE p.store_id = $1
       AND i.quantity_on_hand <= i.reorder_threshold`,
    [storeId]
  );
  const itemsResult = await query(
    `SELECT
      v.id AS variant_id,
      v.sku,
      p.id AS product_id,
      p.name AS product_name,
      i.quantity_on_hand,
      i.reorder_threshold
     FROM inventory i
     JOIN variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE p.store_id = $1
       AND i.quantity_on_hand <= i.reorder_threshold
     ORDER BY i.quantity_on_hand ASC, v.sku ASC
     LIMIT $2`,
    [storeId, limit]
  );
  return {
    count: Number(countResult.rows[0].low_stock_count),
    items: itemsResult.rows.map((row) => ({
      variantId: row.variant_id,
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      quantityOnHand: Number(row.quantity_on_hand),
      reorderThreshold: Number(row.reorder_threshold),
    })),
  };
}

async function getRecentActivity(storeId, limit = 20) {
  const result = await query(
    `SELECT
      activity_type,
      reference_id,
      title,
      subtitle,
      amount,
      user_name,
      created_at
     FROM (
      SELECT
        'sale'::text AS activity_type,
        s.id AS reference_id,
        CONCAT('Sale ', s.invoice_number) AS title,
        COALESCE(c.name, 'Walk-in customer') AS subtitle,
        s.total AS amount,
        u.name AS user_name,
        s.created_at
      FROM sales s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.store_id = $1
        AND s.status = 'completed'

      UNION ALL

      SELECT
        e.exchange_type::text AS activity_type,
        e.id AS reference_id,
        CASE
          WHEN e.exchange_type = 'return' THEN CONCAT('Return ', e.exchange_number)
          ELSE CONCAT('Exchange ', e.exchange_number)
        END AS title,
        CONCAT('Original invoice ', s.invoice_number) AS subtitle,
        e.net_amount AS amount,
        u.name AS user_name,
        e.created_at
      FROM exchanges e
      JOIN users u ON u.id = e.user_id
      JOIN sales s ON s.id = e.original_sale_id
      WHERE e.store_id = $1
        AND e.status = 'completed'

      UNION ALL

      SELECT
        'expense'::text AS activity_type,
        ex.id AS reference_id,
        ec.name AS title,
        COALESCE(NULLIF(TRIM(ex.note), ''), 'Expense recorded') AS subtitle,
        ex.amount AS amount,
        u.name AS user_name,
        ex.created_at
      FROM expenses ex
      JOIN expense_categories ec ON ec.id = ex.category_id
      JOIN users u ON u.id = ex.user_id
      WHERE ex.store_id = $1

      UNION ALL

      SELECT
        'inventory'::text AS activity_type,
        sm.id AS reference_id,
        CONCAT(p.name, ' (', v.sku, ')') AS title,
        CONCAT(
          INITCAP(REPLACE(sm.movement_type::text, '_', ' ')),
          ': ',
          CASE WHEN sm.quantity_delta > 0 THEN '+' ELSE '' END,
          sm.quantity_delta::text
        ) AS subtitle,
        NULL::numeric AS amount,
        u.name AS user_name,
        sm.created_at
      FROM stock_movements sm
      JOIN variants v ON v.id = sm.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON u.id = sm.user_id
      WHERE p.store_id = $1
        AND sm.movement_type IN (
          'adjustment',
          'damage',
          'loss',
          'opening_stock',
          'stock_receive'
        )
     ) combined
     ORDER BY created_at DESC
     LIMIT $2`,
    [storeId, limit]
  );
  return result.rows.map((row) => ({
    id: row.reference_id,
    type: row.activity_type,
    title: row.title,
    subtitle: row.subtitle,
    amount: row.amount === null ? null : roundMoney(row.amount),
    userName: row.user_name,
    createdAt: row.created_at,
  }));
}

async function getDashboardOverview(storeId, filters = {}) {
  const { date, dateFrom, dateTo } = todayRange();
  const activityLimit = Number(filters.activityLimit) || 20;
  const topProductsLimit = Number(filters.topProductsLimit) || 5;
  const lowStockLimit = Number(filters.lowStockLimit) || 10;
  const chartDays = Number(filters.chartDays) || 7;

  const [salesReport, profitReport, topProducts, lowStock, recentActivity, salesTrend] = await Promise.all([
    reportsModel.getSalesReport(storeId, {
      dateFrom,
      dateTo,
      includeTransactions: false,
    }),
    reportsModel.getProfitReport(storeId, { dateFrom, dateTo }),
    reportsModel.getRankedProductsReport(
      storeId,
      { dateFrom, dateTo, limit: topProductsLimit, sortBy: 'quantity' },
      'top'
    ),
    getLowStockSummary(storeId, lowStockLimit),
    getRecentActivity(storeId, activityLimit),
    getSalesTrend(storeId, chartDays),
  ]);

  return {
    date,
    stats: {
      saleCount: salesReport.summary.saleCount,
      revenue: salesReport.summary.revenue,
      profit: profitReport.netProfit,
      grossProfit: profitReport.grossProfit,
      expenses: profitReport.expenses,
      lowStockCount: lowStock.count,
    },
    topProducts: topProducts.items,
    lowStockItems: lowStock.items,
    recentActivity,
    charts: {
      salesTrend,
    },
  };
}

module.exports = {
  getDashboardOverview,
  getSalesTrend,
  getLowStockSummary,
  getRecentActivity,
};
