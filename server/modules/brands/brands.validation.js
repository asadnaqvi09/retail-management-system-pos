const Joi = require('joi');

const listBrandsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  isActive: Joi.boolean(),
});

const createBrandSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  isActive: Joi.boolean().default(true),
});

const updateBrandSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  listBrandsQuerySchema,
  createBrandSchema,
  updateBrandSchema,
};
