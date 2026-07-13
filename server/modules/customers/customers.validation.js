const Joi = require('joi');

const listCustomersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  isActive: Joi.boolean(),
});

const createCustomerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  phone: Joi.string().trim().max(30).allow('', null),
  email: Joi.string().trim().email({ tlds: false }).allow('', null),
  address: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null),
  isActive: Joi.boolean().default(true),
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  phone: Joi.string().trim().max(30).allow('', null),
  email: Joi.string().trim().email({ tlds: false }).allow('', null),
  address: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  listCustomersQuerySchema,
  createCustomerSchema,
  updateCustomerSchema,
};
