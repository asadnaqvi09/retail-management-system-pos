const Joi = require('joi');

const paymentMethods = ['cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer'];

const saleLineSchema = Joi.object({
  variantId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  lineDiscount: Joi.number().min(0).default(0),
});

const paymentSchema = Joi.object({
  method: Joi.string().valid(...paymentMethods).required(),
  amount: Joi.number().min(0).required(),
  tenderedAmount: Joi.number().min(0),
  changeAmount: Joi.number().min(0),
  referenceNumber: Joi.string().trim().allow('', null),
});

const lookupVariantSchema = Joi.object({
  code: Joi.string().trim().min(1).max(120).required(),
});

const createSaleSchema = Joi.object({
  clientRequestId: Joi.string().uuid().allow(null),
  customerId: Joi.string().uuid().allow(null),
  cashRegisterSessionId: Joi.string().uuid().allow(null),
  holdCartId: Joi.string().uuid().allow(null),
  note: Joi.string().trim().allow('', null),
  lines: Joi.array().items(saleLineSchema).min(1).required(),
  payments: Joi.array().items(paymentSchema).min(1).required(),
});

const previewSaleSchema = Joi.object({
  lines: Joi.array().items(saleLineSchema).min(1).required(),
});

const createHoldCartSchema = Joi.object({
  label: Joi.string().trim().max(100).allow('', null),
  customerId: Joi.string().uuid().allow(null),
  note: Joi.string().trim().allow('', null),
  lines: Joi.array().items(saleLineSchema).min(1).required(),
});

const listSalesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  status: Joi.string().valid('completed', 'voided'),
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
  userId: Joi.string().uuid(),
  customerId: Joi.string().uuid(),
});

module.exports = {
  paymentMethods,
  lookupVariantSchema,
  createSaleSchema,
  previewSaleSchema,
  createHoldCartSchema,
  listSalesQuerySchema,
};
