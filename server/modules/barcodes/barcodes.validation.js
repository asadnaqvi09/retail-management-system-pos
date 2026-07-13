const Joi = require('joi');

const labelTemplates = ['40x30', '50x25', 'a4_sheet'];

const labelQuerySchema = Joi.object({
  template: Joi.string().valid(...labelTemplates).default('40x30'),
  copies: Joi.number().integer().min(1).max(100).default(1),
});

const bulkLabelItemSchema = Joi.object({
  variantId: Joi.string().uuid().required(),
  copies: Joi.number().integer().min(1).max(100).default(1),
});

const bulkLabelsSchema = Joi.object({
  template: Joi.string().valid(...labelTemplates).default('40x30'),
  items: Joi.array().items(bulkLabelItemSchema).min(1).max(200).required(),
});

module.exports = {
  labelTemplates,
  labelQuerySchema,
  bulkLabelsSchema,
};
