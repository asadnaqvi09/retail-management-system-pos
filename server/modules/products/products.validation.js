const Joi = require('joi');

const productStatusValues = ['active', 'inactive', 'draft'];

const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  status: Joi.string().valid(...productStatusValues),
  categoryId: Joi.string().uuid(),
  brandId: Joi.string().uuid(),
});

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().allow('', null),
  baseSku: Joi.string().trim().uppercase().min(1).max(80).required(),
  defaultSellingPrice: Joi.number().min(0).default(0),
  defaultCostPrice: Joi.number().min(0).default(0),
  status: Joi.string().valid(...productStatusValues).default('active'),
  categoryId: Joi.string().uuid().allow(null),
  brandId: Joi.string().uuid().allow(null),
  taxClassId: Joi.string().uuid().allow(null),
  attributesJson: Joi.object().default({}),
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().allow('', null),
  baseSku: Joi.string().trim().uppercase().min(1).max(80),
  defaultSellingPrice: Joi.number().min(0),
  defaultCostPrice: Joi.number().min(0),
  status: Joi.string().valid(...productStatusValues),
  categoryId: Joi.string().uuid().allow(null),
  brandId: Joi.string().uuid().allow(null),
  taxClassId: Joi.string().uuid().allow(null),
  attributesJson: Joi.object(),
}).min(1);

const exportProductsQuerySchema = Joi.object({
  status: Joi.string().valid(...productStatusValues),
  categoryId: Joi.string().uuid(),
  brandId: Joi.string().uuid(),
  format: Joi.string().valid('csv', 'xlsx').default('csv'),
});

module.exports = {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  exportProductsQuerySchema,
};
