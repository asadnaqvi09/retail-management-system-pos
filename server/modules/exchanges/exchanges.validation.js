const Joi = require('joi');

const paymentMethods = ['cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer', 'store_credit'];

const returnLineSchema = Joi.object({
  originalSaleLineId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  disposition: Joi.string().valid('restock', 'damaged').default('restock'),
});

const newLineSchema = Joi.object({
  variantId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
});

const settlementPaymentSchema = Joi.object({
  method: Joi.string().valid(...paymentMethods).required(),
  amount: Joi.number().min(0).required(),
  tenderedAmount: Joi.number().min(0),
  changeAmount: Joi.number().min(0),
  referenceNumber: Joi.string().trim().allow('', null),
});

const adminOverrideSchema = Joi.object({
  username: Joi.string().trim().min(1).required(),
  pin: Joi.string().trim().min(4).max(12).required(),
});

const exchangePayloadSchema = Joi.object({
  originalSaleId: Joi.string().uuid().required(),
  returnLines: Joi.array().items(returnLineSchema).min(1).required(),
  newLines: Joi.array().items(newLineSchema).default([]),
  note: Joi.string().trim().allow('', null),
  adminOverride: adminOverrideSchema,
  settlementPayment: settlementPaymentSchema,
});

const lookupSaleQuerySchema = Joi.object({
  code: Joi.string().trim().allow('').default(''),
  customerPhone: Joi.string().trim().allow('').default(''),
}).custom((value, helpers) => {
  if (!value.code && !value.customerPhone) {
    return helpers.error('any.custom', { message: 'Invoice code or customer phone is required' });
  }
  return value;
});

const listExchangesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  exchangeType: Joi.string().valid('return', 'exchange'),
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
});

module.exports = {
  paymentMethods,
  exchangePayloadSchema,
  lookupSaleQuerySchema,
  listExchangesQuerySchema,
};
