const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateQuery } = require('../../middleware/validate.middleware');
const {
  salesReportQuerySchema,
  revenueReportQuerySchema,
  profitReportQuerySchema,
  inventoryReportQuerySchema,
  rankedProductsQuerySchema,
  cashierReportQuerySchema,
  returnsReportQuerySchema,
  exchangesReportQuerySchema,
  paymentMethodsReportQuerySchema,
  exportReportQuerySchema,
} = require('./reports.validation');
const reportsController = require('./reports.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/sales',
  requirePermission('reports.view'),
  validateQuery(salesReportQuerySchema),
  reportsController.getSalesReport
);

router.get(
  '/revenue',
  requirePermission('reports.view'),
  validateQuery(revenueReportQuerySchema),
  reportsController.getRevenueReport
);

router.get(
  '/profit',
  requirePermission('reports.view'),
  validateQuery(profitReportQuerySchema),
  reportsController.getProfitReport
);

router.get(
  '/inventory',
  requirePermission('reports.view'),
  validateQuery(inventoryReportQuerySchema),
  reportsController.getInventoryReport
);

router.get(
  '/top-selling',
  requirePermission('reports.view'),
  validateQuery(rankedProductsQuerySchema),
  reportsController.getTopSellingReport
);

router.get(
  '/low-selling',
  requirePermission('reports.view'),
  validateQuery(rankedProductsQuerySchema),
  reportsController.getLowSellingReport
);

router.get(
  '/cashier-performance',
  requirePermission('reports.view'),
  validateQuery(cashierReportQuerySchema),
  reportsController.getCashierPerformanceReport
);

router.get(
  '/returns',
  requirePermission('reports.view'),
  validateQuery(returnsReportQuerySchema),
  reportsController.getReturnsReport
);

router.get(
  '/exchanges',
  requirePermission('reports.view'),
  validateQuery(exchangesReportQuerySchema),
  reportsController.getExchangesReport
);

router.get(
  '/payment-methods',
  requirePermission('reports.view'),
  validateQuery(paymentMethodsReportQuerySchema),
  reportsController.getPaymentMethodsReport
);

router.get(
  '/:reportKey/export',
  requirePermission('reports.export'),
  validateQuery(exportReportQuerySchema),
  reportsController.exportReportFile
);

module.exports = router;
