const Joi = require('joi');

const reportRanges = ['daily', 'weekly', 'monthly', 'yearly'];
const revenueGroupBy = ['category', 'brand', 'product'];
const exportFormats = ['csv', 'xlsx', 'pdf'];
const exportableReports = [
  'sales',
  'revenue',
  'profit',
  'inventory',
  'top-selling',
  'low-selling',
  'cashier-performance',
  'returns',
  'exchanges',
  'payment-methods',
];

const dateRangeQuerySchema = Joi.object({
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
});

const salesReportQuerySchema = dateRangeQuerySchema.keys({
  range: Joi.string().valid(...reportRanges).default('daily'),
  includeTransactions: Joi.boolean().default(true),
});

const revenueReportQuerySchema = dateRangeQuerySchema.keys({
  groupBy: Joi.string().valid(...revenueGroupBy).default('category'),
});

const profitReportQuerySchema = dateRangeQuerySchema;

const inventoryReportQuerySchema = Joi.object({
  deadStockDays: Joi.number().integer().min(1).max(365).default(90),
});

const rankedProductsQuerySchema = dateRangeQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(50).default(10),
  categoryId: Joi.string().uuid(),
  brandId: Joi.string().uuid(),
  sortBy: Joi.string().valid('quantity', 'revenue').default('quantity'),
});

const cashierReportQuerySchema = dateRangeQuerySchema;

const returnsReportQuerySchema = dateRangeQuerySchema;

const exchangesReportQuerySchema = dateRangeQuerySchema;

const paymentMethodsReportQuerySchema = dateRangeQuerySchema;

const exportReportQuerySchema = Joi.object({
  format: Joi.string().valid(...exportFormats).default('csv'),
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
  range: Joi.string().valid(...reportRanges),
  groupBy: Joi.string().valid(...revenueGroupBy),
  deadStockDays: Joi.number().integer().min(1).max(365),
  limit: Joi.number().integer().min(1).max(50),
  categoryId: Joi.string().uuid(),
  brandId: Joi.string().uuid(),
  sortBy: Joi.string().valid('quantity', 'revenue'),
  includeTransactions: Joi.boolean(),
});

const reportKeyParamSchema = Joi.object({
  reportKey: Joi.string()
    .valid(...exportableReports)
    .required(),
});

module.exports = {
  reportRanges,
  revenueGroupBy,
  exportFormats,
  exportableReports,
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
  reportKeyParamSchema,
};
