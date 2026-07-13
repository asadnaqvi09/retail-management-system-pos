const Joi = require('joi');

const variantStatusValues = ['active', 'inactive'];

const generateMatrixSchema = Joi.object({
  colorValueIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  sizeValueIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const updateVariantSchema = Joi.object({
  sellingPrice: Joi.number().min(0),
  costPrice: Joi.number().min(0),
  discountOverride: Joi.number().min(0).allow(null),
  status: Joi.string().valid(...variantStatusValues),
}).min(1);

module.exports = {
  generateMatrixSchema,
  updateVariantSchema,
};
