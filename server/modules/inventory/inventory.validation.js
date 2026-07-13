const Joi = require('joi');

const adjustmentMovementTypes = ['adjustment', 'damage', 'loss', 'opening_stock', 'stock_receive'];

const listInventoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  lowStockOnly: Joi.boolean().default(false),
  productId: Joi.string().uuid(),
});

const listMovementsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  variantId: Joi.string().uuid(),
  movementType: Joi.string().valid(...adjustmentMovementTypes, 'sale', 'return', 'exchange_in', 'exchange_out'),
});

const adjustStockSchema = Joi.object({
  movementType: Joi.string().valid(...adjustmentMovementTypes).required(),
  quantityDelta: Joi.number().integer().invalid(0),
  targetQuantity: Joi.number().integer().min(0),
  reason: Joi.string().trim().min(1).max(255).required(),
  note: Joi.string().trim().allow('', null),
}).xor('quantityDelta', 'targetQuantity');

const updateThresholdSchema = Joi.object({
  reorderThreshold: Joi.number().integer().min(0).required(),
});

module.exports = {
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  adjustStockSchema,
  updateThresholdSchema,
  adjustmentMovementTypes,
};
