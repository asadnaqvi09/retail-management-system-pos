const Joi = require('joi');

const invoiceFormatSchema = Joi.string().valid('thermal', 'a4').default('thermal');

const invoiceQuerySchema = Joi.object({
  format: invoiceFormatSchema,
});

const createPrintLogSchema = Joi.object({
  format: invoiceFormatSchema,
  status: Joi.string().valid('queued', 'printed', 'failed').required(),
  errorMessage: Joi.string().trim().max(500).allow('', null),
});

module.exports = {
  invoiceQuerySchema,
  createPrintLogSchema,
};
