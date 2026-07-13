const Joi = require('joi');

const listCategoriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  parentCategoryId: Joi.string().uuid().allow(null),
  isActive: Joi.boolean(),
  rootsOnly: Joi.boolean().default(false),
});

const treeQuerySchema = Joi.object({
  isActive: Joi.boolean(),
});

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().allow('', null),
  parentCategoryId: Joi.string().uuid().allow(null),
  isActive: Joi.boolean().default(true),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().allow('', null),
  parentCategoryId: Joi.string().uuid().allow(null),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  listCategoriesQuerySchema,
  treeQuerySchema,
  createCategorySchema,
  updateCategorySchema,
};
