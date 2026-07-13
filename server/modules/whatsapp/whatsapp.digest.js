const dayjs = require('dayjs');
const { query } = require('../../config/database');
const reportsModel = require('../reports/reports.model');
const dashboardModel = require('../dashboard/dashboard.model');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatMoney(amount, symbol = 'Rs.') {
  const value = Number(amount) || 0;
  return `${symbol} ${value.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function resolveSummaryDate(summaryDate) {
  return summaryDate || dayjs().format('YYYY-MM-DD');
}

function buildDateRange(summaryDate) {
  const date = resolveSummaryDate(summaryDate);
  return {
    summaryDate: date,
    dateFrom: date,
    dateTo: date,
    startAt: `${date}T00:00:00.000Z`,
    endAt: `${date}T23:59:59.999Z`,
  };
}

async function loadStoreMeta(storeId) {
  const result = await query(
    `SELECT id, name, currency_symbol
     FROM stores
     WHERE id = $1
     LIMIT 1`,
    [storeId]
  );
  return result.rows[0] || null;
}

async function buildDailyDigest(storeId, summaryDate, settings = {}) {
  const range = buildDateRange(summaryDate);
  const store = await loadStoreMeta(storeId);
  const symbol = store?.currency_symbol || 'Rs.';

  const [salesReport, profitReport, topProducts, lowStock] = await Promise.all([
    reportsModel.getSalesReport(storeId, {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      includeTransactions: false,
    }),
    reportsModel.getProfitReport(storeId, {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    }),
    settings.includeTopProducts === false
      ? Promise.resolve({ items: [] })
      : reportsModel.getRankedProductsReport(
          storeId,
          { dateFrom: range.dateFrom, dateTo: range.dateTo, limit: 5, sortBy: 'quantity' },
          'top'
        ),
    settings.includeLowStock === false
      ? Promise.resolve({ count: 0, items: [] })
      : dashboardModel.getLowStockSummary(storeId, 5),
  ]);

  const payload = {
    summaryDate: range.summaryDate,
    store: {
      id: store?.id || storeId,
      name: store?.name || 'Store',
      currencySymbol: symbol,
    },
    stats: {
      saleCount: salesReport.summary.saleCount,
      revenue: salesReport.summary.revenue,
      discountTotal: salesReport.summary.discountTotal,
      taxTotal: salesReport.summary.taxTotal,
      grossProfit: profitReport.grossProfit,
      expenses: profitReport.expenses,
      netProfit: profitReport.netProfit,
    },
    topProducts: topProducts.items,
    lowStock: {
      count: lowStock.count,
      items: lowStock.items,
    },
  };

  const lines = [
    '📊 Zyro RMS — Daily Summary',
    `📅 ${dayjs(range.summaryDate).format('DD MMM YYYY')}`,
    '',
    `🏪 ${payload.store.name}`,
    '',
    `🛒 Sales: ${payload.stats.saleCount}`,
    `💰 Revenue: ${formatMoney(payload.stats.revenue, symbol)}`,
    `📈 Gross Profit: ${formatMoney(payload.stats.grossProfit, symbol)}`,
    `🧾 Expenses: ${formatMoney(payload.stats.expenses, symbol)}`,
    `💵 Net Profit: ${formatMoney(payload.stats.netProfit, symbol)}`,
  ];

  if (settings.includeTopProducts !== false && payload.topProducts.length > 0) {
    lines.push('', '⭐ Top Products:');
    payload.topProducts.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.productName} (${item.quantitySold} sold)`);
    });
  }

  if (settings.includeLowStock !== false && payload.lowStock.count > 0) {
    lines.push('', `⚠️ Low Stock: ${payload.lowStock.count} item(s)`);
    payload.lowStock.items.forEach((item) => {
      lines.push(`- ${item.productName} / ${item.sku} (${item.quantityOnHand} left)`);
    });
  }

  lines.push('', '— Powered by Zyro RMS');

  return {
    ...payload,
    message: lines.join('\n'),
  };
}

module.exports = {
  buildDailyDigest,
  formatMoney,
  roundMoney,
};
