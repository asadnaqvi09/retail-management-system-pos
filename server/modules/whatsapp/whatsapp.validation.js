const Joi = require('joi');

const listSummariesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('queued', 'sent', 'failed'),
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
});

const previewQuerySchema = Joi.object({
  summaryDate: Joi.string().isoDate(),
});

const sendSummarySchema = Joi.object({
  summaryDate: Joi.string().isoDate(),
  recipientPhone: Joi.string().trim().max(30),
  force: Joi.boolean().default(false),
});

const testMessageSchema = Joi.object({
  recipientPhone: Joi.string().trim().max(30),
  message: Joi.string().trim().max(1600).allow(''),
});

module.exports = {
  listSummariesQuerySchema,
  previewQuerySchema,
  sendSummarySchema,
  testMessageSchema,
};
