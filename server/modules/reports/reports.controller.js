const reportsModel = require('./reports.model');
const { exportReport } = require('./reports.export');

const reportTitles = {
  sales: 'Sales Report',
  revenue: 'Revenue Report',
  profit: 'Profit Report',
  inventory: 'Inventory Report',
  'top-selling': 'Top Selling Products',
  'low-selling': 'Low Selling Products',
  'cashier-performance': 'Cashier Performance',
  returns: 'Returns Report',
  exchanges: 'Exchange Report',
  'payment-methods': 'Payment Methods Report',
};

async function getSalesReport(req, res, next) {
  try {
    const data = await reportsModel.getSalesReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getRevenueReport(req, res, next) {
  try {
    const data = await reportsModel.getRevenueReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getProfitReport(req, res, next) {
  try {
    const data = await reportsModel.getProfitReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getInventoryReport(req, res, next) {
  try {
    const data = await reportsModel.getInventoryReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getTopSellingReport(req, res, next) {
  try {
    const data = await reportsModel.getRankedProductsReport(req.user.storeId, req.query, 'top');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getLowSellingReport(req, res, next) {
  try {
    const data = await reportsModel.getRankedProductsReport(req.user.storeId, req.query, 'low');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getCashierPerformanceReport(req, res, next) {
  try {
    const data = await reportsModel.getCashierPerformanceReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getReturnsReport(req, res, next) {
  try {
    const data = await reportsModel.getReturnsReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getExchangesReport(req, res, next) {
  try {
    const data = await reportsModel.getExchangesReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getPaymentMethodsReport(req, res, next) {
  try {
    const data = await reportsModel.getPaymentMethodsReport(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function exportReportFile(req, res, next) {
  try {
    const reportKey = req.params.reportKey;
    const format = req.query.format || 'csv';
    const data = await reportsModel.getReport(reportKey, req.user.storeId, req.query);
    const subtitle = data.dateFrom && data.dateTo ? `${data.dateFrom} to ${data.dateTo}` : '';
    const file = await exportReport(reportKey, data, format, {
      title: reportTitles[reportKey] || reportKey,
      subtitle,
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSalesReport,
  getRevenueReport,
  getProfitReport,
  getInventoryReport,
  getTopSellingReport,
  getLowSellingReport,
  getCashierPerformanceReport,
  getReturnsReport,
  getExchangesReport,
  getPaymentMethodsReport,
  exportReportFile,
};
